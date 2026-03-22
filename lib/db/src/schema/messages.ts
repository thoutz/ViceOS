import { pgTable, text, timestamp, uuid, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { gameSessionsTable } from "./sessions";
import { usersTable } from "./users";

export const messagesTable = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => gameSessionsTable.id),
  senderId: uuid("sender_id").notNull().references(() => usersTable.id),
  senderName: text("sender_name").notNull(),
  recipientId: uuid("recipient_id"),
  content: text("content").notNull(),
  type: text("type").notNull().default("chat"),
  diceData: jsonb("dice_data"),
  /** DM-only: include this line in story-assistant compiled context (any message type). */
  pinnedForStoryAi: boolean("pinned_for_story_ai").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
