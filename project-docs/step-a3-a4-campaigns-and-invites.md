# Step A3–A4: Campaign list, detail with members, invite flows

## A3 — Campaign API shape + members on GET

- **`GET /api/campaigns`** returns `{ as_dm, as_player }` instead of a flat array:
  - **`as_dm`**: rows from `campaigns` where `dm_user_id` is the current user (each item includes `role: "dm"`).
  - **`as_player`**: distinct campaigns where the user has `campaign_members` with `role = "player"` and `status = "accepted"` (each item includes `role: "player"`). De-duplicated when multiple character-bound rows exist for the same campaign.

- **`GET /api/campaigns/:campaignId`** returns the campaign, the caller’s **`role`**, and **`members`**: all `campaign_members` with `status = "accepted"`, each row joined with `characters` and `users` for display fields (`characterName`, `race`, `class`, `level`, story fields, `avatarUrl`, `playerUsername`). Rows without `character_id` (e.g. legacy DM row) still appear with null character fields.

- **Frontend**: `dashboard.tsx` merges `as_dm` and `as_player` into one grid list so existing UI keeps working.

## A4 — Three ways to attach players/characters

1. **Invite code + character (player)** — `POST /api/campaigns/join`  
   Body: `{ inviteCode, characterId? }`.  
   - If **`characterId`** is set: verifies ownership, optional `campaign_id` mismatch check, rejects duplicates `(campaign_id, character_id)`, upgrades a legacy membership row `(campaign, user, character_id IS NULL)` to the new character, or inserts a new row.  
   - If **`characterId`** is omitted: legacy behavior (membership without character).

2. **DM direct invite by username** — `POST /api/campaigns/:campaignId/invite`  
   Requires campaign member + DM. Body: `{ username }`. Inserts into **`campaign_invites`** with a generated `invite_code`. Response: `{ message, inviteCode }`. (Notifications / accept flow can come in a later step.)

3. **DM adds a character** — `POST /api/campaigns/:campaignId/members`  
   Body: `{ characterId }`. DM-only. Adds or upgrades `campaign_members` for that character’s owner.

4. **DM removes a member** — `DELETE /api/campaigns/:campaignId/members/:characterId`  
   Sets `campaign_members.status` to **`removed`** where `character_id` matches (rows with no character are not targeted by this path).

Other behavior:

- **`POST /join`** returns **`403`** if the character is not owned by the user; **`409`** if that character is already in the campaign; **`400`** if the campaign is `completed`.
- **Delete campaign** also deletes **`campaign_invites`** for that campaign.

## OpenAPI & codegen

- Updated `lib/api-spec/openapi.yaml` (`CampaignListResponse`, `CampaignWithMembers`, `CampaignMemberRow`, join/invite/member operations).
- Regenerated: `pnpm --filter @workspace/api-spec run codegen`.

## How to exercise with curl

1. Log in user A (cookie jar), `POST /api/campaigns` to create a campaign.
2. `GET /api/campaigns` → expect `as_dm.length >= 1`, `as_player` as needed.
3. `GET /api/campaigns/:id` → `members` includes DM row + later players.
4. Log in user B, `POST /api/characters`, then `POST /api/campaigns/join` with `inviteCode` + `characterId`.
5. As DM: `POST .../invite` with `{ "username": "..." }`, `POST .../members`, `DELETE .../members/:characterId`.

## CSS

None (API-only change; dashboard layout unchanged).
