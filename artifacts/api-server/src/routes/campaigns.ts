import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  campaignsTable,
  campaignMembersTable,
  campaignInvitesTable,
  gameSessionsTable,
  charactersTable,
  mapsTable,
  messagesTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, inArray, isNull, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAuth, requireCampaignMember, requireDm, getEffectiveUserId } from "../middlewares/auth";
import { param } from "../types";
import { bindFirstVacantPlayerMembership } from "../lib/bind-player-character";

const router: IRouter = Router();

/** GET /api/campaigns — campaigns where user is DM vs player (spec: as_dm / as_player) */
router.get("/campaigns", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;

  const asDm = await db.select().from(campaignsTable).where(eq(campaignsTable.dmUserId, userId));
  const asDmPayload = asDm.map((c) => ({ ...c, role: "dm" as const }));

  const playerRows = await db
    .select({
      campaign: campaignsTable,
      membershipCharacterId: campaignMembersTable.characterId,
    })
    .from(campaignMembersTable)
    .innerJoin(campaignsTable, eq(campaignMembersTable.campaignId, campaignsTable.id))
    .where(
      and(
        eq(campaignMembersTable.userId, userId),
        eq(campaignMembersTable.role, "player"),
        eq(campaignMembersTable.status, "accepted"),
      ),
    );

  /** One entry per campaign; prefer a membership row that already has a character bound. */
  const playerByCampaign = new Map<
    string,
    { campaign: (typeof playerRows)[number]["campaign"]; membershipCharacterId: string | null }
  >();
  for (const row of playerRows) {
    const prev = playerByCampaign.get(row.campaign.id);
    if (!prev) {
      playerByCampaign.set(row.campaign.id, {
        campaign: row.campaign,
        membershipCharacterId: row.membershipCharacterId,
      });
      continue;
    }
    if (!prev.membershipCharacterId && row.membershipCharacterId) {
      playerByCampaign.set(row.campaign.id, {
        campaign: row.campaign,
        membershipCharacterId: row.membershipCharacterId,
      });
    }
  }

  /** Backfill: characters created before membership binding existed have campaign_id set but character_id on membership was never set. */
  for (const [campaignIdKey, entry] of [...playerByCampaign.entries()]) {
    if (entry.membershipCharacterId) continue;
    const [pc] = await db
      .select({ id: charactersTable.id })
      .from(charactersTable)
      .where(
        and(
          eq(charactersTable.campaignId, campaignIdKey),
          eq(charactersTable.userId, userId),
          eq(charactersTable.isNpc, false),
          eq(charactersTable.isActive, true),
        ),
      )
      .orderBy(asc(charactersTable.createdAt))
      .limit(1);
    if (!pc) continue;
    await bindFirstVacantPlayerMembership(campaignIdKey, userId, pc.id);
    playerByCampaign.set(campaignIdKey, {
      campaign: entry.campaign,
      membershipCharacterId: pc.id,
    });
  }

  const asPlayerPayload = [...playerByCampaign.values()].map(({ campaign, membershipCharacterId }) => ({
    ...campaign,
    role: "player" as const,
    playerMembershipCharacterId: membershipCharacterId,
  }));

  res.json({ as_dm: asDmPayload, as_player: asPlayerPayload });
});

router.post("/campaigns", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const { name, description, gameSystem, setting, starting_location, tone, house_rules } = req.body;
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
      setting: typeof setting === "string" ? setting : null,
      startingLocation: typeof starting_location === "string" ? starting_location : null,
      tone: typeof tone === "string" ? tone : null,
      houseRules: typeof house_rules === "string" ? house_rules : null,
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
  const userId = getEffectiveUserId(req)!;
  const { inviteCode, characterId } = req.body as { inviteCode?: string; characterId?: string };
  if (!inviteCode || typeof inviteCode !== "string") {
    res.status(400).json({ error: "Invite code is required" });
    return;
  }
  const [campaign] = await db
    .select()
    .from(campaignsTable)
    .where(eq(campaignsTable.inviteCode, inviteCode.trim().toUpperCase()));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  if (campaign.status === "completed") {
    res.status(400).json({ error: "Campaign is completed" });
    return;
  }

  if (characterId && typeof characterId === "string") {
    const [character] = await db
      .select()
      .from(charactersTable)
      .where(and(eq(charactersTable.id, characterId), eq(charactersTable.userId, userId)));
    if (!character) {
      res.status(403).json({ error: "Character not found or not yours" });
      return;
    }
    if (character.campaignId != null && character.campaignId !== campaign.id) {
      res.status(400).json({ error: "Character belongs to another campaign" });
      return;
    }

    const [dupChar] = await db
      .select()
      .from(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaign.id),
          eq(campaignMembersTable.characterId, characterId),
        ),
      );
    if (dupChar) {
      res.status(409).json({ error: "Character already in this campaign" });
      return;
    }

    const [legacyRow] = await db
      .select()
      .from(campaignMembersTable)
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaign.id),
          eq(campaignMembersTable.userId, userId),
          isNull(campaignMembersTable.characterId),
        ),
      );

    if (legacyRow) {
      await db
        .update(campaignMembersTable)
        .set({
          characterId,
          role: "player",
          status: "accepted",
        })
        .where(eq(campaignMembersTable.id, legacyRow.id));
    } else {
      await db.insert(campaignMembersTable).values({
        campaignId: campaign.id,
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
      .where(and(eq(campaignMembersTable.campaignId, campaign.id), eq(campaignMembersTable.userId, userId)));

    if (!existing) {
      await db.insert(campaignMembersTable).values({
        campaignId: campaign.id,
        userId,
        role: "player",
      });
    }
  }

  const role = campaign.dmUserId === userId ? "dm" : "player";
  res.json({ ...campaign, role });
});

/** POST /api/campaigns/:campaignId/invite — DM invites a user by username */
router.post(
  "/campaigns/:campaignId/invite",
  requireAuth,
  requireCampaignMember,
  requireDm,
  async (req, res) => {
    const userId = getEffectiveUserId(req)!;
    const campaignId = param(req.params.campaignId);
    const { username } = req.body as { username?: string };
    if (!username || typeof username !== "string" || !username.trim()) {
      res.status(400).json({ error: "username is required" });
      return;
    }
    const [invitedUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username.trim().toLowerCase()));
    if (!invitedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (invitedUser.id === userId) {
      res.status(400).json({ error: "Cannot invite yourself" });
      return;
    }
    const inviteCode = nanoid(10).toUpperCase();
    await db.insert(campaignInvitesTable).values({
      campaignId,
      invitedBy: userId,
      invitedUserId: invitedUser.id,
      inviteCode,
      status: "pending",
    });
    res.json({ message: `Invite sent to ${invitedUser.username}`, inviteCode });
  },
);

/** POST /api/campaigns/:campaignId/members — DM adds a character to the campaign */
router.post(
  "/campaigns/:campaignId/members",
  requireAuth,
  requireCampaignMember,
  requireDm,
  async (req, res) => {
    const campaignId = param(req.params.campaignId);
    const { characterId } = req.body as { characterId?: string };
    if (!characterId || typeof characterId !== "string") {
      res.status(400).json({ error: "characterId is required" });
      return;
    }
    const [character] = await db.select().from(charactersTable).where(eq(charactersTable.id, characterId));
    if (!character) {
      res.status(404).json({ error: "Character not found" });
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
          eq(campaignMembersTable.userId, character.userId),
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
        userId: character.userId,
        characterId,
        role: "player",
        status: "accepted",
      });
    }

    res.json({ message: "Character added to campaign" });
  },
);

/** DELETE /api/campaigns/:campaignId/members/:characterId — DM removes a member */
router.delete(
  "/campaigns/:campaignId/members/:characterId",
  requireAuth,
  requireCampaignMember,
  requireDm,
  async (req, res) => {
    const campaignId = param(req.params.campaignId);
    const characterId = param(req.params.characterId);

    await db
      .update(campaignMembersTable)
      .set({ status: "removed" })
      .where(
        and(
          eq(campaignMembersTable.campaignId, campaignId),
          eq(campaignMembersTable.characterId, characterId),
        ),
      );

    res.json({ message: "Member removed" });
  },
);

router.get("/campaigns/:campaignId", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
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

  const memberRows = await db
    .select({
      membership: campaignMembersTable,
      characterName: charactersTable.name,
      race: charactersTable.race,
      class: charactersTable.class,
      level: charactersTable.level,
      personality: charactersTable.personality,
      backstory: charactersTable.backstory,
      avatarUrl: charactersTable.avatarUrl,
      playerUsername: usersTable.username,
    })
    .from(campaignMembersTable)
    .leftJoin(charactersTable, eq(campaignMembersTable.characterId, charactersTable.id))
    .leftJoin(usersTable, eq(campaignMembersTable.userId, usersTable.id))
    .where(
      and(eq(campaignMembersTable.campaignId, campaignId), eq(campaignMembersTable.status, "accepted")),
    );

  const members = memberRows.map((row) => ({
    ...row.membership,
    characterName: row.characterName,
    race: row.race,
    class: row.class,
    level: row.level,
    personality: row.personality,
    backstory: row.backstory,
    avatarUrl: row.avatarUrl,
    playerUsername: row.playerUsername,
  }));

  res.json({ ...campaign, role: member.role, members });
});

router.put("/campaigns/:campaignId", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const campaignId = param(req.params.campaignId);

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  if (campaign.dmUserId !== userId) {
    res.status(403).json({ error: "Only the DM can update the campaign" });
    return;
  }

  const { name, description, gameSystem, settings, setting, starting_location, tone, house_rules, status } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (gameSystem !== undefined) updates.gameSystem = gameSystem;
  if (settings !== undefined) updates.settings = settings;
  if (setting !== undefined) updates.setting = setting;
  if (starting_location !== undefined) updates.startingLocation = starting_location;
  if (tone !== undefined) updates.tone = tone;
  if (house_rules !== undefined) updates.houseRules = house_rules;
  if (status !== undefined) updates.status = status;
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(campaignsTable)
    .set(updates)
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  const [member] = await db
    .select()
    .from(campaignMembersTable)
    .where(and(eq(campaignMembersTable.campaignId, campaignId), eq(campaignMembersTable.userId, userId)));

  res.json({ ...updated, role: member?.role || "dm" });
});

router.delete("/campaigns/:campaignId", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const campaignId = param(req.params.campaignId);

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  if (campaign.dmUserId !== userId) {
    res.status(403).json({ error: "Only the DM can delete the campaign" });
    return;
  }

  const sessions = await db.select({ id: gameSessionsTable.id }).from(gameSessionsTable).where(eq(gameSessionsTable.campaignId, campaignId));
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length > 0) {
    await db.delete(messagesTable).where(inArray(messagesTable.sessionId, sessionIds));
  }
  await db.delete(gameSessionsTable).where(eq(gameSessionsTable.campaignId, campaignId));
  await db.delete(charactersTable).where(eq(charactersTable.campaignId, campaignId));
  await db.delete(mapsTable).where(eq(mapsTable.campaignId, campaignId));
  await db.delete(campaignInvitesTable).where(eq(campaignInvitesTable.campaignId, campaignId));
  await db.delete(campaignMembersTable).where(eq(campaignMembersTable.campaignId, campaignId));
  await db.delete(campaignsTable).where(eq(campaignsTable.id, campaignId));
  res.status(204).send();
});

export default router;
