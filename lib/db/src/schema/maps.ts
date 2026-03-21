import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { campaignsTable } from "./campaigns";

export const mapsTable = pgTable("maps", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").notNull().references(() => campaignsTable.id),
  name: text("name").notNull(),
  imageData: text("image_data"),
  gridConfig: jsonb("grid_config").notNull().default({ size: 50, type: "square", visible: true, snapToGrid: true, cellFeet: 5 }),
  fogData: jsonb("fog_data").default({}),
  tokens: jsonb("tokens").notNull().default([]),
  dmNotes: text("dm_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertMapSchema = createInsertSchema(mapsTable).omit({ id: true, createdAt: true });
export type InsertMap = z.infer<typeof insertMapSchema>;
export type GameMap = typeof mapsTable.$inferSelect;
