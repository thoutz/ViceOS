# Project documentation

This folder holds optional journals for **architecture**, **design**, and **new features**: implementation steps, notable CSS changes, how things were installed, and how they fit together.

Add a new markdown file per significant change so the history stays easy to follow.

## After API or client changes (read this first)

- **[post-change-build-checklist.md](./post-change-build-checklist.md)** — codegen, explicit re-exports for TavernOS, `pnpm run typecheck`, Vite cache, API restart. **Do not skip** after OpenAPI edits or merges.

## Troubleshooting

- **Vite / `@workspace/api-client-react` missing exports:** [troubleshoot-vite-stale-api-client-cache.md](./troubleshoot-vite-stale-api-client-cache.md)
- **Replit / dev: port 8080 conflict, stale Vite after merges:** [troubleshoot-replit-dev-services.md](./troubleshoot-replit-dev-services.md)
