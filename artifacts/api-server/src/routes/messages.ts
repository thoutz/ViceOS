import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, usersTable, gameSessionsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireCampaignMember } from "../middlewares/auth";
import "../types";

const router: IRouter = Router();

router.get(
  "/campaigns/:campaignId/sessions/:sessionId/messages",
  requireAuth,
  requireCampaignMember,
  async (req, res) => {
    const { campaignId, sessionId } = req.params;

    const [session] = await db
      .select()
      .from(gameSessionsTable)
      .where(and(eq(gameSessionsTable.id, sessionId), eq(gameSessionsTable.campaignId, campaignId)));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const limit = Math.min(parseInt((req.query.limit as string) || "100", 10), 200);
    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, sessionId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);

    res.json(messages.reverse());
  }
);

router.post(
  "/campaigns/:campaignId/sessions/:sessionId/messages",
  requireAuth,
  requireCampaignMember,
  async (req, res) => {
    const userId = req.session.userId!;
    const { campaignId, sessionId } = req.params;
    const member = (req as any).campaignMember;

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

    if (type === "whisper" && !member.isDm && recipientId !== userId) {
      res.status(403).json({ error: "Only DMs can send whispers" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    const senderName = user?.username || "Unknown";

    const [message] = await db
      .insert(messagesTable)
      .values({
        sessionId,
        senderId: userId,
        senderName,
        recipientId: recipientId || null,
        content: content.trim(),
        type: type || "chat",
        diceData: diceData || null,
      })
      .returning();

    res.status(201).json(message);
  }
);

export default router;
