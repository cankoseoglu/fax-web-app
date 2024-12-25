import axios from "axios";

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

export async function sendFax(files: string[], recipientNumber: string): Promise<string> {
  try {
    console.log(`Attempting to send fax to ${recipientNumber} with ${files.length} files`);
    
    // Only use mock fax ID if explicitly in test mode AND no API key
    if (!hasDocomoApiKey && process.env.NODE_ENV === 'test') {
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
    const uploadPromises = files.map(file => {
      const buffer = Buffer.from(file, 'base64');
      return documoClient.post(`/faxes/${faxId}/attachments`, buffer, {
        headers: { "Content-Type": "application/pdf" }
      });
    });

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
    
    // Only fall back to test mode if explicitly testing AND no API key
    if (!hasDocomoApiKey && process.env.NODE_ENV === 'test') {
      console.log("Test mode: Using mock fax ID despite error");
      return "test_fax_" + Math.random().toString(36).substring(7);
    }
    
    // If we have an API key but got a 401, there's likely a configuration issue
    if (hasDocomoApiKey && error.response?.status === 401) {
      console.error("Documo API key is present but authentication failed. Please check the API key configuration.");
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