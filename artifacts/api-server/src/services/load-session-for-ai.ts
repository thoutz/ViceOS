import { db } from "@workspace/db";
import {
  campaignsTable,
  gameSessionsTable,
  charactersTable,
  messagesTable,
} from "@workspace/db/schema";
import { eq, and, desc, asc, ne } from "drizzle-orm";

export type PartyMemberBrief = {
  id: string;
  name: string;
  race: string | null;
  class: string | null;
  level: number;
  isNpc: boolean;
  hp: number;
  maxHp: number;
  ac: number;
  personality?: string | null;
  backstory?: string | null;
};

export type RecentMessageBrief = {
  senderName: string;
  content: string;
  type: string;
  createdAt: string;
};

export type SessionAiContext = {
  campaign: {
    id: string;
    name: string;
    gameSystem: string | null;
    setting: string | null;
    startingLocation: string | null;
    tone: string | null;
    houseRules: string | null;
    description: string | null;
  };
  session: {
    id: string;
    name: string;
    sessionNumber: number;
    status: string;
    roundNumber: number;
    currentTurnIndex: number;
    startedAt: string | null;
    endedAt: string | null;
    storyLog: unknown;
    locationsData: unknown;
    itemsData: unknown;
    openThreads: unknown;
    messageHistory: unknown;
  };
  party: PartyMemberBrief[];
  recentMessages: RecentMessageBrief[];
  /** Plain-text block suitable for pasting into an LLM as campaign/session context */
  compiledNarrativeContext: string;
};

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatJsonBlock(label: string, value: unknown): string {
  if (value == null) return "";
  const isEmptyArray = Array.isArray(value) && value.length === 0;
  const isEmptyObj =
    typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
  if (isEmptyArray || isEmptyObj) return "";
  let body: string;
  if (typeof value === "string") {
    body = value;
  } else {
    try {
      body = JSON.stringify(value, null, 2);
    } catch {
      body = String(value);
    }
  }
  return `\n## ${label}\n${body}\n`;
}

/**
 * Loads campaign + session + party + recent chat and builds a single narrative blob for LLMs.
 */
export async function loadSessionForAI(
  campaignId: string,
  sessionId: string,
): Promise<SessionAiContext | null> {
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
  const [session] = await db
    .select()
    .from(gameSessionsTable)
    .where(and(eq(gameSessionsTable.id, sessionId), eq(gameSessionsTable.campaignId, campaignId)));

  if (!campaign || !session) {
    return null;
  }

  const partyRows = await db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.campaignId, campaignId));

  const party: PartyMemberBrief[] = partyRows.map((c) => ({
    id: c.id,
    name: c.name,
    race: c.race,
    class: c.class,
    level: c.level,
    isNpc: c.isNpc,
    hp: c.hp,
    maxHp: c.maxHp,
    ac: c.ac,
    personality: c.personality,
    backstory: c.backstory,
  }));

  const storyPromptRows = await db
    .select({
      senderName: messagesTable.senderName,
      content: messagesTable.content,
      type: messagesTable.type,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .where(and(eq(messagesTable.sessionId, sessionId), eq(messagesTable.type, "story_prompt")))
    .orderBy(asc(messagesTable.createdAt))
    .limit(100);

  const pinnedOtherRows = await db
    .select({
      senderName: messagesTable.senderName,
      content: messagesTable.content,
      type: messagesTable.type,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.sessionId, sessionId),
        eq(messagesTable.pinnedForStoryAi, true),
        ne(messagesTable.type, "story_prompt"),
      ),
    )
    .orderBy(asc(messagesTable.createdAt))
    .limit(50);

  const toBrief = (m: {
    senderName: string;
    content: string;
    type: string;
    createdAt: Date | string;
  }): RecentMessageBrief => ({
    senderName: m.senderName,
    content: m.content,
    type: m.type,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
  });

  const recentMessages: RecentMessageBrief[] = [
    ...storyPromptRows.map(toBrief),
    ...pinnedOtherRows.map(toBrief),
  ];

  const campaignBlock = {
    id: campaign.id,
    name: campaign.name,
    gameSystem: campaign.gameSystem,
    setting: campaign.setting,
    startingLocation: campaign.startingLocation,
    tone: campaign.tone,
    houseRules: campaign.houseRules,
    description: campaign.description,
  };

  const sessionBlock = {
    id: session.id,
    name: session.name,
    sessionNumber: session.sessionNumber,
    status: session.status,
    roundNumber: session.roundNumber,
    currentTurnIndex: session.currentTurnIndex,
    startedAt: session.startedAt
      ? session.startedAt instanceof Date
        ? session.startedAt.toISOString()
        : String(session.startedAt)
      : null,
    endedAt: session.endedAt
      ? session.endedAt instanceof Date
        ? session.endedAt.toISOString()
        : String(session.endedAt)
      : null,
    storyLog: session.storyLog,
    locationsData: session.locationsData,
    itemsData: session.itemsData,
    openThreads: session.openThreads,
    messageHistory: session.messageHistory,
  };

  let compiled = `# TavernOS — AI session context\n\n`;
  compiled += `## Campaign: ${campaign.name}\n`;
  if (campaign.gameSystem) compiled += `- System: ${campaign.gameSystem}\n`;
  if (campaign.setting) compiled += `- Setting: ${campaign.setting}\n`;
  if (campaign.startingLocation) compiled += `- Starting location: ${campaign.startingLocation}\n`;
  if (campaign.tone) compiled += `- Tone: ${campaign.tone}\n`;
  if (campaign.houseRules) compiled += `- House rules: ${campaign.houseRules}\n`;
  if (campaign.description) compiled += `- Summary: ${truncate(campaign.description, 800)}\n`;

  compiled += `\n## Session: ${session.name} (#${session.sessionNumber})\n`;
  compiled += `- Status: ${session.status} · Round ${session.roundNumber} · Turn index ${session.currentTurnIndex}\n`;
  if (sessionBlock.startedAt) compiled += `- Started: ${sessionBlock.startedAt}\n`;

  compiled += `\n## Party (${party.length})\n`;
  for (const p of party) {
    const tag = p.isNpc ? "NPC" : "PC";
    compiled += `- [${tag}] ${p.name}`;
    if (p.race || p.class) compiled += ` — ${[p.race, p.class].filter(Boolean).join(" ")}`;
    compiled += ` · Level ${p.level} · HP ${p.hp}/${p.maxHp} · AC ${p.ac}\n`;
    if (p.personality) compiled += `  - Personality: ${truncate(p.personality, 240)}\n`;
    if (p.backstory) compiled += `  - Backstory: ${truncate(p.backstory, 320)}\n`;
  }

  compiled += formatJsonBlock("Story log (structured)", session.storyLog);
  compiled += formatJsonBlock("Locations", session.locationsData);
  compiled += formatJsonBlock("Items / loot", session.itemsData);
  compiled += formatJsonBlock("Open threads", session.openThreads);
  compiled += formatJsonBlock("Message history (DM notes)", session.messageHistory);

  if (storyPromptRows.length > 0) {
    compiled += `\n## Story slider — player contributions (for your story assistant)\n`;
    compiled += `(Only messages sent with "Story for DM" are listed here.)\n`;
    for (const m of storyPromptRows) {
      compiled += `- ${m.senderName}: ${truncate(m.content, 1500)}\n`;
    }
  }

  if (pinnedOtherRows.length > 0) {
    compiled += `\n## Pinned for story assistant (DM-selected chat lines)\n`;
    for (const m of pinnedOtherRows) {
      compiled += `- [${m.type}] ${m.senderName}: ${truncate(m.content, 1500)}\n`;
    }
  }

  return {
    campaign: campaignBlock,
    session: sessionBlock,
    party,
    recentMessages,
    compiledNarrativeContext: compiled.trim(),
  };
}
