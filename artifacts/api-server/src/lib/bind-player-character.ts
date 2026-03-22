import { db } from "@workspace/db";
import { campaignMembersTable } from "@workspace/db/schema";
import { and, eq, isNull } from "drizzle-orm";

/**
 * Links the user's player membership row to a character sheet (first row with no character yet).
 * Used when a player creates their PC via POST /api/characters or when backfilling list campaigns.
 */
export async function bindFirstVacantPlayerMembership(
  campaignId: string,
  userId: string,
  characterId: string,
): Promise<void> {
  const [vacant] = await db
    .select({ id: campaignMembersTable.id })
    .from(campaignMembersTable)
    .where(
      and(
        eq(campaignMembersTable.campaignId, campaignId),
        eq(campaignMembersTable.userId, userId),
        eq(campaignMembersTable.role, "player"),
        eq(campaignMembersTable.status, "accepted"),
        isNull(campaignMembersTable.characterId),
      ),
    )
    .limit(1);

  if (!vacant) return;

  await db
    .update(campaignMembersTable)
    .set({ characterId })
    .where(eq(campaignMembersTable.id, vacant.id));
}
