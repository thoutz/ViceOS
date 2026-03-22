# Dashboard — delete campaign (DM only)

## Behavior

- **Who:** Only campaigns where the user is **DM** show a trash control on the campaign card. The API **`DELETE /api/campaigns/:campaignId`** already enforced DM-only deletion (`artifacts/api-server/src/routes/campaigns.ts`).
- **Double confirmation:**
  1. Modal step 1: warning + **Continue** / **Cancel**.
  2. Modal step 2: user must type **`DELETE`** exactly; **Delete forever** stays disabled until the text matches.
- **Client:** `useDeleteCampaign` from OpenAPI codegen; explicit re-export in `lib/api-client-react/src/index.ts`.

## OpenAPI

- **`deleteCampaign`** added under `DELETE /campaigns/{campaignId}` in `lib/api-spec/openapi.yaml`; regenerate with `pnpm --filter @workspace/api-spec run codegen`.

## Files

- `artifacts/tavernos/src/pages/dashboard.tsx` — trash button, modal, mutation.
