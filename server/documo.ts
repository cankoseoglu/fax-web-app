
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
    "Content-Type": "application/json"
  }
});

export function setupDocomoRoutes(app: Express) {
  app.post("/api/documo/webhook", async (req, res) => {
    const { faxId, status } = req.body;

    try {
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
    // First create a fax object
    const faxResponse = await documoClient.post("/faxes", {
      to: recipientNumber,
      quality: "high",
    });
    
    const faxId = faxResponse.data.id;
    
    // Then upload each file as an attachment
    const uploadPromises = files.map(file =>
      documoClient.post(`/faxes/${faxId}/attachments`, file, {
        headers: { "Content-Type": "application/pdf" }
      })
    );

    await Promise.all(uploadPromises);
    
    // Finally send the fax
    await documoClient.post(`/faxes/${faxId}/send`);

    return faxId;
  } catch (error) {
    console.error("Documo sendFax error:", error);
    throw new Error("Failed to send fax through Documo");
  }
}
