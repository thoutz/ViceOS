import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { campaignsTable, campaignMembersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAuth } from "../middlewares/auth";
import { param } from "../types";

const router: IRouter = Router();

router.get("/campaigns", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const memberships = await db
    .select()
    .from(campaignMembersTable)
    .where(eq(campaignMembersTable.userId, userId));

  if (memberships.length === 0) {
    res.json([]);
    return;
  }

  const campaignIds = memberships.map((m) => m.campaignId);
  const campaigns = await db
    .select()
    .from(campaignsTable)
    .where(inArray(campaignsTable.id, campaignIds));

  const membershipMap = Object.fromEntries(memberships.map((m) => [m.campaignId, m]));
  const result = campaigns.map((c) => ({
    ...c,
    role: membershipMap[c.id]?.role || "player",
  }));

  res.json(result);
});

router.post("/campaigns", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { name, description, gameSystem } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const inviteCode = nanoid(8).toUpperCase();
  const [campaign] = await db
    .insert(campaignsTable)
    .values({
      name: name.trim(),
      description: description || null,
      gameSystem: gameSystem || "D&D 5e",
      inviteCode,
      dmUserId: userId,
    })
    .returning();

  await db.insert(campaignMembersTable).values({
    campaignId: campaign.id,
    userId,
    role: "dm",
  });

  res.status(201).json({ ...campaign, role: "dm" });
});

router.post("/campaigns/join", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { inviteCode } = req.body;
  if (!inviteCode) {
    res.status(400).json({ error: "Invite code is required" });
    return;
  }
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.inviteCode, inviteCode.toUpperCase()));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const [existing] = await db
    .select()
    .from(campaignMembersTable)
    .where(and(eq(campaignMembersTable.campaignId, campaign.id), eq(campaignMembersTable.userId, userId)));

  if (!existing) {
    await db.insert(campaignMembersTable).values({
      campaignId: campaign.id,
      userId,
      role: "player",
    });
  }
  const role = campaign.dmUserId === userId ? "dm" : "player";
  res.json({ ...campaign, role });
});

router.get("/campaigns/:campaignId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const campaignId = param(req.params.campaignId);

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const [member] = await db
    .select()
    .from(campaignMembersTable)
    .where(and(eq(campaignMembersTable.campaignId, campaignId), eq(campaignMembersTable.userId, userId)));

  if (!member) {
    res.status(403).json({ error: "Not a member of this campaign" });
    return;
  }

  res.json({ ...campaign, role: member.role });
});

export default router;
