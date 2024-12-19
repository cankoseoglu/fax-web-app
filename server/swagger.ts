import { type Express } from "express";
import swaggerUi from "swagger-ui-express";

const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "International Fax API",
    version: "1.0.0",
    description: "API documentation for testing fax transmission functionality",
  },
  servers: [
    {
      url: "/api",
      description: "Development server",
    },
  ],
  paths: {
    "/price": {
      get: {
        summary: "Calculate fax price",
        parameters: [
          {
            name: "country",
            in: "query",
            required: true,
            schema: {
              type: "string",
              example: "US",
            },
          },
          {
            name: "pages",
            in: "query",
            required: true,
            schema: {
              type: "number",
              example: 1,
            },
          },
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
                      example: 0.10,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/send-fax": {
      post: {
        summary: "Send a fax",
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
                      format: "binary",
                    },
                  },
                  countryCode: {
                    type: "string",
                    example: "US",
                  },
                  recipientNumber: {
                    type: "string",
                    example: "+1234567890",
                  },
                  paymentIntentId: {
                    type: "string",
                    example: "pi_xxx",
                  },
                },
                required: ["files", "countryCode", "recipientNumber", "paymentIntentId"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Fax sent successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    transactionId: {
                      type: "string",
                      example: "123",
                    },
                  },
                },
              },
            },
          },
          500: {
            description: "Error sending fax",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: {
                      type: "string",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/fax-status/{transactionId}": {
      get: {
        summary: "Get fax status",
        parameters: [
          {
            name: "transactionId",
            in: "path",
            required: true,
            schema: {
              type: "string",
            },
          },
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
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export function setupSwagger(app: Express) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
