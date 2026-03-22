import { pgTable, text, timestamp, uuid, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { usersTable } from "./users";

export const gameSessionsTable = pgTable("game_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id),
  name: text("name").notNull().default("New Session"),
  sessionNumber: integer("session_number").notNull().default(1),
  dmUserId: uuid("dm_user_id").references(() => usersTable.id),
  activeMapId: uuid("active_map_id"),
  initiativeOrder: jsonb("initiative_order").notNull().default([]),
  currentTurnIndex: integer("current_turn_index").notNull().default(0),
  roundNumber: integer("round_number").notNull().default(1),
  status: text("status").notNull().default("active"),
  storyLog: jsonb("story_log").notNull().default([]),
  locationsData: jsonb("locations_data").notNull().default([]),
  itemsData: jsonb("items_data").notNull().default([]),
  openThreads: jsonb("open_threads").notNull().default([]),
  messageHistory: jsonb("message_history").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGameSessionSchema = createInsertSchema(gameSessionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessionsTable.$inferSelect;
