import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupStripeRoutes } from "./stripe";
import { setupDocomoRoutes } from "./documo";
import multer from "multer";
import { db } from "@db";
import { transactions } from "@db/schema";
import { eq } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage() });

export function registerRoutes(app: Express): Server {
  // Price calculation endpoint
  app.get("/api/price", async (req, res) => {
    const { country, pages } = req.query;
    
    // Simple pricing logic - can be made more complex based on country
    const basePrice = 0.10; // Base price per page
    const countryMultiplier = country === 'US' ? 1 : 1.5;
    const total = Number(pages) * basePrice * countryMultiplier;
    
    res.json({ total });
  });

  // Setup Documo fax routes
  setupDocomoRoutes(app);

  // Setup Stripe webhook to handle successful payments
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const transaction = await db.query.transactions.findFirst({
          where: eq(transactions.stripePaymentId, session.id)
        });

        if (transaction && transaction.files) {
          // Send fax through Documo
          const faxId = await sendFax(transaction.files, transaction.recipientNumber);
          
          // Update transaction with fax ID
          await db.update(transactions)
            .set({ documoFaxId: faxId })
            .where(eq(transactions.id, transaction.id));
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Setup other Stripe routes
  setupStripeRoutes(app);

  // Fax sending endpoint
  app.post("/api/send-fax", upload.array("files"), async (req, res) => {
    try {
      const files = (req.files || []) as Express.Multer.File[];
      const { countryCode, recipientNumber, paymentIntentId } = req.body;

      // Create transaction record
      const [transaction] = await db.insert(transactions)
        .values({
          status: "processing",
          recipientNumber,
          countryCode,
          pageCount: files.length,
          amount: 0, // Will be updated after payment confirmation
          stripePaymentId: paymentIntentId,
          documoFaxId: "", // Will be updated after fax is sent
        })
        .returning();

      res.json({ transactionId: transaction.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to process fax" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
