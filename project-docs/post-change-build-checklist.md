# Post-change build checklist (do not skip)

Use this **every time** you change the **OpenAPI spec**, **add API routes**, **regenerate the client**, or **merge** work that touched `lib/api-spec` or `lib/api-client-react`. Skipping a step is the usual cause of “works in TS but breaks in the browser” or stale bundles.

---

## 1. OpenAPI changed?

If you edited **`lib/api-spec/openapi.yaml`** (new paths, schemas, `operationId`s):

```bash
pnpm --filter @workspace/api-spec run codegen
```

This refreshes **`lib/api-client-react/src/generated/api.ts`** (and related outputs).

---

## 2. Explicit re-exports (TavernOS + Vite)

TavernOS pre-bundles **`@workspace/api-client-react`** (`optimizeDeps.include`). Some generated symbols do not survive **`export *`** in the optimized bundle.

**After codegen**, for **every** new symbol that **`artifacts/tavernos`** imports from `@workspace/api-client-react` and that comes from **`generated/api`** (hooks, `get*QueryKey`, etc.):

- Add it to the **named** `export { … } from "./generated/api"` block in **`lib/api-client-react/src/index.ts`** (same file as `useLogin`, invite hooks, `useGetSessionAiContext`, `getGetSessionAiContextQueryKey`, `usePostDmStoryAssistant`, `useDeleteCampaign`, …).

Types-only imports from **`api.schemas`** are usually fine via `export *`; the risky ones are **runtime** exports used as **values** (hooks, functions).

**Rule of thumb:** If you add `useNewThing` or `getNewThingQueryKey` in a `*.tsx` under `artifacts/tavernos`, add it to **`index.ts`** in the same PR.

---

## 3. Typecheck (repo root)

```bash
pnpm run typecheck
```

Fix all errors before considering the change done.

---

## 4. Vite dependency cache (after client changes or merges)

**Config note:** `artifacts/tavernos/vite.config.ts` sets **`optimizeDeps.exclude: ["@workspace/api-client-react"]`** so the linked workspace client is **not** frozen in `node_modules/.vite/deps/`. You should see far fewer stale-export errors.

If you still get **`does not provide an export named '…'`** (old cache, other deps, or a branch without the exclude):

```bash
rm -rf artifacts/tavernos/node_modules/.vite
rm -rf node_modules/.vite
```

Then **restart** the TavernOS dev server (`PORT` and `BASE_PATH` required per `vite.config.ts`).

Details: [troubleshoot-vite-stale-api-client-cache.md](./troubleshoot-vite-stale-api-client-cache.md).

---

## 5. API server on Replit / local

- If **`EADDRINUSE`** on **8080**: free the port (kill old Node) and restart. See [troubleshoot-replit-dev-services.md](./troubleshoot-replit-dev-services.md).
- After changing **server** code: rebuild/restart the API process so **`dist`** matches **source** (per your workflow).

---

## Quick copy-paste (API surface + frontend)

```bash
pnpm --filter @workspace/api-spec run codegen
# → edit lib/api-client-react/src/index.ts explicit exports if TavernOS imports new generated values
pnpm run typecheck
# → if browser import errors: rm -rf artifacts/tavernos/node_modules/.vite node_modules/.vite && restart Vite
```

---

## References

| Topic | Doc |
|--------|-----|
| Vite stale pre-bundle / missing exports | [troubleshoot-vite-stale-api-client-cache.md](./troubleshoot-vite-stale-api-client-cache.md) |
| Port 8080 conflict, merge + cache | [troubleshoot-replit-dev-services.md](./troubleshoot-replit-dev-services.md) |
| Cursor rule for agents | `.cursor/rules/tavernos-api-client-vite.mdc` |
