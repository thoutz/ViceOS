import { Router, type IRouter } from "express";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@workspace/db";
import { gameSessionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireCampaignMember, requireDm, getEffectiveUserId, getEffectiveUsername } from "../middlewares/auth";
import { param } from "../types";
import { loadSessionForAI } from "../services/load-session-for-ai";
import { runDmStoryAssistant } from "../services/groq-dm-story-assistant";

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
  const started = new Date();
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
      startedAt: started,
    })
    .returning();
  res.status(201).json(session);
});

router.get(
  "/campaigns/:campaignId/sessions/:sessionId/ai-context",
  requireAuth,
  requireCampaignMember,
  requireDm,
  async (req, res) => {
    const campaignId = param(req.params.campaignId);
    const sessionId = param(req.params.sessionId);
    const payload = await loadSessionForAI(campaignId, sessionId);
    if (!payload) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(payload);
  },
);

router.post(
  "/campaigns/:campaignId/sessions/:sessionId/ai-story-assistant",
  requireAuth,
  requireCampaignMember,
  requireDm,
  async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({ error: "Groq is not configured (set GROQ_API_KEY on the server)" });
      return;
    }

    const campaignId = param(req.params.campaignId);
    const sessionId = param(req.params.sessionId);
    const body = req.body as { message?: string; includeSessionContext?: boolean };
    const message = typeof body.message === "string" ? body.message : "";
    if (!message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    if (message.length > 12000) {
      res.status(400).json({ error: "message is too long (max 12000 characters)" });
      return;
    }

    const includeSessionContext = body.includeSessionContext !== false;

    let sessionContextText: string | undefined;
    if (includeSessionContext) {
      const ctx = await loadSessionForAI(campaignId, sessionId);
      if (!ctx) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      sessionContextText = ctx.compiledNarrativeContext;
    }

    try {
      const result = await runDmStoryAssistant({
        apiKey,
        userMessage: message.trim(),
        sessionContextText,
      });
      res.json(result);
    } catch (err) {
      console.error("Groq DM story assistant failed", err);
      res.status(502).json({
        error: err instanceof Error ? err.message : "Groq request failed",
      });
    }
  },
);

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
  const {
    name,
    status,
    activeMapId,
    initiativeOrder,
    currentTurnIndex,
    roundNumber,
    storyLog,
    locationsData,
    itemsData,
    openThreads,
    messageHistory,
    startedAt,
    endedAt,
    sessionNumber,
  } = req.body as Record<string, unknown>;

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (status !== undefined) updates.status = status;
  if (activeMapId !== undefined) updates.activeMapId = activeMapId;
  if (initiativeOrder !== undefined) updates.initiativeOrder = initiativeOrder;
  if (currentTurnIndex !== undefined) updates.currentTurnIndex = currentTurnIndex;
  if (roundNumber !== undefined) updates.roundNumber = roundNumber;
  if (storyLog !== undefined) updates.storyLog = storyLog;
  if (locationsData !== undefined) updates.locationsData = locationsData;
  if (itemsData !== undefined) updates.itemsData = itemsData;
  if (openThreads !== undefined) updates.openThreads = openThreads;
  if (messageHistory !== undefined) updates.messageHistory = messageHistory;
  if (sessionNumber !== undefined) updates.sessionNumber = sessionNumber;
  if (startedAt !== undefined) updates.startedAt = startedAt === null ? null : new Date(String(startedAt));
  if (endedAt !== undefined) updates.endedAt = endedAt === null ? null : new Date(String(endedAt));

  const [session] = await db
    .update(gameSessionsTable)
    .set({ ...updates, updatedAt: new Date() })
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
