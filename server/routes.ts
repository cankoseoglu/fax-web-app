import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupStripeRoutes } from "./stripe";
import { setupDocomoRoutes, sendFax } from "./documo";
import { setupSwagger } from "./swagger";
import multer from "multer";
import { db } from "@db";
import { transactions } from "@db/schema";
import { eq } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage() });

export function registerRoutes(app: Express): Server {
  // Setup Swagger documentation
  setupSwagger(app);
  // Price calculation endpoint
  app.get("/api/price", async (req, res) => {
    const { country, pages } = req.query;
    
    // Simple pricing logic - can be made more complex based on country
    const basePrice = 0.10; // Base price per page
    const countryMultiplier = country === 'US' ? 1 : 1.5;
    const total = Number(pages) * basePrice * countryMultiplier;
    
    res.json({ total });
  });

  // Setup Stripe payment routes
  setupStripeRoutes(app);

  // Setup Documo fax routes
  setupDocomoRoutes(app);

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
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Send fax using Documo API
      const faxId = await sendFax(
        files.map(f => f.buffer),
        recipientNumber
      );

      // Update transaction with fax ID
      await db.update(transactions)
        .set({ documoFaxId: faxId })
        .where(eq(transactions.id, transaction.id));

      res.json({ transactionId: transaction.id });
    } catch (error) {
      console.error("Fax sending error:", error);
      res.status(500).json({ error: "Failed to process fax" });
    }
  });

  // Add fax status endpoint
  app.get("/api/fax-status/:transactionId", async (req, res) => {
    try {
      const { transactionId } = req.params;
      const [transaction] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, parseInt(transactionId)))
        .limit(1);

      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.json({ status: transaction.status });
    } catch (error) {
      console.error("Fax status error:", error);
      res.status(500).json({ error: "Failed to fetch fax status" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
