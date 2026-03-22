# Step A1–A2: Character sheet schema + `/api/characters`

## What we did

### A1 — Database (PostgreSQL + Drizzle)

- Extended `users` with optional `email` (no unique constraint yet — avoids interactive `drizzle-kit push` prompts on populated tables; can add a partial unique index when email is required).
- Extended `campaigns` with `setting`, `starting_location`, `tone`, `house_rules`, `status` (default `recruiting`), `updated_at`.
- Extended `characters` for the sub-plan: nullable `campaign_id` (character “pool” without a campaign), explicit ability integers, story fields (`personality`, `backstory`, …), `avatar_url`, `game_system`, `is_active`, `updated_at`. Kept existing VTT fields (`stats` jsonb, `hp`/`ac`, `token_color`, `is_npc`, etc.).
- Extended `campaign_members` with nullable `character_id` (FK → `characters`) and `status` (for pending/accepted/removed in later steps).
- Added `campaign_invites` table.
- Extended `game_sessions` with AI-oriented JSON blobs (`story_log`, `locations_data`, `items_data`, `open_threads`, `message_history`), `session_number`, `dm_user_id`, `started_at`/`ended_at`, `updated_at` (for Phase D / `loadSessionForAI`).

**Apply schema:** from repo root, with `DATABASE_URL` set:

`pnpm --filter @workspace/db run push`

**Reference SQL (manual replay):** `lib/db/migrations/0001_character_sheet_system.sql` — prefer Drizzle schema as source of truth.

### A2 — Character routes

- New router: `artifacts/api-server/src/routes/player-characters.ts`, mounted in `routes/index.ts` **before** campaign-scoped routes.
- Endpoints (all under `/api`, cookie session + optional `X-Tab-Id` like the rest of the API):
  - `GET /characters` — list active characters for the logged-in user (`is_active = true`).
  - `GET /characters/:id` — owner, campaign DM (legacy `campaign_id`), or DM linked via `campaign_members.character_id`.
  - `POST /characters` — create; optional `campaignId` if the sheet should be tied to a campaign; body accepts spec-style fields (`hit_points`, `avatar_url`, `game_system`, …) plus existing `stats` object.
  - `PUT /characters/:id` — owner only; updates allowed fields; recomputes `stats` + initiative when abilities change.
  - `DELETE /characters/:id` — soft delete (`is_active = false`), owner only.

### Other adjustments

- `POST /campaigns/:campaignId/sessions` sets `dm_user_id` on the new `game_sessions` row.
- `POST/PUT /campaigns` accept the new campaign metadata fields where applicable.

## Testing (curl)

Rebuild and run the API (`PORT` required), then use a cookie jar after `POST /api/auth/login`:

1. `GET /api/characters` → `[]` or existing sheets.
2. `POST /api/characters` with JSON body including at least `name`.
3. `GET /api/characters/:id`, `PUT`, `DELETE`, then list again.

Verified locally on a fresh port with the rebuilt `dist/index.mjs`.

## CSS / frontend

None (Step A2 scope: API only).

## Phase D

Do **not** wire `loadSessionForAI()` until Steps A3–A8+ are done, per sub-plan.
