# Player campaign membership ↔ character binding

## Problem

Players who completed the character creator for a campaign were sent back to **Create character** on the next visit. Campaign cards showed no hero name. Root cause: **`POST /api/characters`** (player-characters) inserted a row in `characters` with `campaign_id` but never set **`campaign_members.character_id`**. The dashboard route logic uses **`playerMembershipCharacterId`** from that column (`GET /api/campaigns`).

## Server

### New helper

- `artifacts/api-server/src/lib/bind-player-character.ts` — **`bindFirstVacantPlayerMembership(campaignId, userId, characterId)`** updates the first accepted **player** membership row with **`character_id` IS NULL**.

### `artifacts/api-server/src/routes/player-characters.ts`

- After creating a character with a **`campaignId`**, call **`bindFirstVacantPlayerMembership`**.

### `artifacts/api-server/src/routes/characters.ts`

- After **`POST /campaigns/:campaignId/characters`** for a non-NPC owned by the current user, call the same bind (VTT/legacy path).

### `artifacts/api-server/src/routes/campaigns.ts` — `GET /api/campaigns`

- **Self-heal for existing data:** For each player campaign whose membership still has no `character_id`, if there is a **non-NPC, active** character for `(userId, campaignId)`, take the **oldest by `created_at`**, call **`bindFirstVacantPlayerMembership`**, and expose that id as **`playerMembershipCharacterId`**.

## Client (`artifacts/tavernos`)

### `src/pages/dashboard.tsx`

- **`campaignCardDestination`**: If **`playerMembershipCharacterId`** is missing, fall back to the **first roster character** (oldest `createdAt`) for that **`campaignId`** from **`useListPlayerCharacters`** so ENTER still goes to the session when the API list is briefly stale.
- Player cards show **“Playing as …”** when roster data exists.

### `src/pages/character-creator.tsx`

- If the user opens **`/campaign/:campaignId/create-character`** but already has an active character tied to that campaign in **`useListPlayerCharacters`**, **redirect to** **`/session/:campaignId/latest`**.

## Verification

- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/tavernos run typecheck`
- Manual: join as player → create hero → return to dashboard → card shows name → ENTER → session. Reload: same. Existing user with orphan character: open dashboard once (self-heal runs) → same.
