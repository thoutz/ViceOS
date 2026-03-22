# Investigate: campaign join `POST /api/campaigns/join` 404

## Finding

The handler **exists** on the API (`POST /api/campaigns/join`). A **404** in production often means the **browser never reached Express** — e.g. Replit **static-only** web deploy with no **`/api` → API** route — not necessarily an invalid invite code.

## Code / config changes

- **`.replit`**: added `[[artifacts]] id = "artifacts/tavernos"` so deployment can include the web app alongside the API for path routing.
- **`artifacts/tavernos/vite.config.ts`**: **`preview.proxy`** for `/api` and `/socket.io` (same as dev), so `vite preview` + local API on 8080 works.
- **`artifacts/tavernos/src/main.tsx`**: optional **`VITE_API_BASE_URL`** → `setBaseUrl()` for split-host deployments.
- **`artifacts/tavernos/src/pages/dashboard.tsx`**: show join **mutation error message** in the modal.
- **`project-docs/troubleshoot-campaign-join-404-replit.md`**: full write-up.
