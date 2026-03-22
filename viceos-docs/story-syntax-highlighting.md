# Story syntax highlighting (ViceOS)

**Date:** 2026-03-21

## Goal

Render DM / table **story** and **story → DM** bodies with editor-like semantic coloring: party names, NPCs, combatants, currency, gear categories, shops, and common creature vocabulary.

## Implementation

### New file: `artifacts/tavernos/src/components/vtt/story-syntax-highlight.tsx`

- **`buildStoryHighlightContext(characters, initiativeOrder)`**
  - **PCs:** campaign characters with `isNpc` not true — **sky / cyan** (`text-sky-300`, light glow).
  - **Friendly NPCs:** roster NPCs (`isNpc`) whose names are **not** on the current initiative list — **emerald**.
  - **Combatants:** initiative entries with `isNpc === true` — **rose** (typical enemies / tracked combat).
  - Name matching is **case-insensitive**; displayed text preserves the narrative’s casing.
  - Word-boundary rules avoid matching inside longer words.

- **Pattern passes** (after names, longest-first where applicable):
  - **Gold / currency:** `25 gp`, `10 silver pieces`, etc. — **amber**, `font-mono`.
  - **Magic / special items:** phrases like `Potion of …`, `Wand of …`, `+1 Longsword`, `Bag of Holding`, etc. — **violet**.
  - **Armor:** multi-word armor types + `shield` — **slate**.
  - **Weapons:** common 5e weapon names — **orange**.
  - **Clothing:** cloak, boots, robe, belt, etc. — **fuchsia**.
  - **Shop / trade:** merchant, clerk, tavern, bazaar, etc. — **amber**, italic.
  - **Creatures:** common stat-block vocabulary (goblin, zombie, guard, …) — **orange** (distinct from combatant names when those are proper nouns).

- **`StoryRichText`** — parses with `parseStoryToSegments`, merges adjacent plain runs, renders `<span>`s with Tailwind classes (no new global CSS file).

### Wired in

- **`message-bubble.tsx`** — `story` and `story_prompt` non-edit views use `StoryRichText` + optional `storyHighlightContext`.
- **`ChatPanel.tsx`** — `useMemo` builds context from `allCharacters` + `activeSession.initiativeOrder`, passed to `MessageBubble`.
- **`StoryMapOverlay.tsx`** — optional `storyHighlightContext` prop.
- **`session.tsx`** — same `buildStoryHighlightContext(characters ?? [], activeSession?.initiativeOrder)` passed to `StoryMapOverlay`.

## Limits

- **Shop clerks vs. friendly NPCs:** there is no separate “role” field on characters; **shop** styling is **regex-based** on trade vocabulary, not on tagging a specific NPC as a clerk.
- **Enemies vs. allies on initiative:** both use **combatant** color if `isNpc === true`; finer distinction would need new data (e.g. faction) from the API.

## Verification

- `pnpm --filter @workspace/tavernos run typecheck`
