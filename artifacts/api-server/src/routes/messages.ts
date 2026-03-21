import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, usersTable, gameSessionsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireCampaignMember, getEffectiveUserId } from "../middlewares/auth";
import { param } from "../types";

const router: IRouter = Router();

router.get(
  "/campaigns/:campaignId/sessions/:sessionId/messages",
  requireAuth,
  requireCampaignMember,
  async (req, res) => {
    const campaignId = param(req.params.campaignId);
    const sessionId = param(req.params.sessionId);
    const userId = getEffectiveUserId(req)!;
    const member = req.campaignMember;

    const [session] = await db
      .select()
      .from(gameSessionsTable)
      .where(and(eq(gameSessionsTable.id, sessionId), eq(gameSessionsTable.campaignId, campaignId)));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const limit = Math.min(parseInt((req.query.limit as string) || "100", 10), 200);
    const allMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, sessionId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);

    const isDm = member?.role === "dm";
    const visible = allMessages.filter((m) => {
      if (m.type !== "whisper") return true;
      // DM sees all whispers
      if (isDm) return true;
      // Players see whispers they sent or received
      return m.senderId === userId || m.recipientId === userId;
    });

    res.json(visible.reverse());
  }
);

router.post(
  "/campaigns/:campaignId/sessions/:sessionId/messages",
  requireAuth,
  requireCampaignMember,
  async (req, res) => {
    const userId = getEffectiveUserId(req)!;
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

    const { content, type, recipientId, diceData } = req.body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      res.status(400).json({ error: "Content is required" });
      return;
    }

    // Whispers are allowed from anyone — players can whisper to the DM and vice versa
    // If a player sends a whisper without a recipientId, it goes to DM (server resolves DM userId)
    let resolvedRecipientId: string | null = recipientId || null;
    if (type === "whisper" && !resolvedRecipientId) {
      // Find the DM of this campaign
      const { campaignMembersTable } = await import("@workspace/db/schema");
      const [dmMember] = await db
        .select()
        .from(campaignMembersTable)
        .where(and(eq(campaignMembersTable.campaignId, campaignId), eq(campaignMembersTable.role, "dm")));
      if (dmMember) {
        resolvedRecipientId = dmMember.userId;
      }
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const senderName = user?.username || "Unknown";

    const [message] = await db
      .insert(messagesTable)
      .values({
        sessionId,
        senderId: userId,
        senderName,
        recipientId: resolvedRecipientId,
        content: content.trim(),
        type: type || "chat",
        diceData: diceData || null,
      })
      .returning();

    res.status(201).json(message);
  }
);

export default router;
