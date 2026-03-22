import { Router, type IRouter } from "express";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@workspace/db";
import { gameSessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireCampaignMember, requireDm, getEffectiveUserId, getEffectiveUsername } from "../middlewares/auth";
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
  const userId = getEffectiveUserId(req)!;
  const name = req.body?.name || `Session ${new Date().toLocaleDateString()}`;
  const [session] = await db
    .insert(gameSessionsTable)
    .values({
      campaignId,
      name,
      dmUserId: userId,
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

router.post(
  "/campaigns/:campaignId/sessions/:sessionId/livekit-token",
  requireAuth,
  requireCampaignMember,
  async (req, res) => {
    const livekitUrl = process.env.LIVEKIT_URL?.trim();
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();

    if (!livekitUrl || !apiKey || !apiSecret) {
      res.status(503).json({ error: "LiveKit is not configured (set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)" });
      return;
    }

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

    const userId = getEffectiveUserId(req)!;
    const displayName = getEffectiveUsername(req) || "Player";
    const roomName = `tavernos-${sessionId}`;

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: displayName,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    res.json({
      token: jwt,
      url: livekitUrl,
      roomName,
    });
  }
);

router.delete("/campaigns/:campaignId/sessions/:sessionId", requireAuth, requireCampaignMember, requireDm, async (req, res) => {
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

  await db
    .delete(gameSessionsTable)
    .where(and(eq(gameSessionsTable.id, sessionId), eq(gameSessionsTable.campaignId, campaignId)));

  res.status(204).send();
});

export default router;
