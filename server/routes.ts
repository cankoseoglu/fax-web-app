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
        })
        .returning();

      res.json({ transactionId: transaction.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to process fax" });
    }
  });

  const httpServer = createServer(app);
  app.set('trust proxy', 1);
  return httpServer;
}
