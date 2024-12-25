import express, { type Express } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { transactions } from "../db/schema";
import { sendFax } from "./utils/sendFax";
import { db } from "../db/db";

console.log("Server Stripe Key exists:", !!process.env.STRIPE_SECRET_KEY);
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15" as const,
});

const BASE_PRICE = 0.40; // Minimum amount for Stripe live mode

export function setupStripeRoutes(app: Express) {
  app.post("/api/create-payment", async (req, res) => {
    try {
      const { countryCode, pageCount } = req.body;
      console.log('Payment creation request:', { countryCode, pageCount });

      if (!pageCount || pageCount < 1) {
        return res.status(400).json({ error: "Invalid page count" });
      }

      // Calculate price using the constant defined at the top
      const countryMultiplier = countryCode === 'US' ? 1 : 1.5;
      const amount = Math.round(pageCount * BASE_PRICE * countryMultiplier * 100); // Convert to cents
      console.log('Payment amount calculation:', { amount, basePrice: BASE_PRICE, countryMultiplier });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Fax Service",
                description: `${pageCount} page${pageCount > 1 ? 's' : ''} to ${countryCode}`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: process.env.REPLIT_DOMAINS 
          ? `https://${process.env.REPLIT_DOMAINS}/success?transaction_id={CHECKOUT_SESSION_ID}` 
          : 'http://localhost:3000/success?transaction_id={CHECKOUT_SESSION_ID}',
        cancel_url: process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}/cancel` : 'http://localhost:3000/cancel',
        metadata: {
          countryCode,
          pageCount: pageCount.toString(),
        },
      });

      res.json({ sessionId: session.id });
    } catch (error) {
      console.error("Stripe payment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create payment session";
      console.error("Stripe payment creation error details:", error);
      res.status(500).json({ error: errorMessage });
    }
  });

  // Add webhook endpoint for Stripe events
  app.post("/api/stripe/webhook", express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        
        try {
          // Get the stored transaction
          const transaction = await db
            .select()
            .from(transactions)
            .where(eq(transactions.stripeSessionId, session.id))
            .then(results => results[0]);

          if (!transaction) {
            throw new Error('Transaction not found');
          }

          // Update transaction with payment amount
          await db
            .update(transactions)
            .set({ 
              status: 'processing' as const,
              amount: session.amount_total ? (session.amount_total / 100).toString() : "0"
            })
            .where(eq(transactions.stripeSessionId, session.id));

          // Send fax using Documo API
          const faxId = await sendFax(
            transaction.files,
            transaction.recipientNumber
          );

          // Update transaction with fax ID
          await db
            .update(transactions)
            .set({ documoFaxId: faxId })
            .where(eq(transactions.stripeSessionId, session.id));

        } catch (error) {
          console.error('Error processing fax after payment:', error);
          // Update transaction with error status
          await db
            .update(transactions)
            .set({ 
              status: 'failed' as const,
              error: error instanceof Error ? error.message : 'Failed to send fax'
            })
            .where(eq(transactions.stripeSessionId, session.id));
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ error: "Webhook signature verification failed" });
    }
  });
}
