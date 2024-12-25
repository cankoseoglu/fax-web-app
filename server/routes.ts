import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupStripeRoutes } from "./stripe";
import { setupDocomoRoutes } from "./documo";
import { setupSwagger } from "./swagger";
import multer from "multer";
import { db } from "../db/db";
import { transactions } from "../db/schema";
import { eq } from "drizzle-orm";
import { sendFax } from "./utils/sendFax";

const upload = multer({ storage: multer.memoryStorage() });

const BASE_PRICE = 0.40; // Minimum amount for Stripe live mode

export function registerRoutes(app: Express): Server {
  const server = createServer(app);
  
  // Setup Swagger documentation
  setupSwagger(app);

  // Add endpoint to serve Stripe public key
  app.get("/api/stripe/config", (req, res) => {
    console.log('Stripe config request received');
    
    const publishableKey = process.env.VITE_STRIPE_PUBLIC_KEY;
    if (!publishableKey) {
      console.error('VITE_STRIPE_PUBLIC_KEY is not set');
      return res.status(500).json({ error: 'Stripe configuration is missing' });
    }
    
    const response = {
      publishableKey
    };
    console.log('Sending Stripe config response:', { ...response, publishableKey: '***' });
    res.json(response);
  });

  // Debug endpoint for environment variables
  app.get("/api/debug/env", (req, res) => {
    res.json({
      hasStripePublicKey: !!process.env.VITE_STRIPE_PUBLIC_KEY,
      hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
      hasDocomoApiKey: !!process.env.DOCUMO_API_KEY,
      stripePublicKey: process.env.VITE_STRIPE_PUBLIC_KEY?.substring(0, 8) + '...',
    });
  });

  // Price calculation endpoint
  app.get("/api/price", async (req, res) => {
    const { country, pages } = req.query;
    console.log('Price calculation request:', { country, pages });
    
    // Use the constant defined at the top
    const countryMultiplier = country === 'US' ? 1 : 1.5;
    const total = Number(pages) * BASE_PRICE * countryMultiplier;
    
    console.log('Price calculation result:', { total, basePrice: BASE_PRICE, countryMultiplier });
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

      // For Swagger testing
      if (paymentIntentId === "test") {
        console.log("Test mode: Bypassing payment verification");
      } else if (!paymentIntentId.startsWith("pi_")) {
        return res.status(400).json({ error: "Invalid payment intent ID" });
      }

      // Create transaction record
      const [transaction] = await db.insert(transactions)
        .values({
          status: "processing" as const,
          recipientNumber,
          countryCode,
          pageCount: files.length,
          amount: "0", // Will be updated after payment confirmation
          stripeSessionId: paymentIntentId,
          documoFaxId: "", // Will be updated after fax is sent
          files: files.map(f => Buffer.from(f.buffer).toString('base64')),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // Send fax using Documo API
      const faxId = await sendFax(
        transaction.files,
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
      const transaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, parseInt(transactionId)))
        .limit(1)
        .then(results => results[0]);

      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.json({ status: transaction.status });
    } catch (error) {
      console.error("Fax status error:", error);
      res.status(500).json({ error: "Failed to fetch fax status" });
    }
  });

  // Add transaction status endpoint for success page
  app.get("/api/transaction/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const transaction = await db
        .select()
        .from(transactions)
        .where(eq(transactions.stripeSessionId, sessionId))
        .then(results => results[0]);

      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.json({
        status: transaction.status,
        documoFaxId: transaction.documoFaxId,
        error: transaction.error,
        amount: transaction.amount,
        recipientNumber: transaction.recipientNumber,
        pageCount: transaction.pageCount,
        countryCode: transaction.countryCode,
        createdAt: transaction.createdAt
      });
    } catch (error) {
      console.error("Transaction status error:", error);
      res.status(500).json({ error: "Failed to fetch transaction status" });
    }
  });

  // Add endpoint to store fax details before payment
  app.post("/api/store-fax", upload.array("files"), async (req, res) => {
    try {
      const files = (req.files || []) as Express.Multer.File[];
      const { countryCode, recipientNumber, stripeSessionId } = req.body;

      if (!stripeSessionId) {
        return res.status(400).json({ error: "Missing Stripe session ID" });
      }

      // Convert files to base64
      const base64Files = files.map(file => 
        Buffer.from(file.buffer).toString('base64')
      );

      // Create transaction record
      const [transaction] = await db.insert(transactions)
        .values({
          status: "pending" as const,
          recipientNumber,
          countryCode,
          pageCount: files.length,
          amount: "0", // Will be updated after payment confirmation
          stripeSessionId,
          documoFaxId: "", // Will be updated after fax is sent
          files: base64Files,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      res.json({ success: true });
    } catch (error) {
      console.error("Store fax error:", error);
      res.status(500).json({ error: "Failed to store fax details" });
    }
  });

  return server;
}
