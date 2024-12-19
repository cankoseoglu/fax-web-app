import type { Express } from "express";
import axios from "axios";
import { db } from "@db";
import { transactions } from "@db/schema";
import { eq } from "drizzle-orm";
import type { TransactionStatusType } from "@db/schema";

const documoClient = axios.create({
  baseURL: "https://api.documo.com/v1",
  headers: {
    Authorization: `Bearer ${process.env.DOCUMO_API_KEY}`,
  },
});

export function setupDocomoRoutes(app: Express) {
  app.post("/api/documo/webhook", async (req, res) => {
    const { faxId, status } = req.body;
    console.log("Documo webhook received:", { faxId, status });

    try {
      // Get the transaction record
      const [transaction] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.documoFaxId, faxId))
        .limit(1);

      if (!transaction) {
        console.error("No transaction found for fax ID:", faxId);
        return res.status(404).json({ error: "Transaction not found" });
      }

      if (status === 'completed') {
        console.log("Fax completed successfully, capturing payment...");
        try {
          // Capture the payment
          const paymentIntent = await stripe.paymentIntents.capture(
            transaction.stripePaymentId
          );
          console.log("Payment captured successfully:", paymentIntent.id);
        } catch (stripeError) {
          console.error("Failed to capture payment:", stripeError);
          // Update transaction status to failed if payment capture fails
          await db
            .update(transactions)
            .set({ status: 'failed' })
            .where(eq(transactions.documoFaxId, faxId));
          return res.status(500).json({ error: "Failed to capture payment" });
        }
      }

      // Update transaction status
      await db
        .update(transactions)
        .set({ status: status as TransactionStatusType })
        .where(eq(transactions.documoFaxId, faxId));

      res.json({ success: true });
    } catch (error) {
      console.error("Documo webhook error:", error);
      res.status(500).json({ error: "Failed to update fax status" });
    }
  });
}

export async function sendFax(files: Buffer[], recipientNumber: string): Promise<string> {
  try {
    // Upload files to Documo
    const uploadPromises = files.map(file =>
      documoClient.post("/files", file, {
        headers: { "Content-Type": "application/pdf" },
      })
    );

    const uploadedFiles = await Promise.all(uploadPromises);
    const fileIds = uploadedFiles.map(response => response.data.id);

    // Send fax
    const response = await documoClient.post("/faxes", {
      to: recipientNumber,
      fileIds,
      quality: "high",
    });

    return response.data.id;
  } catch (error) {
    console.error("Documo sendFax error:", error);
    console.error("Documo API response:", error.response?.data);
    throw new Error(`Failed to send fax through Documo: ${error.message}`);
  }
}
