# Troubleshoot: Vite “does not provide an export named …” for `@workspace/api-client-react`

## Symptoms

- Browser console: `Uncaught SyntaxError: The requested module '…@workspace_api-client-react.js…' doesn't provide an export named 'useSomeHook'`.
- Often appears after **OpenAPI/codegen** adds new hooks or after **explicit re-exports** were added in `lib/api-client-react/src/index.ts`, while the dev server had been running with an older graph.

## Root causes (can stack)

1. **Stale Vite dependency cache** — `optimizeDeps.include` pre-bundles `@workspace/api-client-react` into `node_modules/.vite/deps/`. That snapshot can lag behind the current workspace source until the cache is invalidated or the server restarts.
2. **`export *` through a workspace package** — Some Vite setups do not surface every generated name through `export *` in the pre-bundle. This repo mitigates that by **explicitly re-exporting** critical hooks from `lib/api-client-react/src/index.ts` (see the same pattern as `useLogin` and the invite hooks).

## Fix (try in order)

1. **Restart** the TavernOS dev server (`pnpm --filter @workspace/tavernos run dev` with required `PORT` and `BASE_PATH`).
2. **Clear the Vite cache** and restart:
   - `rm -rf artifacts/tavernos/node_modules/.vite`
   - Optionally also: `rm -rf node_modules/.vite` (workspace root, if present)
3. **If the hook is new from codegen** — Add an **explicit** `export { useNewHook } from "./generated/api"` in `lib/api-client-react/src/index.ts` next to the other explicit hooks, then repeat step 2 if needed.

## Prevention

- After regenerating `lib/api-client-react/src/generated/api.ts`, any hook imported by `artifacts/tavernos` should either be covered by the explicit re-export list or verified in a fresh dev session.
- Prefer explicit re-exports for hooks used in the Vite app when adding new API surface area.
