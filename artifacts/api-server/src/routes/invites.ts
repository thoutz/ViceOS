import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  campaignInvitesTable,
  campaignMembersTable,
  campaignsTable,
  charactersTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, getEffectiveUserId } from "../middlewares/auth";
import { param } from "../types";

const router: IRouter = Router();

/** GET /api/invites/pending */
router.get("/invites/pending", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;

  const rows = await db
    .select({
      invite: campaignInvitesTable,
      campaignName: campaignsTable.name,
      campaignInviteCode: campaignsTable.inviteCode,
      invitedByUsername: usersTable.username,
    })
    .from(campaignInvitesTable)
    .innerJoin(campaignsTable, eq(campaignInvitesTable.campaignId, campaignsTable.id))
    .innerJoin(usersTable, eq(campaignInvitesTable.invitedBy, usersTable.id))
    .where(
      and(
        eq(campaignInvitesTable.invitedUserId, userId),
        eq(campaignInvitesTable.status, "pending"),
      ),
    );

  const payload = rows.map((r) => ({
    id: r.invite.id,
    campaignId: r.invite.campaignId,
    campaignName: r.campaignName,
    campaignInviteCode: r.campaignInviteCode,
    inviteCode: r.invite.inviteCode,
    invitedByUserId: r.invite.invitedBy,
    invitedByUsername: r.invitedByUsername,
    status: r.invite.status,
    expiresAt: r.invite.expiresAt,
    createdAt: r.invite.createdAt,
  }));

  res.json(payload);
});

/** POST /api/invites/:inviteId/accept */
router.post("/invites/:inviteId/accept", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const inviteId = param(req.params.inviteId);
  const characterId = (req.body as { characterId?: string })?.characterId;

  const [invite] = await db
    .select()
    .from(campaignInvitesTable)
    .where(eq(campaignInvitesTable.id, inviteId));

  if (!invite || invite.invitedUserId !== userId) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  if (invite.status !== "pending") {
    res.status(400).json({ error: "Invite is no longer pending" });
    return;
  }
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    res.status(400).json({ error: "Invite has expired" });
    return;
  }

  const campaignId = invite.campaignId;

  if (characterId && typeof characterId === "string") {
    const [character] = await db
      .select()
      .from(charactersTable)
      .where(and(eq(charactersTable.id, characterId), eq(charactersTable.userId, userId)));

    if (!character) {
      res.status(403).json({ error: "Character not found or not yours" });
      return;
    }
    if (character.campaignId != null && character.campaignId !== campaignId) {
      res.status(400).json({ error: "Character belongs to another campaign" });
      return;
    }

    const [dup] = await db
      .select()
      .from(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaignId),
          eq(campaignMembersTable.characterId, characterId),
        ),
      );
    if (dup) {
      res.status(409).json({ error: "Character already in this campaign" });
      return;
    }

    const [legacy] = await db
      .select()
      .from(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaignId),
          eq(campaignMembersTable.userId, userId),
          isNull(campaignMembersTable.characterId),
        ),
      );

    if (legacy) {
      await db
        .update(campaignMembersTable)
        .set({ characterId, role: "player", status: "accepted" })
        .where(eq(campaignMembersTable.id, legacy.id));
    } else {
      await db.insert(campaignMembersTable).values({
        campaignId,
        userId,
        characterId,
        role: "player",
        status: "accepted",
      });
    }
  } else {
    const [existing] = await db
      .select()
      .from(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaignId),
          eq(campaignMembersTable.userId, userId),
        ),
      );
    if (!existing) {
      await db.insert(campaignMembersTable).values({
        campaignId,
        userId,
        role: "player",
        status: "accepted",
      });
    }
  }

  await db
    .update(campaignInvitesTable)
    .set({ status: "accepted" })
    .where(eq(campaignInvitesTable.id, inviteId));

  res.json({ message: "Joined campaign", campaignId });
});

/** POST /api/invites/:inviteId/decline */
router.post("/invites/:inviteId/decline", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const inviteId = param(req.params.inviteId);

  const [invite] = await db
    .select()
    .from(campaignInvitesTable)
    .where(eq(campaignInvitesTable.id, inviteId));

  if (!invite || invite.invitedUserId !== userId) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }
  if (invite.status !== "pending") {
    res.status(400).json({ error: "Invite is no longer pending" });
    return;
  }

  await db
    .update(campaignInvitesTable)
    .set({ status: "declined" })
    .where(eq(campaignInvitesTable.id, inviteId));

  res.json({ message: "Invite declined" });
});

export default router;
