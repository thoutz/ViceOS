# Player campaign onboarding — completion

## Goal

Finish the **player** path from **dashboard → campaign** without dead ends: attach a hero (new or from pool) via **invite code**, **DM invite**, or **campaign card**, and route to the **session** when a character is already linked.

## Backend

- **`GET /api/campaigns`** (`artifacts/api-server/src/routes/campaigns.ts`): each **`as_player`** entry now includes **`playerMembershipCharacterId`** (nullable UUID from `campaign_members.character_id`). If the player has bound a sheet, it is set; otherwise `null`. When multiple membership rows exist for the same campaign, the row with a non-null `character_id` wins.

## OpenAPI / client

- **`CampaignWithRole`** in `lib/api-spec/openapi.yaml` documents optional **`playerMembershipCharacterId`**.
- Regenerated hooks/schemas: `pnpm --filter @workspace/api-spec run codegen`.
- **`useListPlayerCharacters`** added to explicit re-exports in `lib/api-client-react/src/index.ts` (Vite workspace boundary pattern).

## Frontend (`artifacts/tavernos/src/pages/dashboard.tsx`)

- **`campaignCardDestination`**: **DM** → `/session/:id/latest`. **Player** with **`playerMembershipCharacterId`** → session. **Player** without → `/campaign/:id/create-character`.
- **Join Campaign** modal: optional **Bring a hero** `<select>` listing **pool** characters (`campaignId` empty). Submits **`POST /campaigns/join`** with optional **`characterId`**. On success: if a character was attached → session; else → character creator for that campaign.
- **Invitations**: **Accept** opens a modal — **Create a new hero** (default) or **Use existing** pool character — then **`POST /invites/:id/accept`** with `{}` or `{ characterId }`. Navigation matches join (session vs creator).
- Header **New hero** → `/create-character` (pool creator).

## CSS / layout

- Reused **glass-panel**, **VttButton**, native `<select>` with existing border/background tokens; no dashboard-wide style overhaul.
