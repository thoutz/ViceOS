import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { mapsTable, campaignMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

async function requireCampaignMember(req: any, res: any, next: any) {
  const userId = (req.session as any).userId;
  const { campaignId } = req.params;
  const [member] = await db.select().from(campaignMembersTable).where(
    and(eq(campaignMembersTable.campaignId, campaignId), eq(campaignMembersTable.userId, userId))
  );
  if (!member) {
    res.status(403).json({ error: "Not a member of this campaign" });
    return;
  }
  (req as any).campaignMember = member;
  next();
}

router.get("/campaigns/:campaignId/maps", requireAuth, requireCampaignMember, async (req, res) => {
  const { campaignId } = req.params;
  const maps = await db.select().from(mapsTable).where(eq(mapsTable.campaignId, campaignId));
  res.json(maps);
});

router.post("/campaigns/:campaignId/maps", requireAuth, requireCampaignMember, async (req, res) => {
  const { campaignId } = req.params;
  const { name, imageData, gridConfig } = req.body;
  if (!name) {
    res.status(400).json({ error: "Map name is required" });
    return;
  }
  const [map] = await db.insert(mapsTable).values({
    campaignId,
    name,
    imageData: imageData || null,
    gridConfig: gridConfig || { size: 50, type: "square", visible: true, snapToGrid: true, cellFeet: 5 },
    tokens: [],
    fogData: {},
  }).returning();
  res.status(201).json(map);
});

router.get("/campaigns/:campaignId/maps/:mapId", requireAuth, requireCampaignMember, async (req, res) => {
  const { mapId } = req.params;
  const [map] = await db.select().from(mapsTable).where(eq(mapsTable.id, mapId));
  if (!map) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  res.json(map);
});

router.put("/campaigns/:campaignId/maps/:mapId", requireAuth, requireCampaignMember, async (req, res) => {
  const { mapId } = req.params;
  const updates = req.body;
  const [map] = await db.update(mapsTable).set(updates).where(eq(mapsTable.id, mapId)).returning();
  if (!map) {
    res.status(404).json({ error: "Map not found" });
    return;
  }
  res.json(map);
});

export default router;
