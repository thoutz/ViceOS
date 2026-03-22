import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { charactersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireCampaignMember, getEffectiveUserId } from "../middlewares/auth";
import { param } from "../types";
import { bindFirstVacantPlayerMembership } from "../lib/bind-player-character";

const router: IRouter = Router();

router.get("/campaigns/:campaignId/characters", requireAuth, requireCampaignMember, async (req, res) => {
  const campaignId = param(req.params.campaignId);
  const characters = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.campaignId, campaignId));
  res.json(characters);
});

router.post("/campaigns/:campaignId/characters", requireAuth, requireCampaignMember, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const campaignId = param(req.params.campaignId);
  const { name, race, class: charClass, background, subrace, subclass, level, hp, maxHp, ac, speed, stats, sheetData, tokenColor, isNpc } = req.body;

  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const abilityScores = stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const dexMod = Math.floor((abilityScores.dex - 10) / 2);
  const conMod = Math.floor((abilityScores.con - 10) / 2);
  const calculatedMaxHp = maxHp || hp || Math.max(1, (level || 1) * 5 + conMod);

  const [character] = await db
    .insert(charactersTable)
    .values({
      campaignId,
      userId,
      name,
      race: race || null,
      subrace: subrace || null,
      class: charClass || null,
      subclass: subclass || null,
      background: background || null,
      level: level || 1,
      hp: hp || calculatedMaxHp,
      maxHp: calculatedMaxHp,
      tempHp: 0,
      ac: ac || 10,
      speed: speed || 30,
      initiativeBonus: dexMod,
      stats: abilityScores,
      sheetData: sheetData || {},
      tokenColor: tokenColor || "#C9A84C",
      isNpc: isNpc || false,
    })
    .returning();

  const npc = isNpc || false;
  if (!npc && character.userId === userId) {
    await bindFirstVacantPlayerMembership(campaignId, userId, character.id);
  }

  res.status(201).json(character);
});

router.get("/campaigns/:campaignId/characters/:characterId", requireAuth, requireCampaignMember, async (req, res) => {
  const campaignId = param(req.params.campaignId);
  const characterId = param(req.params.characterId);
  const [character] = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.id, characterId), eq(charactersTable.campaignId, campaignId)));
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

router.put("/campaigns/:campaignId/characters/:characterId", requireAuth, requireCampaignMember, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const campaignId = param(req.params.campaignId);
  const characterId = param(req.params.characterId);
  const member = req.campaignMember;

  const [existing] = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.id, characterId), eq(charactersTable.campaignId, campaignId)));

  if (!existing) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  if (existing.userId !== userId && member?.role !== "dm") {
    res.status(403).json({ error: "Cannot modify another player's character" });
    return;
  }

  const allowed = ['name', 'race', 'subrace', 'class', 'subclass', 'background', 'level', 'hp', 'maxHp', 'tempHp', 'ac', 'speed', 'initiativeBonus', 'stats', 'sheetData', 'tokenColor', 'isNpc'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.stats) {
    const s = updates.stats as { dex: number };
    updates.initiativeBonus = Math.floor((s.dex - 10) / 2);
  }

  const [character] = await db
    .update(charactersTable)
    .set(updates)
    .where(and(eq(charactersTable.id, characterId), eq(charactersTable.campaignId, campaignId)))
    .returning();

  res.json(character);
});

router.delete("/campaigns/:campaignId/characters/:characterId", requireAuth, requireCampaignMember, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const campaignId = param(req.params.campaignId);
  const characterId = param(req.params.characterId);
  const member = req.campaignMember;

  const [existing] = await db
    .select()
    .from(charactersTable)
    .where(and(eq(charactersTable.id, characterId), eq(charactersTable.campaignId, campaignId)));

  if (!existing) {
    res.status(404).json({ error: "Character not found" });
    return;
  }

  if (existing.userId !== userId && member?.role !== "dm") {
    res.status(403).json({ error: "Cannot delete another player's character" });
    return;
  }

  await db
    .delete(charactersTable)
    .where(and(eq(charactersTable.id, characterId), eq(charactersTable.campaignId, campaignId)));

  res.json({ ok: true });
});

export default router;
