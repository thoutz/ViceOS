import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";
import { usersTable } from "./users";

export const charactersTable = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** When set, character is tied to a campaign (VTT + legacy flow). Pool-only sheets leave this null. */
  campaignId: uuid("campaign_id").references(() => campaignsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => usersTable.id),
  name: text("name").notNull(),
  race: text("race"),
  subrace: text("subrace"),
  class: text("class"),
  subclass: text("subclass"),
  background: text("background"),
  alignment: text("alignment"),
  level: integer("level").notNull().default(1),
  hp: integer("hp").notNull().default(10),
  maxHp: integer("max_hp").notNull().default(10),
  tempHp: integer("temp_hp").notNull().default(0),
  ac: integer("ac").notNull().default(10),
  speed: integer("speed").notNull().default(30),
  initiativeBonus: integer("initiative_bonus").notNull().default(0),
  /** Optional explicit ability scores (also mirrored in `stats` for the VTT). */
  strength: integer("strength"),
  dexterity: integer("dexterity"),
  constitution: integer("constitution"),
  intelligence: integer("intelligence"),
  wisdom: integer("wisdom"),
  charisma: integer("charisma"),
  stats: jsonb("stats")
    .notNull()
    .default({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
  sheetData: jsonb("sheet_data").default({}),
  personality: text("personality"),
  backstory: text("backstory"),
  ideals: text("ideals"),
  bonds: text("bonds"),
  flaws: text("flaws"),
  appearance: text("appearance"),
  notes: text("notes"),
  avatarUrl: text("avatar_url"),
  /** Full-page background image URL or data URL (hero studio / dashboard sheet). */
  sheetBackgroundUrl: text("sheet_background_url"),
  gameSystem: text("game_system").notNull().default("D&D 5e"),
  isActive: boolean("is_active").notNull().default(true),
  tokenColor: text("token_color").default("#C9A84C"),
  isNpc: boolean("is_npc").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCharacterSchema = createInsertSchema(charactersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof charactersTable.$inferSelect;
