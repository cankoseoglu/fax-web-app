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
