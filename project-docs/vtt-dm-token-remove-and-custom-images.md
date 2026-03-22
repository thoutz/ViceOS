# VTT: DM token removal and custom token images

## Summary

- **Remove tokens:** The DM can remove a selected token from the map while using the **Select** tool via a **Remove token** control in the top toolbar, **Delete** / **Backspace** (when focus is not in an input), or **Remove Selected** in the **Place Token** panel. The existing `token_remove` Socket.IO flow and persistence are unchanged.
- **Custom images:** Optional portrait images can be attached when placing a token (data URL stored on the token as `imageData`). Images are capped at **750 KB** before upload to limit JSON payload size. Tokens render with a circular clipped image when `imageData` is present; otherwise the previous colored circle + initials behavior is used.

## API / types

- OpenAPI `Token` schema extended with optional `imageData` (`lib/api-spec/openapi.yaml`).
- Regenerated clients: `pnpm --filter @workspace/api-spec run codegen` (updates `lib/api-client-react/src/generated/*` and zod outputs).
- After spec changes, run `pnpm run typecheck:libs` (or full build) so `lib/api-client-react/dist` stays in sync for composite TypeScript projects.

## Backend

- `artifacts/api-server/src/app.ts`: `token_place` handler typing extended to accept `imageData` (and `ac`) on the token object. `token_move` already spreads `{ ...t, x, y }`, so existing `imageData` is preserved on move.

## Frontend

- `artifacts/tavernos/src/components/vtt/MapCanvas.tsx`
  - Imports `Token` from `@workspace/api-client-react`.
  - Place Token panel: hidden file input (`accept="image/*"`), preview thumbnail, clear, error text for oversize files.
  - `TokenFaceContent` + `KonvaImage` with circular clip for portrait rendering; fallback to circle + initials while loading or on failure.
  - Toolbar **Remove token** when `isDm && activeTool === 'select' && selectedTokenId`.
  - `useCallback` + `useEffect` for keyboard removal in Select mode (ignores keys when typing in inputs).
- `artifacts/tavernos/src/pages/session.tsx`: `handleTokenPlace` token type includes `imageData` and `ac`.
- `artifacts/tavernos/src/hooks/use-socket.ts`: `TokenData` already documents `imageData` / `ac`.

## Testing notes

- DM: Select tool → click token → **Remove token** or Delete/Backspace → token should disappear for all clients after refetch/socket invalidation.
- DM: Place Token → add image under size limit → place on map → portrait should appear in a circle; move token → image should remain.
