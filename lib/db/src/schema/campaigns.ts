import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const campaignsTable = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  gameSystem: text("game_system").notNull().default("D&D 5e"),
  inviteCode: text("invite_code").notNull().unique(),
  dmUserId: uuid("dm_user_id").notNull().references(() => usersTable.id),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignMembersTable = pgTable("campaign_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull().default("player"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCampaignSchema = createInsertSchema(campaignsTable).omit({ id: true, createdAt: true });
export const insertCampaignMemberSchema = createInsertSchema(campaignMembersTable).omit({ id: true, joinedAt: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaignsTable.$inferSelect;
export type CampaignMember = typeof campaignMembersTable.$inferSelect;
