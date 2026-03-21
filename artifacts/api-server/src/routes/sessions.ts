import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { gameSessionsTable, campaignMembersTable } from "@workspace/db/schema";
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

router.get("/campaigns/:campaignId/sessions", requireAuth, requireCampaignMember, async (req, res) => {
  const { campaignId } = req.params;
  const sessions = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.campaignId, campaignId));
  res.json(sessions);
});

router.post("/campaigns/:campaignId/sessions", requireAuth, requireCampaignMember, async (req, res) => {
  const { campaignId } = req.params;
  const name = req.body?.name || `Session ${new Date().toLocaleDateString()}`;
  const [session] = await db.insert(gameSessionsTable).values({
    campaignId,
    name,
    initiativeOrder: [],
    currentTurnIndex: 0,
    roundNumber: 1,
    status: "active",
  }).returning();
  res.status(201).json(session);
});

router.get("/campaigns/:campaignId/sessions/:sessionId", requireAuth, requireCampaignMember, async (req, res) => {
  const { sessionId } = req.params;
  const [session] = await db.select().from(gameSessionsTable).where(eq(gameSessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.put("/campaigns/:campaignId/sessions/:sessionId", requireAuth, requireCampaignMember, async (req, res) => {
  const { sessionId } = req.params;
  const updates = req.body;
  const [session] = await db.update(gameSessionsTable).set(updates).where(eq(gameSessionsTable.id, sessionId)).returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

export default router;
