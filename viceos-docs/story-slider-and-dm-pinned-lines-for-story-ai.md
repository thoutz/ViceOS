# Story slider and DM “pin for story AI”

## Goal

- Let players send **story contributions** (filtered chat type `story_prompt`) so the DM’s story assistant only ingests those lines (plus explicit pins), not the full firehose.
- Allow **editing** story contributions after posting (owner or DM).
- Let the **DM pin any chat line** so it is included in the compiled story-assistant context even if the player did not use the story mode.

## Implementation steps

### Database (`lib/db`)

- `messages.pinned_for_story_ai` boolean, default `false`, not null.
- Migration: `lib/db/migrations/0002_messages_story_prompt_pins.sql`.
- Drizzle schema: `lib/db/src/schema/messages.ts` — `pinnedForStoryAi`.

After schema changes, rebuild declarations so dependents see new columns:

```bash
pnpm exec tsc -b lib/db
```

### API spec & codegen

- OpenAPI: `story_prompt` on message types; `pinnedForStoryAi` on `ChatMessage`; `PATCH` `/campaigns/{campaignId}/sessions/{sessionId}/messages/{messageId}` with `content` and/or `pinnedForStoryAi`.
- Regenerate: `pnpm --filter @workspace/api-spec run codegen` (and `pnpm exec tsc -b lib/api-client-react` as needed).

### API server

- `artifacts/api-server/src/routes/messages.ts`: POST accepts `story_prompt`; PATCH updates content (story author or DM) and `pinnedForStoryAi` (DM only); emits `chat_message_updated`.
- `artifacts/api-server/src/services/load-session-for-ai.ts`: builds context from `story_prompt` messages and from non–story-prompt messages with `pinnedForStoryAi === true`.

### Client (`artifacts/tavernos`)

- `ChatPanel`: “Story for DM” toggles sending `story_prompt` for **players only** (hidden for DM; disabled when whispering to a specific user).
- `ChatPanel` (communications): **Session video** and **Chat** are independently collapsible. Chat starts **collapsed** so video gets the column; expand chat for messages/composer, or collapse video to give chat more room. Lucide chevrons on the section headers.
- `message-bubble.tsx`: story bubble styling, edit for owner/DM, DM pin/unpin and badges.
- `session.tsx`: `handleSendMessage` / `usePatchMessage` wiring.
- `use-socket.ts`: invalidate messages on `chat_message_updated`.

## CSS / UI

- Story contributions use distinct bubble styling in `message-bubble.tsx` (no global dashboard theme changes).
- Left sidebar: collapsible panels use existing `bg-background`, borders, and hover states only — no new dashboard-wide theme tokens.

## Deploy notes

- Apply DB migration (or `pnpm --filter @workspace/db run push`) in each environment before deploying API that reads/writes `pinned_for_story_ai`.
