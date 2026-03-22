import React, { useEffect, useMemo, useState } from 'react';
import type { ChatMessage } from '@workspace/api-client-react';
import { BookOpen, Sparkles, X } from 'lucide-react';
import { StoryRichText, type StoryHighlightContext } from './story-syntax-highlight';

const storageKey = (sessionId: string) => `viceos_story_overlay_dismissed_${sessionId}`;
const legacyStorageKey = (sessionId: string) => `tavernos_story_overlay_dismissed_${sessionId}`;

function parseDismissedRaw(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function loadDismissed(sessionId: string): Set<string> {
  const next = parseDismissedRaw(
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(storageKey(sessionId)) : null,
  );
  const legacy = parseDismissedRaw(
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(legacyStorageKey(sessionId)) : null,
  );
  const merged = new Set([...next, ...legacy]);
  if (legacy.size > 0 && typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(storageKey(sessionId), JSON.stringify([...merged]));
      sessionStorage.removeItem(legacyStorageKey(sessionId));
    } catch {
      /* ignore */
    }
  }
  return merged;
}

function saveDismissed(sessionId: string, ids: Set<string>) {
  try {
    sessionStorage.setItem(storageKey(sessionId), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

interface StoryMapOverlayProps {
  sessionId: string;
  messages: ChatMessage[];
  /** Same as Story panel — PCs, NPCs, initiative combatants + pattern highlights */
  storyHighlightContext?: StoryHighlightContext | null;
}

/**
 * Full-width overlay within the map column: shows the latest non-dismissed story message
 * for all users; dismiss is per-browser only.
 */
export function StoryMapOverlay({ sessionId, messages, storyHighlightContext }: StoryMapOverlayProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed(sessionId));

  useEffect(() => {
    setDismissed(loadDismissed(sessionId));
  }, [sessionId]);

  const pendingStory = useMemo(() => {
    const stories = messages
      .filter((m) => m.type === 'story')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const s of stories) {
      if (!dismissed.has(s.id)) return s;
    }
    return null;
  }, [messages, dismissed]);

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(sessionId, next);
      return next;
    });
  };

  if (!pendingStory) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-end justify-center p-3 md:p-6 pointer-events-none"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto w-full max-w-2xl max-h-[min(48vh,420px)] flex flex-col rounded-xl border-2 border-primary/40 bg-gradient-to-b from-card/98 to-background/98 shadow-[0_12px_48px_rgba(0,0,0,0.65)] backdrop-blur-sm overflow-hidden"
        role="dialog"
        aria-label="Story from assistant"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-primary/25 bg-primary/5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-magic shrink-0" aria-hidden />
            <span className="text-xs font-sans font-bold uppercase tracking-widest text-primary truncate">
              Story
            </span>
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-70" aria-hidden />
          </div>
          <button
            type="button"
            onClick={() => dismiss(pendingStory.id)}
            className="shrink-0 p-1.5 rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
            title="Dismiss"
            aria-label="Dismiss story overlay"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm font-sans text-foreground leading-relaxed whitespace-pre-wrap">
            <StoryRichText text={pendingStory.content} context={storyHighlightContext} />
          </p>
        </div>
        <div className="px-4 py-2.5 border-t border-border/40 bg-black/20 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={() => dismiss(pendingStory.id)}
            className="text-xs font-sans font-bold uppercase tracking-wide px-4 py-2 rounded-md border border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
