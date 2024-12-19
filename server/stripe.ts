import type { Express } from "express";
import Stripe from "stripe";

console.log("Server Stripe Key exists:", !!process.env.STRIPE_SECRET_KEY);
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
});

export function setupStripeRoutes(app: Express) {
  app.post("/api/create-payment", async (req, res) => {
    try {
      console.log("Creating payment intent:", req.body);
      const { countryCode, pageCount } = req.body;

      if (!pageCount || pageCount < 1) {
        console.log("Invalid page count:", pageCount);
        return res.status(400).json({ error: "Invalid page count" });
      }

      // Calculate price
      const basePrice = 0.10; // $0.10 per page base price
      const countryMultiplier = countryCode === 'US' ? 1 : 1.5;
      const amount = Math.round(pageCount * basePrice * countryMultiplier * 100); // Convert to cents

      // Create a PaymentIntent with manual capture
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        capture_method: 'manual', // This allows us to authorize the payment but capture it later
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          countryCode,
          pageCount: pageCount.toString(),
        },
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error("Stripe payment error:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // Add webhook endpoint for Stripe events
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        // Handle successful payment
        // Update transaction status and amount
        // This will be implemented when we add webhook handling
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ error: "Webhook signature verification failed" });
    }
  });
}
