import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { charactersTable, campaignMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

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

router.get("/campaigns/:campaignId/characters", requireAuth, requireCampaignMember, async (req, res) => {
  const { campaignId } = req.params;
  const characters = await db.select().from(charactersTable).where(eq(charactersTable.campaignId, campaignId));
  res.json(characters);
});

router.post("/campaigns/:campaignId/characters", requireAuth, requireCampaignMember, async (req, res) => {
  const userId = (req.session as any).userId;
  const { campaignId } = req.params;
  const { name, race, class: charClass, background, level, hp, maxHp, ac, speed, stats, sheetData, tokenColor, isNpc } = req.body;

  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const abilityScores = stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const dexMod = Math.floor((abilityScores.dex - 10) / 2);
  const calculatedMaxHp = maxHp || hp || 10;

  const [character] = await db.insert(charactersTable).values({
    campaignId,
    userId,
    name,
    race,
    class: charClass,
    background,
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
  }).returning();

  res.status(201).json(character);
});

router.get("/campaigns/:campaignId/characters/:characterId", requireAuth, requireCampaignMember, async (req, res) => {
  const { characterId } = req.params;
  const [character] = await db.select().from(charactersTable).where(eq(charactersTable.id, characterId));
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

router.put("/campaigns/:campaignId/characters/:characterId", requireAuth, requireCampaignMember, async (req, res) => {
  const { characterId } = req.params;
  const updates = req.body;

  if (updates.stats) {
    const dexMod = Math.floor((updates.stats.dex - 10) / 2);
    updates.initiativeBonus = dexMod;
  }

  const [character] = await db.update(charactersTable).set(updates).where(eq(charactersTable.id, characterId)).returning();
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

export default router;
