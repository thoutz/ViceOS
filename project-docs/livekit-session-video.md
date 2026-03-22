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

- **Component:** [`artifacts/tavernos/src/components/vtt/SessionVideoCall.tsx`](../artifacts/tavernos/src/components/vtt/SessionVideoCall.tsx) — imports `@livekit/components/styles` once. **Join gate:** the LiveKit token is requested only after the user clicks **Join table video** (no auto-connect). On successful token, `LiveKitRoom` connects with mic and camera enabled. The room UI uses a local **`SessionVideoConference`** (same behavior as LiveKit’s `VideoConference` grid/focus + chat) with a custom **`SessionVideoControlBar`** instead of the stock prefab control bar. **`onDisconnected`** clears join state so the user sees the join screen again (e.g. after Leave). **`StartAudio`** sits under the conference for browsers that block remote audio until a user gesture.
- **Toolbar styling:** [`session-video-toolbar.css`](../artifacts/tavernos/src/components/vtt/session-video-toolbar.css) — three clusters: **media** (mic + camera split buttons with red/green state), **utility** (screen share, room chat, disabled “raise hand” placeholder, **More** menu with fullscreen on `[data-vtt-fullscreen-root]`), **hang up** (solid red button with phone icon). [`SessionVideoControlBar.tsx`](../artifacts/tavernos/src/components/vtt/SessionVideoControlBar.tsx) composes LiveKit `TrackToggle`, `MediaDeviceMenu`, `ChatToggle`, `DisconnectButton`, etc.
- **Dependency:** `@livekit/components-core` is listed in `artifacts/tavernos/package.json` so `SessionVideoConference` / `SessionVideoControlBar` can import `supportsScreenSharing` and shared types without resolution issues.
- **Layout:** The video strip uses a flex column with `min-h-0` so the LiveKit grid shrinks and `.lk-control-bar` is **`flex-shrink-0`** (Tailwind arbitrary selectors on the wrapper) — avoids clipping the toolbar inside the fixed-height chat panel. The outer shell adds **`vtt-session-video`** and **`data-vtt-fullscreen-root`** for scoped CSS and fullscreen.
- **Integration:** [`artifacts/tavernos/src/components/vtt/ChatPanel.tsx`](../artifacts/tavernos/src/components/vtt/ChatPanel.tsx) — **Session video** strip above chat (`h-[min(240px,34vh)]`, flex child `SessionVideoCall` with `min-h-0 flex-1`).

## OpenAPI / codegen

After changing [`lib/api-spec/openapi.yaml`](../lib/api-spec/openapi.yaml), run:

```bash
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs
```

## Related fix

`subrace` / `subclass` were added back to OpenAPI `Character`, `CreateCharacterRequest`, and `UpdateCharacterRequest` so generated types match the DB and UI (fixes prior typecheck errors).

## CSS / design

No dashboard chrome redesign: LiveKit default prefab styles (`@livekit/components-styles`) plus scoped wrapper classes so the control bar stays visible; join screen uses existing VTT tokens (`VttButton`, borders).
