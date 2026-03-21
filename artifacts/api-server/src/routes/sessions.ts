import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { gameSessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireCampaignMember, requireDm } from "../middlewares/auth";
import { param } from "../types";

const router: IRouter = Router();

router.get("/campaigns/:campaignId/sessions", requireAuth, requireCampaignMember, async (req, res) => {
  const campaignId = param(req.params.campaignId);
  const sessions = await db
    .select()
    .from(gameSessionsTable)
    .where(eq(gameSessionsTable.campaignId, campaignId));
  res.json(sessions);
});

router.post("/campaigns/:campaignId/sessions", requireAuth, requireCampaignMember, requireDm, async (req, res) => {
  const campaignId = param(req.params.campaignId);
  const name = req.body?.name || `Session ${new Date().toLocaleDateString()}`;
  const [session] = await db
    .insert(gameSessionsTable)
    .values({
      campaignId,
      name,
      initiativeOrder: [],
      currentTurnIndex: 0,
      roundNumber: 1,
      status: "active",
    })
    .returning();
  res.status(201).json(session);
});

router.get("/campaigns/:campaignId/sessions/:sessionId", requireAuth, requireCampaignMember, async (req, res) => {
  const campaignId = param(req.params.campaignId);
  const sessionId = param(req.params.sessionId);
  const [session] = await db
    .select()
    .from(gameSessionsTable)
    .where(and(eq(gameSessionsTable.id, sessionId), eq(gameSessionsTable.campaignId, campaignId)));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.put("/campaigns/:campaignId/sessions/:sessionId", requireAuth, requireCampaignMember, requireDm, async (req, res) => {
  const campaignId = param(req.params.campaignId);
  const sessionId = param(req.params.sessionId);
  const { name, status, activeMapId, initiativeOrder, currentTurnIndex, roundNumber } = req.body;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (status !== undefined) updates.status = status;
  if (activeMapId !== undefined) updates.activeMapId = activeMapId;
  if (initiativeOrder !== undefined) updates.initiativeOrder = initiativeOrder;
  if (currentTurnIndex !== undefined) updates.currentTurnIndex = currentTurnIndex;
  if (roundNumber !== undefined) updates.roundNumber = roundNumber;

  const [session] = await db
    .update(gameSessionsTable)
    .set(updates)
    .where(and(eq(gameSessionsTable.id, sessionId), eq(gameSessionsTable.campaignId, campaignId)))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

export default router;
