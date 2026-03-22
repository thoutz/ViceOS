# Troubleshoot: Replit / dev — API port conflict & frontend cache

> **Routine workflow after API/client changes:** **[post-change-build-checklist.md](./post-change-build-checklist.md)** (codegen → explicit exports → `pnpm run typecheck` → clear Vite cache if needed).

Common issues after **merges**, **workflow restarts**, or **codegen** changes when running the API server and TavernOS (Vite) together (e.g. on Replit).

---

## Problem 1 — API server port conflict (`EADDRINUSE`)

### Symptoms

- API server fails to start with **`EADDRINUSE`** (address already in use), often on **port 8080** (see `artifacts/api-server` / workflow config).
- A **previous** Node process is still bound to that port after a crash, hot reload, or duplicate start.

### Fix

1. Find and stop the process using the port (example for **8080** on Linux/Replit):

   ```bash
   lsof -i :8080
   # or
   ss -tlnp | grep 8080
   ```

2. **Kill** the lingering PID (replace `<pid>`):

   ```bash
   kill <pid>
   # if it won't exit:
   kill -9 <pid>
   ```

3. **Restart** the API server workflow so it binds **8080** cleanly.

### Prevention

- Avoid starting the API twice (e.g. duplicate Run / background task).
- Prefer a single workflow that stops the old process before starting a new one, if your host supports it.

---

## Problem 2 — Stale Vite dependency cache (missing exports from `@workspace/api-client-react`)

### Symptoms

- Browser/runtime: **`does not provide an export named '…'`** for a symbol that **does** exist in `lib/api-client-react/src/generated/api.ts` (e.g. **`getGetSessionAiContextQueryKey`**, a new **`use*`** hook, etc.).
- Often shows up **after a merge** that added **OpenAPI/codegen** output (new routes, LiveKit, AI context, Groq, etc.) while Vite’s pre-bundle stayed old.

### Root cause

Same class as [troubleshoot-vite-stale-api-client-cache.md](./troubleshoot-vite-stale-api-client-cache.md). Older setups used **`optimizeDeps.include`** for `@workspace/api-client-react`, which cached a stale snapshot under `node_modules/.vite/deps/`. **Current `vite.config.ts` uses `optimizeDeps.exclude`** for that package so dev tracks the workspace source; clear the `.vite` folder once after pulling that change if errors persist.

### Fix (try in order)

1. **Restart** the TavernOS dev server.
2. **Delete Vite’s cache** and restart:

   ```bash
   rm -rf artifacts/tavernos/node_modules/.vite
   rm -rf node_modules/.vite
   ```

3. Ensure **`lib/api-client-react/src/index.ts`** **explicitly re-exports** anything TavernOS imports that isn’t reliably picked up via `export *` — including **`get*QueryKey`** helpers used with TanStack Query’s `query: { queryKey: … }` (see existing pattern for `getGetSessionAiContextQueryKey`, invite hooks, `useLogin`, etc.).

### Prevention

- After **`pnpm --filter @workspace/api-spec run codegen`**, update explicit re-exports when adding new client surface used by `artifacts/tavernos`.
- See also: [project-docs/troubleshoot-vite-stale-api-client-cache.md](./troubleshoot-vite-stale-api-client-cache.md) and `.cursor/rules/tavernos-api-client-vite.mdc`.

---

## Quick checklist when “nothing starts” after a merge

See the full ordered list in **[post-change-build-checklist.md](./post-change-build-checklist.md)**. Short version:

1. **8080 free?** → kill stale API process, restart API.
2. **Frontend weird import errors?** → clear **`artifacts/tavernos/node_modules/.vite`** (and root **`node_modules/.vite`** if present), restart Vite.
3. **`pnpm --filter @workspace/api-spec run codegen`** run and **`lib/api-client-react/src/index.ts`** explicit exports updated?
4. **`pnpm run typecheck`** clean?
