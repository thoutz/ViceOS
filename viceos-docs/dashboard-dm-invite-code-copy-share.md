# Dashboard: DM invite code — view, copy, share

## Change

On the dashboard campaign cards, **Dungeon Master** campaigns now show:

- Label **Player invite code**
- Monospace, `select-all` code block (easy manual copy)
- **Copy** — `navigator.clipboard.writeText(inviteCode)` + toast
- **Share** — `navigator.share({ title, text })` when available; otherwise copies a full sentence (`Join my campaign "…" on TavernOS. Invite code: …`) + toast

Clicks on the invite row use `stopPropagation` so Copy/Share do not navigate into the session.

**Player** cards no longer show the raw invite code in the footer (short line: “You are a player in this party.”); the code remains in API payloads if needed later.

## Files

- `artifacts/tavernos/src/pages/dashboard.tsx` — `copyInviteCode`, `shareOrCopyInvite`, footer JSX
- Uses `@/hooks/use-toast` for feedback
