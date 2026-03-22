# DM: NPC/monster portrait, initiative fields, and map tokens (S / M / L)

## Summary

- **`InitiativeCombatant`** (OpenAPI + [`InitiativeBar.tsx`](artifacts/tavernos/src/components/vtt/InitiativeBar.tsx)) now supports optional **`tokenImageData`** (data URL) and **`tokenSize`**: `small` | `medium` | `large` (default when omitted: medium).
- **Open5e lookup** in DM Command Center ([`ChatPanel.tsx`](artifacts/tavernos/src/components/vtt/ChatPanel.tsx) `DmToolsPanel`): optional token image upload (750 KB max) and S/M/L before **Add to Initiative**.
- **Manual NPC add** (initiative strip): same portrait + S/M/L controls in the expanded add row.
- **Place on map**: DM initiative cards for NPCs show a **map pin**; it sets **`placementCombatant`** in [`session.tsx`](artifacts/tavernos/src/pages/session.tsx), passes **`placementDraft`** into [`MapCanvas`](artifacts/tavernos/src/components/vtt/MapCanvas.tsx), auto-selects **Place Token**, and the next map click places a **`Token`** with `imageData`, `tokenSize`, `characterId`, `isNpc`, stats. Draft clears after place or when switching away from Place Token (see `placementToolSyncRef` in MapCanvas).
- **`Token.tokenSize`** in OpenAPI drives rendering: **small** ≈ 0.75× cell face, **medium** 1× cell, **large** 2×2 grid footprint (`groupPx = 2 * gridSize`).

## API / codegen

- [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml): `TokenSize` schema; `InitiativeCombatant.tokenImageData` / `tokenSize`; `Token.tokenSize`.
- Regenerate: `pnpm --filter @workspace/api-spec run codegen` then `pnpm run typecheck:libs`.

## Server

- [`artifacts/api-server/src/app.ts`](artifacts/api-server/src/app.ts): `token_place` payload type extended with `tokenSize` and `isNpc`.

## Files touched

- `lib/api-spec/openapi.yaml`, generated `lib/api-client-react`
- `artifacts/api-server/src/app.ts`
- `artifacts/tavernos/src/hooks/use-socket.ts` (`TokenData`)
- `artifacts/tavernos/src/components/vtt/InitiativeBar.tsx`
- `artifacts/tavernos/src/components/vtt/ChatPanel.tsx`
- `artifacts/tavernos/src/components/vtt/MapCanvas.tsx`
- `artifacts/tavernos/src/pages/session.tsx`
