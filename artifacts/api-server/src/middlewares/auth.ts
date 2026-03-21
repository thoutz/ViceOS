import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { campaignMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

import { param } from "../types";

/**
 * In-memory per-tab identity map. Keyed by X-Tab-Id header value.
 * Allows separate browser tabs to maintain distinct user identities even
 * though they share the same session cookie.
 */
export const tabIdentityMap = new Map<string, { userId: string; username: string }>();

/** Get the effective userId for a request, preferring tab identity over session. */
export function getEffectiveUserId(req: Request): string | undefined {
  const tabId = req.headers["x-tab-id"] as string | undefined;
  if (tabId) {
    const tabUser = tabIdentityMap.get(tabId);
    if (tabUser) return tabUser.userId;
  }
  return req.session.userId;
}

/** Get the effective username for a request, preferring tab identity over session. */
export function getEffectiveUsername(req: Request): string | undefined {
  const tabId = req.headers["x-tab-id"] as string | undefined;
  if (tabId) {
    const tabUser = tabIdentityMap.get(tabId);
    if (tabUser) return tabUser.username;
  }
  return req.session.username;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getEffectiveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export async function requireCampaignMember(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = getEffectiveUserId(req)!;
  const campaignId = param(req.params.campaignId);

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

  req.campaignMember = member;
  next();
}

export async function requireDm(req: Request, res: Response, next: NextFunction): Promise<void> {
  const member = req.campaignMember;
  if (!member || member.role !== "dm") {
    res.status(403).json({ error: "DM access required" });
    return;
  }
  next();
}
