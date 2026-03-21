import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignsTable, campaignMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!(req.session as any)?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.get("/campaigns", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId;
  const memberships = await db.select().from(campaignMembersTable).where(eq(campaignMembersTable.userId, userId));
  const campaignIds = memberships.map(m => m.campaignId);
  if (campaignIds.length === 0) {
    res.json([]);
    return;
  }
  const campaigns = await db.select().from(campaignsTable);
  const userCampaigns = campaigns.filter(c => campaignIds.includes(c.id));
  const result = userCampaigns.map(c => ({
    ...c,
    role: c.dmUserId === userId ? "dm" : "player",
  }));
  res.json(result);
});

router.post("/campaigns", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId;
  const { name, description, gameSystem } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const inviteCode = nanoid(8).toUpperCase();
  const [campaign] = await db.insert(campaignsTable).values({
    name,
    description,
    gameSystem: gameSystem || "D&D 5e",
    inviteCode,
    dmUserId: userId,
  }).returning();

  await db.insert(campaignMembersTable).values({
    campaignId: campaign.id,
    userId,
    role: "dm",
  });

  res.status(201).json(campaign);
});

router.post("/campaigns/join", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId;
  const { inviteCode } = req.body;
  if (!inviteCode) {
    res.status(400).json({ error: "Invite code is required" });
    return;
  }
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.inviteCode, inviteCode.toUpperCase()));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const existing = await db.select().from(campaignMembersTable).where(
    and(eq(campaignMembersTable.campaignId, campaign.id), eq(campaignMembersTable.userId, userId))
  );
  if (existing.length === 0) {
    await db.insert(campaignMembersTable).values({
      campaignId: campaign.id,
      userId,
      role: "player",
    });
  }
  res.json({ ...campaign, role: campaign.dmUserId === userId ? "dm" : "player" });
});

router.get("/campaigns/:campaignId", requireAuth, async (req, res) => {
  const userId = (req.session as any).userId;
  const { campaignId } = req.params;
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const [member] = await db.select().from(campaignMembersTable).where(
    and(eq(campaignMembersTable.campaignId, campaignId), eq(campaignMembersTable.userId, userId))
  );
  if (!member) {
    res.status(403).json({ error: "Not a member of this campaign" });
    return;
  }
  res.json({ ...campaign, role: campaign.dmUserId === userId ? "dm" : "player" });
});

export default router;
