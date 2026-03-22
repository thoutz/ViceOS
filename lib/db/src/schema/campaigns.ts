import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const campaignsTable = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  gameSystem: text("game_system").notNull().default("D&D 5e"),
  setting: text("setting"),
  startingLocation: text("starting_location"),
  tone: text("tone"),
  houseRules: text("house_rules"),
  status: text("status").notNull().default("recruiting"),
  inviteCode: text("invite_code").notNull().unique(),
  dmUserId: uuid("dm_user_id").notNull().references(() => usersTable.id),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
