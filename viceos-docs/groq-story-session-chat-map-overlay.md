# Groq story assistant → session chat & map overlay

## Goal

When the DM uses **Send to assistant** (Groq), the reply is persisted as a **`story`** chat message so the table sees it in chat. DMs can delete those posts (API + Socket.IO). A **dismissible overlay on the map** shows the latest non-dismissed story (per-browser `sessionStorage`, independent of DM delete).

## Backend (already in place before this pass)

- OpenAPI: `story` on `ChatMessage` / `PostMessageRequest`; `DELETE /campaigns/{campaignId}/sessions/{sessionId}/messages/{messageId}` (`deleteMessage`).
- API: DM-only POST `type: story`; DELETE story-only + `emitToSessionRoom(..., "chat_message_deleted", { messageId })`.

## Frontend changes

### `artifacts/tavernos/src/hooks/use-socket.ts`

- Listen for `chat_message_deleted` and invalidate the same messages query key as `chat_message`.

### `artifacts/tavernos/src/pages/session.tsx`

- Import `useDeleteMessage`, `StoryMapOverlay`.
- `handleDeleteStoryMessage` → `deleteMessage` mutation + `refetchMessages` on success.
- Extend `handleSendMessage` union with `'story'`.
- **Groq success path:** after `usePostDmStoryAssistant` succeeds, `postMessage` with `{ content: reply, type: 'story' }`, then `emit('chat_message', { message: msg })`.
- Center map column (`flex-1 relative`): render `<StoryMapOverlay sessionId={...} messages={...} />` above the map (same column, `z-30` in overlay).
- Pass `onDeleteStoryMessage` / `deletingStoryMessageId` to both `ChatPanel` instances (communications + DM drawer).

### `artifacts/tavernos/src/components/vtt/StoryMapOverlay.tsx` (new)

- Latest `story` message not in `sessionStorage` set `tavernos_story_overlay_dismissed_${sessionId}`.
- Dismiss control (X + button); `pointer-events-none` on shell, `pointer-events-auto` on card so the map stays usable outside the card.

### `artifacts/tavernos/src/components/vtt/ChatPanel.tsx`

- `MessageType` includes `story`.
- Optional `onDeleteStoryMessage`, `deletingStoryMessageId` passed to `MessageBubble`.

### `artifacts/tavernos/src/components/vtt/message-bubble.tsx`

- Branch for `msg.type === 'story'`: amber “Story” styling; DM-only delete (X) calling `onDeleteStoryMessage`.

### `artifacts/tavernos/src/components/vtt/RollsPanel.tsx`

- `MessageType` union extended with `story` for handler typing consistency.

## TypeScript / workspace

`tavernos` references `lib/api-client-react` with `composite` emit. After OpenAPI/codegen changes, rebuild declarations:

```bash
pnpm exec tsc -b lib/api-client-react
```

Then `pnpm --filter @workspace/tavernos run typecheck`.

## Verification

- `pnpm --filter @workspace/tavernos run typecheck`
- Manual: DM sends Groq story → appears in chat + overlay; dismiss overlay locally; DM deletes story → gone for all clients via socket invalidation.
