import { type Express } from "express";
import swaggerUi from "swagger-ui-express";

const swaggerDocument = {
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
      description: "Development server",
    },
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
            },
          },
          {
            name: "pages",
            in: "query",
            required: true,
            description: "Number of pages to send",
            schema: {
              type: "integer",
              minimum: 1,
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
                      format: "float",
                      description: "Total price in USD",
                      example: 0.10,
                    },
                  },
                },
                examples: {
                  US: {
                    value: { total: 0.10 },
                    summary: "US single page"
                  },
                  International: {
                    value: { total: 0.15 },
                    summary: "International single page"
                  },
                  MultiPage: {
                    value: { total: 0.30 },
                    summary: "US three pages"
                  }
                }
              },
            },
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
        },
      },
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
                      format: "binary",
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
                  },
                },
                required: ["files", "countryCode", "recipientNumber", "paymentIntentId"],
              },
            },
          },
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
                      example: "123",
                    },
                  },
                },
              },
            },
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
                    },
                  },
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
              },
            },
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
                      description: "Current status of the fax transmission"
                    },
                  },
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
              },
            },
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
        },
      },
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

export function setupSwagger(app: Express) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
