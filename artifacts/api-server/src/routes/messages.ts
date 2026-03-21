import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { messagesTable, campaignMembersTable, usersTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

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

router.get("/campaigns/:campaignId/sessions/:sessionId/messages", requireAuth, requireCampaignMember, async (req, res) => {
  const { sessionId } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;
  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.sessionId, sessionId))
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit);
  res.json(messages.reverse());
});

router.post("/campaigns/:campaignId/sessions/:sessionId/messages", requireAuth, requireCampaignMember, async (req, res) => {
  const userId = (req.session as any).userId;
  const { sessionId } = req.params;
  const { content, type, recipientId, diceData } = req.body;

  if (!content) {
    res.status(400).json({ error: "Content is required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const senderName = user?.username || "Unknown";

  const [message] = await db.insert(messagesTable).values({
    sessionId,
    senderId: userId,
    senderName,
    recipientId: recipientId || null,
    content,
    type: type || "chat",
    diceData: diceData || null,
  }).returning();

  res.status(201).json(message);
});

export default router;
