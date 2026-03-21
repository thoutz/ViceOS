import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { mapsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireCampaignMember, requireDm } from "../middlewares/auth";
import "../types";

const router: IRouter = Router();

router.get("/campaigns/:campaignId/maps", requireAuth, requireCampaignMember, async (req, res) => {
  const { campaignId } = req.params;
  const maps = await db
    .select()
    .from(mapsTable)
    .where(eq(mapsTable.campaignId, campaignId));
  res.json(maps);
});

router.post("/campaigns/:campaignId/maps", requireAuth, requireCampaignMember, requireDm, async (req, res) => {
  const { campaignId } = req.params;
  const { name, imageData, gridConfig } = req.body;
  if (!name) {
    res.status(400).json({ error: "Map name is required" });
    return;
  }
  const [map] = await db
    .insert(mapsTable)
    .values({
      campaignId,
      name,
      imageData: imageData || null,
      gridConfig: gridConfig || { size: 50, type: "square", visible: true, snapToGrid: true, cellFeet: 5 },
      tokens: [],
      fogData: { revealed: [], hidden: [] },
    })
    .returning();
  res.status(201).json(map);
});

router.get("/campaigns/:campaignId/maps/:mapId", requireAuth, requireCampaignMember, async (req, res) => {
  const { campaignId, mapId } = req.params;
  const [map] = await db
    .select()
    .from(mapsTable)
    .where(and(eq(mapsTable.id, mapId), eq(mapsTable.campaignId, campaignId)));
  if (!map) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  res.json(map);
});

router.put("/campaigns/:campaignId/maps/:mapId", requireAuth, requireCampaignMember, requireDm, async (req, res) => {
  const { campaignId, mapId } = req.params;

  const allowed = ['name', 'imageData', 'gridConfig', 'tokens', 'fogData'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const [map] = await db
    .update(mapsTable)
    .set(updates)
    .where(and(eq(mapsTable.id, mapId), eq(mapsTable.campaignId, campaignId)))
    .returning();
  if (!map) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  res.json(map);
});

router.delete("/campaigns/:campaignId/maps/:mapId", requireAuth, requireCampaignMember, requireDm, async (req, res) => {
  const { campaignId, mapId } = req.params;
  const [existing] = await db
    .select()
    .from(mapsTable)
    .where(and(eq(mapsTable.id, mapId), eq(mapsTable.campaignId, campaignId)));
  if (!existing) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  await db.delete(mapsTable).where(and(eq(mapsTable.id, mapId), eq(mapsTable.campaignId, campaignId)));
  res.json({ ok: true });
});

export default router;
