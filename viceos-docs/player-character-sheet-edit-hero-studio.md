# Player character editing (session, dashboard, hero studio)

## Summary

- **In-session**: Players (and anyone who owns the viewed sheet, including a DM’s own PC) can **Quick edit** core fields in the right-hand Sheet panel or open **Full studio** for the full-page editor.
- **Dashboard**: **Your heroes** lists non-NPC characters with **Open sheet**; player campaign cards include **Edit character sheet** (does not navigate into the session).
- **Hero studio** (`/hero/:characterId`): Full-page editor with **portrait** (`avatarUrl`), optional **backdrop** (`sheetBackgroundUrl`, studio UI only), identity, combat numbers, abilities, and biography fields. Saves via `PUT /api/characters/:id` (owner only).

## Database

- Migration: `lib/db/migrations/0003_characters_sheet_background.sql` — `sheet_background_url` nullable text on `characters`.
- Drizzle: `lib/db/src/schema/characters.ts` — `sheetBackgroundUrl`.

Apply in each environment: `pnpm --filter @workspace/db run push` or run the SQL file.

## API

- **Campaign characters** `PUT /api/campaigns/:campaignId/characters/:characterId`: extended allowed fields include biography columns, `alignment`, `avatarUrl`, `sheetBackgroundUrl`, and `updatedAt` refresh.
- **Player characters** `PUT /api/characters/:id`: accepts `subrace`, `subclass`, `avatarUrl`, `sheet_background_url` / `sheetBackgroundUrl` (aliases).

## OpenAPI / client

- `Character` and `UpdateCharacterRequest` include `sheetBackgroundUrl` and expanded update fields.
- Regenerate: `pnpm --filter @workspace/api-spec run codegen`, then `pnpm exec tsc -b lib/api-client-react` as needed.

## Frontend (`artifacts/tavernos`)

- `App.tsx`: route `/hero/:characterId` → `hero-studio.tsx`.
- `dashboard.tsx`: **Your heroes** grid; campaign card **Edit character sheet** for players.
- `CharacterSheet.tsx`: header portrait; **Quick edit** / **Full studio** / Save / Cancel; `SheetQuickEditForm` when editing (replaces tab strip).
- `session.tsx`: passes `currentUserId` and `onSaveCharacter` using `useUpdateCharacter` + `refetchCharacters`.

## Image limits (hero studio)

- Portrait upload: max **500 KB** file size before base64.
- Backdrop upload: max **~1.2 MB** file size before base64.
- URLs and data URLs are stored as plain text; very large payloads may be undesirable for DB size.

## Deploy checklist

1. Run DB migration for `sheet_background_url`.
2. Deploy API + client together so types and routes align.

## Troubleshoot: image URLs not saving

- **DB**: If `sheet_background_url` (or older schema drift) is missing, `PUT /api/characters/:id` returns **500** with a Postgres error. Apply migrations: `pnpm --filter @workspace/db run push`.
- **API**: `mergeCharacterImageUrlFields` in `artifacts/api-server/src/lib/character-image-url-fields.ts` normalizes `avatarUrl` / `sheetBackgroundUrl` (and snake_case aliases), trims strings, and maps empty string to `null`. `omitUndefinedKeys` avoids passing `undefined` into Drizzle (which could skip updates).
- **Client**: Hero studio builds the save payload with `trimUrlField` so pasted URLs persist and clears map to `null`.
