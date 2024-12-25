import { pgTable, text, serial, timestamp, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Define the valid status values
const TransactionStatus = z.enum(['pending', 'processing', 'completed', 'failed']);

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  status: text("status", { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull(),
  recipientNumber: text("recipient_number").notNull(),
  countryCode: text("country_code").notNull(),
  pageCount: integer("page_count").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  stripeSessionId: text("stripe_session_id").notNull(),
  documoFaxId: text("documo_fax_id").default('').notNull(),
  files: text("files").array().notNull(),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions);
export const selectTransactionSchema = createSelectSchema(transactions);
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// Export the status type for use in other files
export type TransactionStatusType = z.infer<typeof TransactionStatus>;
