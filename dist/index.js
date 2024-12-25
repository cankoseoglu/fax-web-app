var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express3 from "express";

// server/routes.ts
import { createServer } from "http";

// server/stripe.ts
import express from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";

// db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  insertTransactionSchema: () => insertTransactionSchema,
  selectTransactionSchema: () => selectTransactionSchema,
  transactions: () => transactions
});
import { pgTable, text, serial, timestamp, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
var TransactionStatus = z.enum(["pending", "processing", "completed", "failed"]);
var transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull(),
  recipientNumber: text("recipient_number").notNull(),
  countryCode: text("country_code").notNull(),
  pageCount: integer("page_count").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  stripeSessionId: text("stripe_session_id").notNull(),
  documoFaxId: text("documo_fax_id").default("").notNull(),
  files: text("files").array().notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertTransactionSchema = createInsertSchema(transactions);
var selectTransactionSchema = createSelectSchema(transactions);

// server/utils/sendFax.ts
import axios from "axios";
var hasDocomoApiKey = !!process.env.DOCUMO_API_KEY;
console.log("Documo API Key exists:", hasDocomoApiKey);
var documoClient = axios.create({
  baseURL: "https://api.documo.com/v1",
  headers: {
    Authorization: hasDocomoApiKey ? `Bearer ${process.env.DOCUMO_API_KEY}` : "",
    "Content-Type": "application/json"
  }
});
async function sendFax(files, recipientNumber) {
  try {
    console.log(`Attempting to send fax to ${recipientNumber} with ${files.length} files`);
    if (!hasDocomoApiKey && process.env.NODE_ENV === "test") {
      console.log("Test mode: Using mock fax ID for testing");
      return "test_fax_" + Math.random().toString(36).substring(7);
    }
    const faxResponse = await documoClient.post("/faxes", {
      to: recipientNumber,
      quality: "high"
    });
    console.log("Fax object created:", faxResponse.data);
    const faxId = faxResponse.data.id;
    const uploadPromises = files.map((file) => {
      const buffer = Buffer.from(file, "base64");
      return documoClient.post(`/faxes/${faxId}/attachments`, buffer, {
        headers: { "Content-Type": "application/pdf" }
      });
    });
    await Promise.all(uploadPromises);
    await documoClient.post(`/faxes/${faxId}/send`);
    return faxId;
  } catch (error) {
    console.error("Documo sendFax error:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    if (!hasDocomoApiKey && process.env.NODE_ENV === "test") {
      console.log("Test mode: Using mock fax ID despite error");
      return "test_fax_" + Math.random().toString(36).substring(7);
    }
    if (hasDocomoApiKey && error.response?.status === 401) {
      console.error("Documo API key is present but authentication failed. Please check the API key configuration.");
    }
    if (error.response?.status === 401) {
      throw new Error("Authentication failed with Documo API");
    } else if (error.response?.status === 400) {
      throw new Error(`Invalid request: ${error.response.data.message || "Bad request"}`);
    } else {
      throw new Error("Failed to send fax through Documo: " + error.message);
    }
  }
}

// db/db.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
var client = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 1
});
var db = drizzle(client, { schema: schema_exports });

// server/stripe.ts
console.log("Server Stripe Key exists:", !!process.env.STRIPE_SECRET_KEY);
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required");
}
var stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15"
});
var BASE_PRICE = 0.4;
function setupStripeRoutes(app2) {
  app2.post("/api/create-payment", async (req, res) => {
    try {
      const { countryCode, pageCount } = req.body;
      console.log("Payment creation request:", { countryCode, pageCount });
      if (!pageCount || pageCount < 1) {
        return res.status(400).json({ error: "Invalid page count" });
      }
      const countryMultiplier = countryCode === "US" ? 1 : 1.5;
      const amount = Math.round(pageCount * BASE_PRICE * countryMultiplier * 100);
      console.log("Payment amount calculation:", { amount, basePrice: BASE_PRICE, countryMultiplier });
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Fax Service",
                description: `${pageCount} page${pageCount > 1 ? "s" : ""} to ${countryCode}`
              },
              unit_amount: amount
            },
            quantity: 1
          }
        ],
        mode: "payment",
        success_url: process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}/success?transaction_id={CHECKOUT_SESSION_ID}` : "http://localhost:3000/success?transaction_id={CHECKOUT_SESSION_ID}",
        cancel_url: process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS}/cancel` : "http://localhost:3000/cancel",
        metadata: {
          countryCode,
          pageCount: pageCount.toString()
        }
      });
      res.json({ sessionId: session.id });
    } catch (error) {
      console.error("Stripe payment error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create payment session";
      console.error("Stripe payment creation error details:", error);
      res.status(500).json({ error: errorMessage });
    }
  });
  app2.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        try {
          const transaction = await db.select().from(transactions).where(eq(transactions.stripeSessionId, session.id)).then((results) => results[0]);
          if (!transaction) {
            throw new Error("Transaction not found");
          }
          await db.update(transactions).set({
            status: "processing",
            amount: session.amount_total ? (session.amount_total / 100).toString() : "0"
          }).where(eq(transactions.stripeSessionId, session.id));
          const faxId = await sendFax(
            transaction.files,
            transaction.recipientNumber
          );
          await db.update(transactions).set({ documoFaxId: faxId }).where(eq(transactions.stripeSessionId, session.id));
        } catch (error) {
          console.error("Error processing fax after payment:", error);
          await db.update(transactions).set({
            status: "failed",
            error: error instanceof Error ? error.message : "Failed to send fax"
          }).where(eq(transactions.stripeSessionId, session.id));
        }
      }
      res.json({ received: true });
    } catch (error) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ error: "Webhook signature verification failed" });
    }
  });
}

// server/documo.ts
import axios2 from "axios";
import { eq as eq2 } from "drizzle-orm";
var hasDocomoApiKey2 = !!process.env.DOCUMO_API_KEY;
console.log("Documo API Key exists:", hasDocomoApiKey2);
var documoClient2 = axios2.create({
  baseURL: "https://api.documo.com/v1",
  headers: {
    Authorization: hasDocomoApiKey2 ? `Bearer ${process.env.DOCUMO_API_KEY}` : "",
    "Content-Type": "application/json"
  }
});
function setupDocomoRoutes(app2) {
  app2.post("/api/documo/webhook", async (req, res) => {
    const { faxId, status } = req.body;
    try {
      await db.update(transactions).set({ status }).where(eq2(transactions.documoFaxId, faxId));
      res.json({ success: true });
    } catch (error) {
      console.error("Documo webhook error:", error);
      res.status(500).json({ error: "Failed to update fax status" });
    }
  });
}

// server/swagger.ts
import swaggerUi from "swagger-ui-express";
var swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "International Fax API",
    version: "1.0.0",
    description: "API documentation for testing fax transmission functionality. This API allows you to send faxes internationally, calculate pricing, and track fax status.",
    contact: {
      name: "API Support",
      email: "support@example.com"
    }
  },
  servers: [
    {
      url: "/api",
      description: "Development server"
    }
  ],
  tags: [
    {
      name: "Pricing",
      description: "Endpoints for calculating fax transmission costs"
    },
    {
      name: "Fax",
      description: "Endpoints for sending and tracking faxes"
    },
    {
      name: "Payment",
      description: "Endpoints for handling payments"
    }
  ],
  paths: {
    "/price": {
      get: {
        tags: ["Pricing"],
        summary: "Calculate fax price",
        description: "Calculate the total cost for sending a fax based on the destination country and number of pages",
        parameters: [
          {
            name: "country",
            in: "query",
            required: true,
            description: "Two-letter country code (ISO 3166-1 alpha-2)",
            schema: {
              type: "string",
              example: "US",
              pattern: "^[A-Z]{2}$"
            }
          },
          {
            name: "pages",
            in: "query",
            required: true,
            description: "Number of pages to send",
            schema: {
              type: "integer",
              minimum: 1,
              example: 1
            }
          }
        ],
        responses: {
          200: {
            description: "Price calculation successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: {
                      type: "number",
                      format: "float",
                      description: "Total price in USD",
                      example: 0.1
                    }
                  }
                },
                examples: {
                  US: {
                    value: { total: 0.1 },
                    summary: "US single page"
                  },
                  International: {
                    value: { total: 0.15 },
                    summary: "International single page"
                  },
                  MultiPage: {
                    value: { total: 0.3 },
                    summary: "US three pages"
                  }
                }
              }
            }
          },
          400: {
            description: "Invalid input parameters",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Invalid country code or page count"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/send-fax": {
      post: {
        tags: ["Fax"],
        summary: "Send a fax",
        description: "Upload files and send them as a fax to the specified recipient",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  files: {
                    type: "array",
                    items: {
                      type: "string",
                      format: "binary"
                    },
                    description: "PDF or image files to send (max 10MB per file)"
                  },
                  countryCode: {
                    type: "string",
                    pattern: "^[A-Z]{2}$",
                    example: "US",
                    description: "Two-letter country code (ISO 3166-1 alpha-2)"
                  },
                  recipientNumber: {
                    type: "string",
                    pattern: "^\\+[1-9]\\d{1,14}$",
                    example: "+1234567890",
                    description: "E.164 formatted recipient fax number"
                  },
                  paymentIntentId: {
                    type: "string",
                    example: "pi_xxx",
                    description: "Stripe payment intent ID from successful payment"
                  }
                },
                required: ["files", "countryCode", "recipientNumber", "paymentIntentId"]
              }
            }
          }
        },
        responses: {
          200: {
            description: "Fax queued for sending",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    transactionId: {
                      type: "string",
                      description: "Unique identifier for tracking the fax status",
                      example: "123"
                    }
                  }
                }
              }
            }
          },
          400: {
            description: "Invalid input",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Invalid phone number format"
                    }
                  }
                },
                examples: {
                  invalidNumber: {
                    value: { error: "Invalid phone number format" },
                    summary: "Invalid phone number"
                  },
                  invalidCountry: {
                    value: { error: "Invalid country code" },
                    summary: "Invalid country code"
                  },
                  invalidPayment: {
                    value: { error: "Invalid payment intent ID" },
                    summary: "Invalid payment"
                  }
                }
              }
            }
          },
          500: {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Failed to process fax"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/fax-status/{transactionId}": {
      get: {
        tags: ["Fax"],
        summary: "Get fax status",
        description: "Retrieve the current status of a fax transmission",
        parameters: [
          {
            name: "transactionId",
            in: "path",
            required: true,
            description: "The transaction ID returned from the send-fax endpoint",
            schema: {
              type: "string"
            }
          }
        ],
        responses: {
          200: {
            description: "Fax status retrieved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      enum: ["processing", "completed", "failed"],
                      description: "Current status of the fax transmission"
                    }
                  }
                },
                examples: {
                  processing: {
                    value: { status: "processing" },
                    summary: "Fax is being processed"
                  },
                  completed: {
                    value: { status: "completed" },
                    summary: "Fax was sent successfully"
                  },
                  failed: {
                    value: { status: "failed" },
                    summary: "Fax transmission failed"
                  }
                }
              }
            }
          },
          404: {
            description: "Transaction not found",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Transaction not found"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/create-payment": {
      post: {
        tags: ["Payment"],
        summary: "Create a payment session",
        description: "Create a Stripe checkout session for fax payment",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  countryCode: {
                    type: "string",
                    description: "Two-letter country code (ISO 3166-1 alpha-2)",
                    example: "US"
                  },
                  pageCount: {
                    type: "integer",
                    description: "Number of pages to send",
                    minimum: 1,
                    example: 1
                  }
                },
                required: ["countryCode", "pageCount"]
              }
            }
          }
        },
        responses: {
          200: {
            description: "Payment session created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    sessionId: {
                      type: "string",
                      description: "Stripe checkout session ID",
                      example: "cs_test_xxx"
                    }
                  }
                }
              }
            }
          },
          400: {
            description: "Invalid input parameters",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Invalid page count"
                    }
                  }
                }
              }
            }
          },
          500: {
            description: "Server error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                      example: "Failed to create payment session"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
function setupSwagger(app2) {
  app2.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// server/routes.ts
import multer from "multer";
import { eq as eq3 } from "drizzle-orm";
var upload = multer({ storage: multer.memoryStorage() });
var BASE_PRICE2 = 0.4;
function registerRoutes(app2) {
  const server2 = createServer(app2);
  setupSwagger(app2);
  app2.get("/api/stripe/config", (req, res) => {
    console.log("Stripe config request received");
    const publishableKey = process.env.VITE_STRIPE_PUBLIC_KEY;
    if (!publishableKey) {
      console.error("VITE_STRIPE_PUBLIC_KEY is not set");
      return res.status(500).json({ error: "Stripe configuration is missing" });
    }
    const response = {
      publishableKey
    };
    console.log("Sending Stripe config response:", { ...response, publishableKey: "***" });
    res.json(response);
  });
  app2.get("/api/debug/env", (req, res) => {
    res.json({
      hasStripePublicKey: !!process.env.VITE_STRIPE_PUBLIC_KEY,
      hasStripeSecretKey: !!process.env.STRIPE_SECRET_KEY,
      hasDocomoApiKey: !!process.env.DOCUMO_API_KEY,
      stripePublicKey: process.env.VITE_STRIPE_PUBLIC_KEY?.substring(0, 8) + "..."
    });
  });
  app2.get("/api/price", async (req, res) => {
    const { country, pages } = req.query;
    console.log("Price calculation request:", { country, pages });
    const countryMultiplier = country === "US" ? 1 : 1.5;
    const total = Number(pages) * BASE_PRICE2 * countryMultiplier;
    console.log("Price calculation result:", { total, basePrice: BASE_PRICE2, countryMultiplier });
    res.json({ total });
  });
  setupStripeRoutes(app2);
  setupDocomoRoutes(app2);
  app2.post("/api/send-fax", upload.array("files"), async (req, res) => {
    try {
      const files = req.files || [];
      const { countryCode, recipientNumber, paymentIntentId } = req.body;
      if (paymentIntentId === "test") {
        console.log("Test mode: Bypassing payment verification");
      } else if (!paymentIntentId.startsWith("pi_")) {
        return res.status(400).json({ error: "Invalid payment intent ID" });
      }
      const [transaction] = await db.insert(transactions).values({
        status: "processing",
        recipientNumber,
        countryCode,
        pageCount: files.length,
        amount: "0",
        // Will be updated after payment confirmation
        stripeSessionId: paymentIntentId,
        documoFaxId: "",
        // Will be updated after fax is sent
        files: files.map((f) => Buffer.from(f.buffer).toString("base64")),
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).returning();
      const faxId = await sendFax(
        transaction.files,
        recipientNumber
      );
      await db.update(transactions).set({ documoFaxId: faxId }).where(eq3(transactions.id, transaction.id));
      res.json({ transactionId: transaction.id });
    } catch (error) {
      console.error("Fax sending error:", error);
      res.status(500).json({ error: "Failed to process fax" });
    }
  });
  app2.get("/api/fax-status/:transactionId", async (req, res) => {
    try {
      const { transactionId } = req.params;
      const transaction = await db.select().from(transactions).where(eq3(transactions.id, parseInt(transactionId))).limit(1).then((results) => results[0]);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json({ status: transaction.status });
    } catch (error) {
      console.error("Fax status error:", error);
      res.status(500).json({ error: "Failed to fetch fax status" });
    }
  });
  app2.get("/api/transaction/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const transaction = await db.select().from(transactions).where(eq3(transactions.stripeSessionId, sessionId)).then((results) => results[0]);
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
  app2.post("/api/store-fax", upload.array("files"), async (req, res) => {
    try {
      const files = req.files || [];
      const { countryCode, recipientNumber, stripeSessionId } = req.body;
      if (!stripeSessionId) {
        return res.status(400).json({ error: "Missing Stripe session ID" });
      }
      const base64Files = files.map(
        (file) => Buffer.from(file.buffer).toString("base64")
      );
      const [transaction] = await db.insert(transactions).values({
        status: "pending",
        recipientNumber,
        countryCode,
        pageCount: files.length,
        amount: "0",
        // Will be updated after payment confirmation
        stripeSessionId,
        documoFaxId: "",
        // Will be updated after fax is sent
        files: base64Files,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      }).returning();
      res.json({ success: true });
    } catch (error) {
      console.error("Store fax error:", error);
      res.status(500).json({ error: "Failed to store fax details" });
    }
  });
  return server2;
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path2, { dirname as dirname2 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
console.log("Vite config - VITE_STRIPE_PUBLIC_KEY:", process.env.VITE_STRIPE_PUBLIC_KEY);
var vite_config_default = defineConfig({
  plugins: [react(), runtimeErrorOverlay(), themePlugin()],
  resolve: {
    alias: {
      "@db": path.resolve(__dirname, "db"),
      "@": path.resolve(__dirname, "client", "src")
    }
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true
  },
  envPrefix: "VITE_",
  define: {
    "process.env.VITE_STRIPE_PUBLIC_KEY": JSON.stringify(process.env.VITE_STRIPE_PUBLIC_KEY)
  },
  server: {
    host: "0.0.0.0",
    hmr: {
      clientPort: 443,
      protocol: "wss"
    },
    watch: {
      usePolling: true
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    }
  }
});

// server/vite.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = dirname2(__filename2);
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server2) {
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        if (msg.includes("[TypeScript] Found 0 errors. Watching for file changes")) {
          log("no errors found", "tsc");
          return;
        }
        if (msg.includes("[TypeScript] ")) {
          const [errors, summary] = msg.split("[TypeScript] ", 2);
          log(`${summary} ${errors}\x1B[0m`, "tsc");
          return;
        } else {
          viteLogger.error(msg, options);
          process.exit(1);
        }
      }
    },
    server: {
      middlewareMode: true,
      hmr: { server: server2 }
    },
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        __dirname2,
        "..",
        "client",
        "index.html"
      );
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
var serveStatic = (app2) => {
  const distPath = path2.resolve(__dirname2, "..", "dist", "public");
  console.log("Serving static files from:", distPath);
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (req, res) => {
    if (req.originalUrl.startsWith("/api")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const indexPath = path2.join(distPath, "index.html");
    if (!fs.existsSync(indexPath)) {
      res.status(500).send("index.html not found. Please rebuild the application.");
      return;
    }
    res.sendFile(indexPath);
  });
};

// server/index.ts
import cors from "cors";
import { createServer as createServer2 } from "http";
var app = express3();
var server = createServer2(app);
app.use(cors({
  origin: true,
  credentials: true
}));
app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    next();
  } else {
    express3.json()(req, res, next);
  }
});
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  console.log("Environment variables check:");
  console.log("- VITE_STRIPE_PUBLIC_KEY exists:", !!process.env.VITE_STRIPE_PUBLIC_KEY);
  console.log("- STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY);
  console.log("- DOCUMO_API_KEY exists:", !!process.env.DOCUMO_API_KEY);
  registerRoutes(app);
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      console.log(`Replit URL: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    }
  });
})();
