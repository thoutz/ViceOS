# Story assistant — Cursor-style UI, Ask mode, variants

## Goals

- Remove model / `GROQ_API_KEY` copy from the UI; document model + service in code comments.
- Drop “(Groq)” from the title (show **Story assistant** only).
- **Ask mode**: multi-turn planning chat; nothing posts to table until the DM chooses.
- **Variants**: optional **Three variants (A/B/C)**; model must emit `**Variant A**` … `**Variant C**` sections; **Post A/B/C** buttons when parsing succeeds, plus **Post to table** for the full reply.

## API

**OpenAPI** (`lib/api-spec/openapi.yaml`): `DmStoryAssistantRequest` extended with:

- `conversationHistory[]` — `{ role: user|assistant, content }`, max 24 items (enforced server-side).
- `responseStyle` — `single` | `variants` (default `single`).

**Server**

- `artifacts/api-server/src/services/groq-dm-story-assistant.ts` — appends history before the latest user message; when `variants`, appends system suffix requiring **Variant A/B/C** structure; `max_tokens` 4096 for variants, 2048 for single.
- `artifacts/api-server/src/routes/sessions.ts` — validates history length and per-turn content length.

**Codegen:** `pnpm --filter @workspace/api-spec run codegen` then `pnpm exec tsc -b lib/api-client-react`.

## Client

**`artifacts/tavernos/src/components/vtt/StoryAssistantPanel.tsx`**

- Dark, Cursor-like chat (user right, assistant left).
- Checkbox: include compiled session & campaign context.
- Dropdown: **One reply** vs **Three variants**.
- **Send** runs Ask flow only (updates local chat + API with history).
- **Post to table** / **Post A|B|C** call parent `onPostStoryToTable(text)` → parent posts `type: story` + socket emit.
- **Clear** resets planning messages.

**`artifacts/tavernos/src/pages/session.tsx`**

- Comment block: Groq model path + `GROQ_API_KEY`.
- Replaced inline story UI with `<StoryAssistantPanel … />`.

## Verification

- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/tavernos run typecheck`
- Manual: plan several turns, then post one variant to table; confirm chat does not auto-post on Send.
