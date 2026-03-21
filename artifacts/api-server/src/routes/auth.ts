import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, tabIdentityMap, getEffectiveUserId } from "../middlewares/auth";
import "../types";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== "string" || username.trim().length === 0) {
    res.status(400).json({ error: "Username is required" });
    return;
  }
  const trimmed = username.trim().toLowerCase();

  let [user] = await db.select().from(usersTable).where(eq(usersTable.username, trimmed));
  if (!user) {
    [user] = await db.insert(usersTable).values({ username: trimmed }).returning();
  }

  const tabId = req.headers["x-tab-id"] as string | undefined;
  if (tabId) {
    // Store per-tab identity so each tab can have its own user
    tabIdentityMap.set(tabId, { userId: user.id, username: user.username });
  } else {
    // Fall back to shared session cookie for single-tab usage
    req.session.userId = user.id;
    req.session.username = user.username;
  }

  res.json({ id: user.id, username: user.username });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const userId = getEffectiveUserId(req)!;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, username: user.username });
});

router.post("/auth/logout", (req, res) => {
  const tabId = req.headers["x-tab-id"] as string | undefined;
  if (tabId) {
    tabIdentityMap.delete(tabId);
    res.json({ ok: true });
  } else {
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  }
});

export default router;
