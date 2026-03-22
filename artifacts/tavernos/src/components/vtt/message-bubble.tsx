import React, { useState, useEffect } from 'react';
import { ChatMessage } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { X, Pencil, Pin, Check } from 'lucide-react';
import { StoryRichText, type StoryHighlightContext } from './story-syntax-highlight';

export function MessageBubble({
  msg,
  isDm,
  onDeleteStoryMessage,
  isDeletingStory,
  currentUserId,
  onPatchMessage,
  patchMessagePending,
  storyHighlightContext,
}: {
  msg: ChatMessage;
  isDm?: boolean;
  onDeleteStoryMessage?: (messageId: string) => void;
  isDeletingStory?: boolean;
  currentUserId?: string;
  onPatchMessage?: (messageId: string, data: { content?: string; pinnedForStoryAi?: boolean }) => void;
  patchMessagePending?: boolean;
  /** Campaign + initiative–aware coloring for story / story_prompt bodies */
  storyHighlightContext?: StoryHighlightContext | null;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);

  useEffect(() => {
    setEditText(msg.content);
    setEditing(false);
  }, [msg.id, msg.content]);

  const isSystem = msg.type === 'system';
  const isDice = msg.type === 'dice';
  const isWhisper = msg.type === 'whisper';
  const isStory = msg.type === 'story';
  const isStoryPrompt = msg.type === 'story_prompt';
  const pinned = Boolean(msg.pinnedForStoryAi);

  const canEditContent =
    onPatchMessage &&
    !isDice &&
    !isSystem &&
    (isDm || (isStoryPrompt && currentUserId === msg.senderId));

  const canPin = isDm && onPatchMessage && !isDice && !isSystem;

  const saveEdit = () => {
    const t = editText.trim();
    if (!t || !onPatchMessage) return;
    onPatchMessage(msg.id, { content: t });
    setEditing(false);
  };

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-primary/10 border border-primary/30 text-primary/80 px-3 py-1 rounded-full text-[10px] font-sans uppercase tracking-wider">
          {msg.content}
        </div>
      </div>
    );
  }

  if (isStoryPrompt) {
    return (
      <div className="relative rounded-lg border border-violet-500/35 bg-violet-950/20 p-2.5 pr-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-violet-300">
              Story → DM
            </span>
            {pinned && (
              <span className="text-[9px] font-sans font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                Pinned for AI
              </span>
            )}
          </div>
          <span className="text-[9px] text-muted-foreground shrink-0">
            {format(new Date(msg.createdAt), 'HH:mm')}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground font-sans mb-1">{msg.senderName}</div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full text-sm bg-background border border-border rounded px-2 py-1.5 font-sans text-foreground"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={patchMessagePending || !editText.trim()}
                className="text-[10px] font-sans font-bold px-2 py-1 rounded bg-primary/20 text-primary border border-primary/40"
              >
                <Check className="w-3 h-3 inline mr-1" />
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditText(msg.content);
                  setEditing(false);
                }}
                className="text-[10px] text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-foreground/95 font-sans leading-relaxed whitespace-pre-wrap">
            <StoryRichText text={msg.content} context={storyHighlightContext} />
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {canEditContent && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] font-sans flex items-center gap-1 px-2 py-0.5 rounded border border-border/60 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
          {canPin && (
            <button
              type="button"
              onClick={() => onPatchMessage!(msg.id, { pinnedForStoryAi: !pinned })}
              disabled={patchMessagePending}
              className={`text-[10px] font-sans flex items-center gap-1 px-2 py-0.5 rounded border ${
                pinned
                  ? 'border-amber-500/50 text-amber-200 bg-amber-500/10'
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pin className="w-3 h-3" />
              {pinned ? 'Unpin' : 'Pin for AI'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isStory) {
    return (
      <div
        className={`relative rounded-lg border border-accent/30 bg-gradient-to-br from-card/90 to-background/95 p-2.5 shadow-[inset_0_1px_0_rgba(112,255,223,0.10)] ${
          isDm && onDeleteStoryMessage ? 'pr-8' : ''
        }`}
      >
        {isDm && onDeleteStoryMessage && (
          <button
            type="button"
            title="Remove story from chat"
            disabled={isDeletingStory}
            onClick={() => onDeleteStoryMessage(msg.id)}
            className="absolute top-1.5 right-1.5 p-1 rounded border border-border/50 text-muted-foreground hover:bg-white/10 hover:text-foreground disabled:opacity-40 transition-colors"
            aria-label="Delete story message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-accent">
              Story
            </span>
            {pinned && (
              <span className="text-[8px] font-sans font-bold uppercase px-1 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/35">
                Pinned
              </span>
            )}
          </div>
          <span className="text-[9px] text-muted-foreground shrink-0">
            {format(new Date(msg.createdAt), 'HH:mm')}
          </span>
        </div>
        <div className="text-sm text-foreground font-sans leading-relaxed whitespace-pre-wrap">
          <StoryRichText text={msg.content} context={storyHighlightContext} />
        </div>
        {isDm && onPatchMessage && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onPatchMessage(msg.id, { pinnedForStoryAi: !pinned })}
              disabled={patchMessagePending}
              className={`text-[10px] font-sans flex items-center gap-1 px-2 py-0.5 rounded border ${
                pinned
                  ? 'border-amber-500/50 text-amber-200 bg-amber-500/10'
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pin className="w-3 h-3" />
              {pinned ? 'Unpin' : 'Pin for AI'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${isWhisper ? 'bg-magic/10 border border-magic/30 rounded p-2' : ''}`}>
      <div className="flex items-center justify-between mb-0.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-sans font-bold text-xs truncate ${isWhisper ? 'text-magic' : 'text-primary'}`}>
            {msg.senderName}
            {isWhisper && <span className="ml-1 opacity-70">(Whisper)</span>}
          </span>
          {pinned && (
            <span className="text-[8px] font-sans font-bold uppercase px-1 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/35 shrink-0">
              Pinned
            </span>
          )}
        </div>
        <span className="text-[9px] text-muted-foreground shrink-0">
          {format(new Date(msg.createdAt), 'HH:mm')}
        </span>
      </div>

      {isDice && msg.diceData ? (
        <div className="bg-background border border-border/50 rounded p-2.5 mt-1">
          <div className="text-xs text-muted-foreground mb-1">{msg.content}</div>
          <div className="font-mono text-xs break-all bg-card p-1.5 rounded border border-border/40 text-foreground/80">
            {(msg.diceData as { output: string; total: number }).output}
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-2xl font-bold font-sans text-accent">{(msg.diceData as { output: string; total: number }).total}</span>
          </div>
        </div>
      ) : editing ? (
        <div className="mt-1 space-y-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full text-sm bg-background border border-border rounded px-2 py-1.5 font-sans"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={patchMessagePending || !editText.trim()}
              className="text-[10px] font-sans font-bold px-2 py-1 rounded bg-primary/20 text-primary"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setEditText(msg.content);
                setEditing(false);
              }}
              className="text-[10px] text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap">{msg.content}</div>
      )}

      {(canEditContent || canPin) && !isDice && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {canEditContent && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10px] font-sans flex items-center gap-1 px-2 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
          {canPin && (
            <button
              type="button"
              onClick={() => onPatchMessage!(msg.id, { pinnedForStoryAi: !pinned })}
              disabled={patchMessagePending}
              className={`text-[10px] font-sans flex items-center gap-1 px-2 py-0.5 rounded border ${
                pinned
                  ? 'border-amber-500/50 text-amber-200 bg-amber-500/10'
                  : 'border-border/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pin className="w-3 h-3" />
              {pinned ? 'Unpin' : 'Pin for AI'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
