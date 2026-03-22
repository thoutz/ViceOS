import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { charactersTable } from "./characters";
import { usersTable } from "./users";

export const campaignMembersTable = pgTable("campaign_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  /** When set, this membership row is bound to a specific character sheet. */
  characterId: uuid("character_id").references(() => charactersTable.id, {
    onDelete: "cascade",
  }),
  role: text("role").notNull().default("player"),
  status: text("status").notNull().default("accepted"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaignInvitesTable = pgTable("campaign_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaignsTable.id, { onDelete: "cascade" }),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => usersTable.id),
  invitedUserId: uuid("invited_user_id").references(() => usersTable.id),
  inviteCode: text("invite_code").notNull().unique(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCampaignMemberSchema = createInsertSchema(campaignMembersTable).omit({
  id: true,
  joinedAt: true,
});
export const insertCampaignInviteSchema = createInsertSchema(campaignInvitesTable).omit({
  id: true,
  createdAt: true,
});

export type CampaignMember = typeof campaignMembersTable.$inferSelect;
export type CampaignInvite = typeof campaignInvitesTable.$inferSelect;
