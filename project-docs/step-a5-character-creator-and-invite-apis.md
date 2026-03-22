# Step A5 — Multi-step Character Creator + invite acceptance APIs

## A5 — Character creator (frontend)

- Replaced the old 7-step wizard with **5 steps** per sub-plan:
  1. **Identity** — name, level, alignment, subclass (optional), race, class, background; subrace chips when applicable.
  2. **Stats** — standard array or 4d6 drop-lowest; previews HP / AC / speed; racial bonuses applied via `computeFinalStats()` in `character-creator-data.ts`.
  3. **Story** — personality, backstory, ideals, bonds, flaws, appearance; AI hint banner; character counts on long fields.
  4. **Notes & avatar** — DM/AI notes, optional image upload (stored as data URL in `avatar_url`), token color swatches.
  5. **Review** — summary and **Save character**.

- **Save draft** writes JSON to `localStorage` key `tavernos_character_draft_v1_${campaignId || "pool"}`; draft reloads on mount for the same scope.

- **Submit** uses **`POST /api/characters`** (`useCreatePlayerCharacter`) with `campaignId` when the user opened `/campaign/:campaignId/create-character`, or omits it for pool-only (`/create-character`). Redirect: campaign flow → `/session/:campaignId/latest`; pool → `/dashboard`.

- D&D **sheetData** (skills, inventory, features) is still populated on save using `pickAutoClassSkills`, background skills, and default equipment from `CLASS_EQUIPMENT` / `EQUIPMENT_PACKS` so VTT panels keep working.

- **Files:** `artifacts/tavernos/src/pages/character-creator.tsx`, `artifacts/tavernos/src/pages/character-creator-data.ts`; route **`/create-character`** added in `App.tsx` alongside the existing campaign-scoped route.

- **Backend:** `POST /api/characters` now persists **`subrace`** (was missing from destructuring/insert).

## OpenAPI — player characters & invites

- Documented **`/characters`** (list/create) and **`/characters/{characterId}`** (get/update/delete), schemas **`PlayerCharacter`**, **`CreatePlayerCharacterRequest`**, **`UpdatePlayerCharacterRequest`**.
- Extended **`Character`** with nullable `campaignId`, story/stat fields, and `updatedAt` where applicable.
- Invites: **`GET /invites/pending`**, **`POST /invites/{inviteId}/accept`**, **`POST /invites/{inviteId}/decline`** with **`PendingInvite`**, **`AcceptInviteRequest`**, **`AcceptInviteResponse`**.

- Regenerate client: `pnpm --filter @workspace/api-spec run codegen`.

## Invite acceptance APIs (backend)

- New router: `artifacts/api-server/src/routes/invites.ts`, mounted in `routes/index.ts` (after auth).

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/invites/pending` | Rows in `campaign_invites` with `invited_user_id` = current user and `status = pending`, joined with campaign + inviter username. |
| POST | `/api/invites/:inviteId/accept` | Optional body `{ characterId }`. Validates pending + expiry; adds/updates `campaign_members` (same patterns as `/campaigns/join`); sets invite `status` to `accepted`. |
| POST | `/api/invites/:inviteId/decline` | Sets invite `status` to `declined`. |

## CSS / design

- Reused existing **glass-panel**, **VttButton**, **VttInput**, **framer-motion** step transitions; no new global dashboard styles.

## Dashboard — pending invites UI

- **`artifacts/tavernos/src/pages/dashboard.tsx`** lists **`GET /api/invites/pending`** when non-empty; **Accept** calls **`POST /api/invites/:id/accept`** with `{}` then refetches campaigns/pending and navigates to **`/campaign/:campaignId/create-character`**; **Decline** calls **`POST /api/invites/:id/decline`**. Uses existing **glass-panel** / **VttButton** styling only.
