# Phase D — Session start + AI context (`loadSessionForAI`)

## Goal

Provide a **single DM-facing aggregate** of campaign + session + party + table chat for **external LLM tooling** (copy/paste), and wire **session “start”** so new sessions record a **`startedAt`** timestamp.

## Server

### `loadSessionForAI(campaignId, sessionId)`

- **File:** `artifacts/api-server/src/services/load-session-for-ai.ts`
- Loads **campaign**, **game session** (including JSON blobs: `storyLog`, `locationsData`, `itemsData`, `openThreads`, `messageHistory`), **all characters in the campaign** (party briefs with truncated story fields), and the **last 100 messages** for the session (chronological in the compiled block).
- Returns **`SessionAiContext`** with **`compiledNarrativeContext`**: a plain-text markdown-ish document suitable for pasting into an assistant.

### Routes (`artifacts/api-server/src/routes/sessions.ts`)

- **`GET /api/campaigns/:campaignId/sessions/:sessionId/ai-context`** — **`requireDm`**. Returns **`SessionAiContext`** JSON; **404** if session/campaign mismatch.
- **`POST /api/campaigns/:campaignId/sessions`** — sets **`startedAt`** to **now** when creating a session (table “session started” timestamp).
- **`PUT /api/campaigns/:campaignId/sessions/:sessionId`** — DM may update AI blobs: **`storyLog`**, **`locationsData`**, **`itemsData`**, **`openThreads`**, **`messageHistory`**, plus **`sessionNumber`**, **`startedAt`**, **`endedAt`**. **`updatedAt`** is set automatically.

## OpenAPI / client

- **`SessionAiContext`**, **`PartyMemberBrief`**, **`RecentMessageBrief`** in `lib/api-spec/openapi.yaml`.
- **`GameSession`** / **`UpdateSessionRequest`** extended with session memory fields and timestamps.
- **`pnpm --filter @workspace/api-spec run codegen`**
- Explicit re-exports: **`useGetSessionAiContext`**, **`getGetSessionAiContextQueryKey`** in `lib/api-client-react/src/index.ts`.

## Frontend

- **`artifacts/tavernos/src/pages/session.tsx`** — DM **Command Center** drawer includes an **“AI session context”** strip: **refresh**, **copy compiled narrative**, short help text. Uses **`useGetSessionAiContext`** with **`enabled`** when DM + active session; **`queryKey`** passed through for TanStack Query typing.

## Follow-ups (not in this change)

- Wire **invalidation** of `getGetSessionAiContextQueryKey` when messages or session memory update (optional).
- **In-app LLM** call (server-side API key, streaming) — separate phase.
