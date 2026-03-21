import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { campaignMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

import "../types";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export async function requireCampaignMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId!;
  const { campaignId } = req.params;

  if (!campaignId) {
    res.status(400).json({ error: "Missing campaignId" });
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

  (req as any).campaignMember = member;
  next();
}

export async function requireDm(req: Request, res: Response, next: NextFunction): Promise<void> {
  const member = (req as any).campaignMember;
  if (!member || member.role !== "dm") {
    res.status(403).json({ error: "DM access required" });
    return;
  }
  next();
}
