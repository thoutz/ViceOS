# Troubleshoot: Vite “does not provide an export named …” for `@workspace/api-client-react`

> **Before changing the API client:** follow **[post-change-build-checklist.md](./post-change-build-checklist.md)** so codegen, explicit re-exports, typecheck, and Vite cache steps are not skipped.

## Symptoms

- Browser console: `Uncaught SyntaxError: The requested module '…@workspace_api-client-react.js…' doesn't provide an export named 'useSomeHook'`.
- Same error class for **non-hook** exports from the generated client, e.g. **`getGetSessionAiContextQueryKey`** (used with TanStack Query `queryKey`), if the pre-bundle is stale or `export *` did not surface the name.
- Often appears after **OpenAPI/codegen** adds new hooks or query helpers, or after a **merge** that expanded the API client (e.g. LiveKit, AI context, Groq), while the dev server kept an **older** optimized dependency graph.

## Root causes (can stack)

1. **Stale Vite dependency cache** — If `@workspace/api-client-react` was ever **pre-bundled** (`optimizeDeps.include`), the copy under `node_modules/.vite/deps/` could lag behind codegen / `index.ts` until the cache is deleted. **Current TavernOS config:** `optimizeDeps.exclude: ["@workspace/api-client-react"]` so dev uses live workspace sources (clear cache once after upgrading to this config).
2. **`export *` through a workspace package** — Some Vite setups do not surface every generated name through `export *` in a pre-bundle. This repo **explicitly re-exports** hooks and query helpers from `lib/api-client-react/src/index.ts` (see `useLogin`, invites, `useDeleteCampaign`, etc.).

## Fix (try in order)

1. **Restart** the TavernOS dev server (`pnpm --filter @workspace/tavernos run dev` with required `PORT` and `BASE_PATH`).
2. **Clear the Vite cache** and restart:
   - `rm -rf artifacts/tavernos/node_modules/.vite`
   - Optionally also: `rm -rf node_modules/.vite` (workspace root, if present)
3. **If the symbol is new from codegen** — Add an **explicit** re-export in `lib/api-client-react/src/index.ts`, e.g. `export { useNewHook, getNewQueryKey } from "./generated/api"`, next to the existing block (`useLogin`, invite hooks, `useGetSessionAiContext`, `getGetSessionAiContextQueryKey`, etc.), then repeat step 2 if needed.

## Prevention

- After regenerating `lib/api-client-react/src/generated/api.ts`, any **`use*`** hook **or `get*QueryKey` helper** imported by `artifacts/tavernos` should be covered by the **explicit** re-export list in `index.ts`, then verified after a cache-clear if needed.
- Prefer explicit re-exports for all generated symbols used by the Vite app when adding new API surface area.

## Related

- **API server `EADDRINUSE` on 8080** (stale process): [troubleshoot-replit-dev-services.md](./troubleshoot-replit-dev-services.md).
