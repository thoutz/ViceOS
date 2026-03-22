# Story panel filters and ViceOS rename

**Date:** 2026-03-21

## Story stream filters (`ChatPanel.tsx`)

- **Export:** `StoryFilterMode = 'all' | 'mine' | 'story'`.
- **State:** `storyFilter` (default `'all'`).
- **`displayedMessages`:** `useMemo` over `chatStreamMessages` (table talk; dice excluded).
  - **all:** full stream (unchanged).
  - **mine:** `senderId === currentUserId`; if `currentUserId` is missing, shows full stream (same as before).
  - **story:** only `type === 'story' || type === 'story_prompt'`.
- **UI:** `<select>` in expanded Story header; compact All / Mine / Story on collapsed row (`stopPropagation` on collapsed select so the row button does not fire).
- **Empty states:** no messages vs. no rows for current filter (suggests changing filter).
- **Scroll-to-bottom** dependency includes `displayedMessages.length`.
- **Labels:** User-facing **“Chat”** → **“Story”** (headers, collapse titles, related copy).

## App rename: TavernOS → ViceOS

### User-visible

- `artifacts/tavernos/index.html` — `<title>ViceOS</title>`
- `src/pages/login.tsx`, `dashboard.tsx`, `session.tsx` — titles / loading / share strings
- `src/components/vtt/SessionVideoControlBar.tsx` — LiveKit control label Story (was Chat)
- `artifacts/tavernos/.replit-artifact/artifact.toml` — `title = "ViceOS"`
- Root `README.md` — product name

### API / server

- `lib/api-spec/openapi.yaml` — `description: ViceOS API specification` (regenerate client if your workflow updates headers from spec)
- `artifacts/api-server/src/routes/sessions.ts` — LiveKit room name: `viceos-${sessionId}` (was `tavernos-${sessionId}`). **Note:** everyone in a session must use the same build; new room name disconnects from any old `tavernos-*` room for that session.
- `artifacts/api-server/src/services/load-session-for-ai.ts` — compiled markdown header `# ViceOS — AI session context`
- `artifacts/api-server/src/services/groq-dm-story-assistant.ts` — system prompt references ViceOS

### Client storage (with legacy read / migrate where safe)

| New key | Legacy | Notes |
|--------|--------|--------|
| `viceos_tab_id` | `tavernos_tab_id` | `App.tsx` + `use-socket.ts` |
| `viceos_theme` | `tavernos_theme` | `ThemeContext.tsx` — write new, remove legacy on `setTheme` |
| `viceos_story_overlay_dismissed_*` | `tavernos_story_overlay_dismissed_*` | `StoryMapOverlay.tsx` — merge sets, save new, remove legacy |
| `viceos_character_draft_v1_*` | `tavernos_character_draft_v1_*` | `character-creator.tsx` — load legacy if new empty, copy to new, remove legacy |

## Verification

- `pnpm --filter @workspace/tavernos run typecheck`
- API: `pnpm --filter @workspace/api-server exec tsc -p tsconfig.json --noEmit`

## CSS

- No new global CSS files; filter controls use existing Tailwind utility classes on the Story header / collapsed row.
