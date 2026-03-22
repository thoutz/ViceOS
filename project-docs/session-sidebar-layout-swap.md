# Session page — sidebar layout (chat/video left, character right)

## What changed

- **Left sidebar (~400px):** Party **communications** — LiveKit **video** on top, then **Chat** only (`ChatPanel` `communications`). Dice messages are **not** listed here (they appear only under **Rolls** on the right).
- **Right sidebar (~400px):** Tabs **Sheet** | **Rolls** — character sheet and full dice log + quick rolls (`RollsPanel`).
- **Header:** Left toggle uses **MessageSquare** (“Party chat & video”); right toggle uses **User** (“Character sheet”).
- **DM Command Center drawer:** Uses `ChatPanel` with `panelVariant="dmTools"` — only `DmToolsPanel` (no duplicate chat/video tabs).

## Files

- [`artifacts/tavernos/src/pages/session.tsx`](../artifacts/tavernos/src/pages/session.tsx) — panel swap, widths, icons.
- [`artifacts/tavernos/src/components/vtt/ChatPanel.tsx`](../artifacts/tavernos/src/components/vtt/ChatPanel.tsx) — `ChatPanelVariant`, `communications` vs `dmTools` layouts.
- [`artifacts/tavernos/src/components/vtt/SessionVideoCall.tsx`](../artifacts/tavernos/src/components/vtt/SessionVideoCall.tsx) — optional `className` for flex sizing in the left column.

## CSS / layout notes

- Left/right panels use `min-h-0`, `flex flex-col` where needed, and responsive widths `w-[min(100vw,400px)]` / `380px` for mobile overlays.
- Video block height: `h-[min(240px,34vh)]` so chat+dice keep space on short viewports.
