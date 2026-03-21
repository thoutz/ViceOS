import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

  (req.session as any).userId = user.id;
  (req.session as any).username = user.username;

  res.json({ id: user.id, username: user.username });
});

router.get("/auth/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, username: user.username });
});

router.post("/auth/logout", (req, res) => {
  req.session?.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
