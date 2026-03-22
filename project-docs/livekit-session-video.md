# LiveKit session video — implementation notes

## Summary

Added **LiveKit** video/voice for the VTT session: a **Video** tab in the right chat panel (`ChatPanel`) that joins a shared room per game session (`tavernos-{sessionId}`). Users fetch a short-lived JWT from the API, then connect with `@livekit/components-react` (`LiveKitRoom`, `VideoConference`, `RoomAudioRenderer`).

## Dependencies

| Package | Where |
|--------|--------|
| `livekit-server-sdk` | `artifacts/api-server` — mint access tokens |
| `livekit-client`, `@livekit/components-react`, `@livekit/components-styles` | `artifacts/tavernos` |

## Environment (API server)

Set on the process that runs Express using either:

1. **`artifacts/api-server/.env`** (gitignored) — loaded first via [`src/load-env.ts`](../artifacts/api-server/src/load-env.ts) using the `dotenv` package; or  
2. **Replit Secrets** / OS env — same variable names; values already in the environment are not overwritten by `.env`.

Required keys:

- `LIVEKIT_URL` — WebSocket URL, e.g. `wss://your-project.livekit.cloud`
- `LIVEKIT_API_KEY` — API key from LiveKit Cloud (or self-hosted)
- `LIVEKIT_API_SECRET` — API secret

If any are missing, `POST .../livekit-token` returns **503** and the UI explains that video is not configured.

## API

- **OpenAPI:** `POST /api/campaigns/{campaignId}/sessions/{sessionId}/livekit-token` (`createLivekitToken`), response `LiveKitTokenResponse` (`token`, `url`, `roomName`).
- **Implementation:** [`artifacts/api-server/src/routes/sessions.ts`](../artifacts/api-server/src/routes/sessions.ts) — `requireAuth`, `requireCampaignMember`, verifies session belongs to campaign, builds `AccessToken` with `identity` = effective user id, `name` = effective username.

## Frontend

- **Component:** [`artifacts/tavernos/src/components/vtt/SessionVideoCall.tsx`](../artifacts/tavernos/src/components/vtt/SessionVideoCall.tsx) — `useCreateLivekitToken` mutation on mount; imports `@livekit/components/styles` once.
- **Integration:** [`artifacts/tavernos/src/components/vtt/ChatPanel.tsx`](../artifacts/tavernos/src/components/vtt/ChatPanel.tsx) — new tab **Video** (icon `Video` from `lucide-react`).

## OpenAPI / codegen

After changing [`lib/api-spec/openapi.yaml`](../lib/api-spec/openapi.yaml), run:

```bash
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs
```

## Related fix

`subrace` / `subclass` were added back to OpenAPI `Character`, `CreateCharacterRequest`, and `UpdateCharacterRequest` so generated types match the DB and UI (fixes prior typecheck errors).

## CSS / design

No dashboard layout redesign: only the new Video tab content and LiveKit default component styles (`@livekit/components-styles`).
