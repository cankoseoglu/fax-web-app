
import type { Express } from "express";
import axios from "axios";
import { db } from "@db";
import { transactions } from "@db/schema";
import { eq } from "drizzle-orm";
import type { TransactionStatusType } from "@db/schema";

// Check if we have the API key
const hasDocomoApiKey = !!process.env.DOCUMO_API_KEY;
console.log("Documo API Key exists:", hasDocomoApiKey);

const documoClient = axios.create({
  baseURL: "https://api.documo.com/v1",
  headers: {
    Authorization: hasDocomoApiKey ? `Bearer ${process.env.DOCUMO_API_KEY}` : '',
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
    console.log(`Attempting to send fax to ${recipientNumber} with ${files.length} files`);
    
    // For Swagger testing, return a mock fax ID if no API key
    if (!hasDocomoApiKey) {
      console.log("Test mode: Using mock fax ID for testing");
      return "test_fax_" + Math.random().toString(36).substring(7);
    }
    
    // First create a fax object
    const faxResponse = await documoClient.post("/faxes", {
      to: recipientNumber,
      quality: "high",
    });
    
    console.log("Fax object created:", faxResponse.data);
    
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
  } catch (error: any) {
    console.error("Documo sendFax error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // For Swagger testing without API key
    if (!hasDocomoApiKey) {
      console.log("Test mode: Using mock fax ID despite error");
      return "test_fax_" + Math.random().toString(36).substring(7);
    }
    
    if (error.response?.status === 401) {
      throw new Error("Authentication failed with Documo API");
    } else if (error.response?.status === 400) {
      throw new Error(`Invalid request: ${error.response.data.message || 'Bad request'}`);
    } else {
      throw new Error("Failed to send fax through Documo: " + error.message);
    }
  }
}
