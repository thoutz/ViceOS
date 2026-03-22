import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  charactersTable,
  campaignsTable,
  campaignMembersTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getEffectiveUserId } from "../middlewares/auth";
import { param } from "../types";
import { bindFirstVacantPlayerMembership } from "../lib/bind-player-character";
import { mergeCharacterImageUrlFields, omitUndefinedKeys } from "../lib/character-image-url-fields";

const router: IRouter = Router();

type AbilityStats = { str: number; dex: number; con: number; int: number; wis: number; cha: number };

function defaultStats(): AbilityStats {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}

function normalizeStats(body: Record<string, unknown>, base?: AbilityStats): AbilityStats {
  const b = base ?? defaultStats();
  const fromBody = body.stats as Partial<AbilityStats> | undefined;
  const num = (v: unknown, fallback: number) => (typeof v === "number" ? v : fallback);
  return {
    str: num(body.strength, num(fromBody?.str, b.str)),
    dex: num(body.dexterity, num(fromBody?.dex, b.dex)),
    con: num(body.constitution, num(fromBody?.con, b.con)),
    int: num(body.intelligence, num(fromBody?.int, b.int)),
    wis: num(body.wisdom, num(fromBody?.wis, b.wis)),
    cha: num(body.charisma, num(fromBody?.cha, b.cha)),
  };
}

async function canViewCharacter(characterId: string, userId: string): Promise<boolean> {
  const [row] = await db.select().from(charactersTable).where(eq(charactersTable.id, characterId));
  if (!row) return false;
  if (row.userId === userId) return true;
  if (row.campaignId) {
    const [campaign] = await db
      .select()
      .from(campaignsTable)
      .where(eq(campaignsTable.id, row.campaignId));
    if (campaign?.dmUserId === userId) return true;
  }
  const [dmLink] = await db
    .select({ id: campaignMembersTable.id })
    .from(campaignMembersTable)
    .innerJoin(campaignsTable, eq(campaignMembersTable.campaignId, campaignsTable.id))
    .where(
      and(
        eq(campaignMembersTable.characterId, characterId),
        eq(campaignsTable.dmUserId, userId),
      ),
    );
  return !!dmLink;
}

/** GET /api/characters — list active characters owned by the current user */
router.get("/characters", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const characters = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.userId, userId), eq(charactersTable.isActive, true)));
  res.json(characters);
});

/** GET /api/characters/:id */
router.get("/characters/:id", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const id = param(req.params.id);
  const [character] = await db.select().from(charactersTable).where(eq(charactersTable.id, id));
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  const allowed = await canViewCharacter(id, userId);
  if (!allowed) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

/** POST /api/characters — create a character (optional campaign link via campaignId) */
router.post("/characters", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const {
    name,
    race,
    subrace,
    class: charClass,
    subclass,
    level,
    background,
    alignment,
    strength,
    dexterity,
    constitution,
    intelligence,
    wisdom,
    charisma,
    hit_points,
    armor_class,
    speed,
    personality,
    backstory,
    ideals,
    bonds,
    flaws,
    appearance,
    notes,
    avatar_url,
    game_system,
    campaignId,
    stats: statsBody,
  } = req.body as Record<string, unknown>;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "Character name is required" });
    return;
  }

  const stats = normalizeStats(
    {
      strength,
      dexterity,
      constitution,
      intelligence,
      wisdom,
      charisma,
      stats: statsBody,
    },
    defaultStats(),
  );

  const dexMod = Math.floor((stats.dex - 10) / 2);
  const conMod = Math.floor((stats.con - 10) / 2);
  const lvl = typeof level === "number" ? level : 1;
  const hpVal = typeof hit_points === "number" ? hit_points : Math.max(1, lvl * 5 + conMod);
  const acVal = typeof armor_class === "number" ? armor_class : 10;
  const speedVal = typeof speed === "number" ? speed : 30;

  let resolvedCampaignId: string | null = null;
  if (typeof campaignId === "string" && campaignId.length > 0) {
    const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
    if (!c) {
      res.status(400).json({ error: "Invalid campaignId" });
      return;
    }
    resolvedCampaignId = campaignId;
  }

  const [created] = await db
    .insert(charactersTable)
    .values({
      campaignId: resolvedCampaignId,
      userId,
      name: name.trim(),
      race: typeof race === "string" ? race : null,
      subrace: typeof subrace === "string" ? subrace : null,
      class: typeof charClass === "string" ? charClass : null,
      subclass: typeof subclass === "string" ? subclass : null,
      background: typeof background === "string" ? background : null,
      alignment: typeof alignment === "string" ? alignment : null,
      level: lvl,
      hp: hpVal,
      maxHp: hpVal,
      tempHp: 0,
      ac: acVal,
      speed: speedVal,
      initiativeBonus: dexMod,
      strength: typeof strength === "number" ? strength : stats.str,
      dexterity: typeof dexterity === "number" ? dexterity : stats.dex,
      constitution: typeof constitution === "number" ? constitution : stats.con,
      intelligence: typeof intelligence === "number" ? intelligence : stats.int,
      wisdom: typeof wisdom === "number" ? wisdom : stats.wis,
      charisma: typeof charisma === "number" ? charisma : stats.cha,
      stats,
      personality: typeof personality === "string" ? personality : null,
      backstory: typeof backstory === "string" ? backstory : null,
      ideals: typeof ideals === "string" ? ideals : null,
      bonds: typeof bonds === "string" ? bonds : null,
      flaws: typeof flaws === "string" ? flaws : null,
      appearance: typeof appearance === "string" ? appearance : null,
      notes: typeof notes === "string" ? notes : null,
      avatarUrl: typeof avatar_url === "string" ? avatar_url : null,
      gameSystem: typeof game_system === "string" ? game_system : "D&D 5e",
      isActive: true,
      isNpc: false,
    })
    .returning();

  if (resolvedCampaignId) {
    await bindFirstVacantPlayerMembership(resolvedCampaignId, userId, created.id);
  }

  res.status(201).json(created);
});

/** PUT /api/characters/:id — owner only */
router.put("/characters/:id", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const id = param(req.params.id);

  const [existing] = await db.select().from(charactersTable).where(eq(charactersTable.id, id));
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Not found or not yours" });
    return;
  }

  const allowed = [
    "name",
    "race",
    "subrace",
    "class",
    "subclass",
    "level",
    "background",
    "alignment",
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
    "hp",
    "maxHp",
    "tempHp",
    "ac",
    "speed",
    "personality",
    "backstory",
    "ideals",
    "bonds",
    "flaws",
    "appearance",
    "notes",
    "avatar_url",
    "avatarUrl",
    "sheet_background_url",
    "sheetBackgroundUrl",
    "stats",
    "sheetData",
    "tokenColor",
    "game_system",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    if (key === "avatar_url" || key === "avatarUrl") {
      updates.avatarUrl = req.body[key];
    } else if (key === "game_system") {
      updates.gameSystem = req.body[key];
    } else if (key === "sheet_background_url" || key === "sheetBackgroundUrl") {
      updates.sheetBackgroundUrl = req.body[key];
    } else {
      updates[key] = req.body[key];
    }
  }

  const touchesAbilities =
    req.body.strength !== undefined ||
    req.body.dexterity !== undefined ||
    req.body.constitution !== undefined ||
    req.body.intelligence !== undefined ||
    req.body.wisdom !== undefined ||
    req.body.charisma !== undefined ||
    req.body.stats !== undefined;

  if (touchesAbilities) {
    const merged = normalizeStats(req.body as Record<string, unknown>, (existing.stats as AbilityStats) ?? defaultStats());
    updates.stats = merged;
    updates.initiativeBonus = Math.floor((merged.dex - 10) / 2);
    updates.strength = merged.str;
    updates.dexterity = merged.dex;
    updates.constitution = merged.con;
    updates.intelligence = merged.int;
    updates.wisdom = merged.wis;
    updates.charisma = merged.cha;
  }

  mergeCharacterImageUrlFields(req.body as Record<string, unknown>, updates);

  const cleaned = omitUndefinedKeys({ ...updates, updatedAt: new Date() });

  try {
    const [updated] = await db
      .update(charactersTable)
      .set(cleaned)
      .where(and(eq(charactersTable.id, id), eq(charactersTable.userId, userId)))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("[PUT /api/characters/:id]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Could not update character",
    });
  }
});

/** DELETE /api/characters/:id — soft delete (owner only) */
router.delete("/characters/:id", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const id = param(req.params.id);

  const [existing] = await db.select().from(charactersTable).where(eq(charactersTable.id, id));
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Not found or not yours" });
    return;
  }

  await db
    .update(charactersTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(charactersTable.id, id), eq(charactersTable.userId, userId)));

  res.json({ message: "Character removed" });
});

export default router;
