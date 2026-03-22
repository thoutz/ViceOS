# Troubleshoot: `POST /api/campaigns/join` returns 404

## Symptoms

- Browser console: **`POST …/api/campaigns/join` → `404 (Not Found)`** when a player submits an invite code.
- The **API route exists** in this repo: `artifacts/api-server/src/routes/campaigns.ts` registers **`POST /campaigns/join`**, mounted at **`/api`** in `app.ts`, so the full path is **`POST /api/campaigns/join`**.

## Two different 404s

1. **Infrastructure / routing 404** — The HTTP request **never hits Express**. Typical on Replit when the **web artifact** is served as **static files only**: `POST /api/...` is not a static file, so the CDN/static server responds **404** (or similar). This is **not** “wrong invite code.”
2. **Application 404** — Express handles the request and returns **`404` + JSON** `{ "error": "Campaign not found" }` when the invite code does not match any campaign (after trim + uppercase). That **is** a wrong or stale code (or wrong database).

## Fixes

### A. Path-based routing (Replit autoscale — preferred)

- Ensure **both** deployable artifacts are registered and routed:
  - **API** (`artifacts/api-server`): serves paths under **`/api`** (see `artifacts/api-server/.replit-artifact/artifact.toml`).
  - **Web** (`artifacts/tavernos`): serves **`/`** as static SPA.
- The root **`.replit`** file lists `[[artifacts]]` entries; **`artifacts/tavernos`** must be included so the hosted UI and API are deployed together with the router sending **`/api/*`** to the API service.

After redeploy, **`GET /api/healthz`** (or your configured health path) should return **200** from the **same host** you use for the app.

### B. Split origins — `VITE_API_BASE_URL`

If the UI is served from a host that **does not** reverse-proxy `/api` to the API, set at **build time**:

```bash
VITE_API_BASE_URL=https://your-api-deployment-host
```

The app calls `setBaseUrl` in `artifacts/tavernos/src/main.tsx` when this variable is set. The API already uses **`cors({ origin: true, credentials: true })`**; session cookies require the browser to send **`credentials: "include"`** (already used by `customFetch`).

### C. Local `vite preview`

`vite.config.ts` mirrors the dev **`server.proxy`** under **`preview.proxy`** so **`pnpm --filter @workspace/tavernos run build && vite preview`** can forward **`/api`** to **`http://localhost:8080`** while the API runs locally.

## Related files

- `artifacts/tavernos/.replit-artifact/artifact.toml` — production **`serve = "static"`** (no in-process API; routing must be external).
- `artifacts/tavernos/vite.config.ts` — **`server.proxy`** / **`preview.proxy`** for `/api` and `/socket.io`.
- `artifacts/tavernos/src/main.tsx` — optional **`VITE_API_BASE_URL`**.
