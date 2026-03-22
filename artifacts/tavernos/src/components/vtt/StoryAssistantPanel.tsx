/**
 * DM Story assistant UI (Command Center drawer).
 *
 * Backend: Groq OpenAI-compatible chat completions (server-side only).
 * Default model: meta-llama/llama-4-scout-17b-16e-instruct — see
 * `artifacts/api-server/src/services/groq-dm-story-assistant.ts`.
 * Server env: GROQ_API_KEY.
 *
 * Flow: Ask/plan in chat (multi-turn); post chosen text to table chat as type `story` when ready.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  usePostDmStoryAssistant,
  type DmStoryAssistantRequestConversationHistoryItem,
  type DmStoryAssistantRequestResponseStyle,
} from '@workspace/api-client-react';
import { Sparkles, Send, Trash2, MessageSquarePlus } from 'lucide-react';

type LocalMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  responseStyle?: DmStoryAssistantRequestResponseStyle;
};

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Parse **Variant A/B/C** sections; returns three bodies or null. */
export function parseStoryVariants(reply: string): [string, string, string] | null {
  const mA = reply.match(/\*\*Variant\s*A\*\*\s*([\s\S]*?)(?=\*\*Variant\s*B\*\*)/i);
  const mB = reply.match(/\*\*Variant\s*B\*\*\s*([\s\S]*?)(?=\*\*Variant\s*C\*\*)/i);
  const mC = reply.match(/\*\*Variant\s*C\*\*\s*([\s\S]*)/i);
  if (!mA || !mB || !mC) return null;
  const a = mA[1].trim();
  const b = mB[1].trim();
  const c = mC[1].trim();
  if (!a || !b || !c) return null;
  return [a, b, c];
}

interface StoryAssistantPanelProps {
  campaignId: string;
  sessionId: string;
  /** Publish plain text to session chat as a `story` message (parent handles API + socket). */
  onPostStoryToTable: (plainText: string) => void;
}

export function StoryAssistantPanel({
  campaignId,
  sessionId,
  onPostStoryToTable,
}: StoryAssistantPanelProps) {
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [includeStoryContext, setIncludeStoryContext] = useState(true);
  const [responseStyle, setResponseStyle] = useState<DmStoryAssistantRequestResponseStyle>('single');
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const storyAssistantMutation = usePostDmStoryAssistant();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, storyAssistantMutation.isPending]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setSendError(null);
  }, []);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !campaignId || !sessionId) return;

    const history: DmStoryAssistantRequestConversationHistoryItem[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const userMsg: LocalMsg = { id: newId(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setSendError(null);

    storyAssistantMutation.mutate(
      {
        campaignId,
        sessionId,
        data: {
          message: text,
          includeSessionContext: includeStoryContext,
          conversationHistory: history.length > 0 ? history : undefined,
          responseStyle,
        },
      },
      {
        onSuccess: (data) => {
          const reply = data.reply?.trim() || '';
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: 'assistant',
              content: reply,
              responseStyle,
            },
          ]);
        },
        onError: (err: unknown) => {
          setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
          setSendError(err instanceof Error ? err.message : 'Story assistant request failed.');
        },
      }
    );
  };

  return (
    <div className="shrink-0 border-b border-border/50 flex flex-col h-[min(52vh,420px)] min-h-[240px] bg-[#1a1a1c] text-[#cccccc]">
      <div className="px-3 py-2 border-b border-[#2d2d30] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#e0e0e0] truncate">
            Story assistant
          </span>
        </div>
        <button
          type="button"
          onClick={clearChat}
          disabled={messages.length === 0}
          className="flex items-center gap-1 text-[10px] text-[#888] hover:text-[#ccc] disabled:opacity-30 px-2 py-1 rounded border border-transparent hover:border-[#3c3c3c]"
          title="Clear planning chat"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      <div className="px-3 py-2 space-y-2 border-b border-[#2d2d30]">
        <label className="flex items-center gap-2 text-[10px] text-[#aaa] cursor-pointer select-none">
          <input
            type="checkbox"
            className="rounded border-[#555] bg-[#252526]"
            checked={includeStoryContext}
            onChange={(e) => setIncludeStoryContext(e.target.checked)}
          />
          Include compiled session &amp; campaign context
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-[#888] uppercase tracking-wide">Reply style</span>
          <select
            value={responseStyle}
            onChange={(e) =>
              setResponseStyle(e.target.value as DmStoryAssistantRequestResponseStyle)
            }
            className="text-[10px] bg-[#252526] border border-[#3c3c3c] rounded px-2 py-1 text-[#ddd] font-sans"
          >
            <option value="single">One reply</option>
            <option value="variants">Three variants (A / B / C)</option>
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-[160px] overflow-y-auto px-3 py-2 space-y-3 font-sans text-[13px] leading-relaxed">
        {messages.length === 0 && !storyAssistantMutation.isPending && (
          <p className="text-[11px] text-[#888] leading-snug">
            Plan with the assistant here (Ask mode). When you are ready, post narration to the table
            from an assistant reply — it is not sent to players until you choose.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[92%] rounded-lg px-3 py-2 ${
                m.role === 'user'
                  ? 'bg-[#2d2d30] text-[#e0e0e0] border border-[#3c3c3c]'
                  : 'bg-[#252526] text-[#d4d4d4] border border-[#3c3c3c]'
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider opacity-60 mb-1 font-medium">
                {m.role === 'user' ? 'You' : 'Assistant'}
              </div>
              <div className="whitespace-pre-wrap break-words">{m.content}</div>
              {m.role === 'assistant' && m.content.trim() && (
                <div className="mt-2 pt-2 border-t border-[#3c3c3c] flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPostStoryToTable(m.content.trim())}
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-violet-600/25 text-violet-200 border border-violet-500/40 hover:bg-violet-600/40"
                  >
                    <MessageSquarePlus className="w-3 h-3" />
                    Post to table
                  </button>
                  {m.responseStyle === 'variants' && parseStoryVariants(m.content) && (
                    <>
                      {(['A', 'B', 'C'] as const).map((letter, i) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => {
                            const v = parseStoryVariants(m.content);
                            if (v) onPostStoryToTable(v[i]);
                          }}
                          className="text-[10px] font-medium px-2 py-1 rounded border border-[#555] text-[#ccc] hover:bg-[#3c3c3c]"
                        >
                          Post {letter}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {storyAssistantMutation.isPending && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-[#252526] border border-[#3c3c3c] text-[11px] text-[#888] animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {sendError && (
        <p className="px-3 text-[10px] text-red-400 font-sans">{sendError}</p>
      )}

      <div className="p-2 border-t border-[#2d2d30] flex gap-2 items-end">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask, plan, or request narration… (Enter to send, Shift+Enter newline)"
          rows={2}
          className="flex-1 min-h-[44px] max-h-28 bg-[#252526] border border-[#3c3c3c] rounded-md px-2.5 py-2 text-[12px] text-[#e0e0e0] placeholder:text-[#666] focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-y font-sans"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={storyAssistantMutation.isPending || !draft.trim() || !sessionId}
          className="shrink-0 h-10 px-3 rounded-md bg-violet-600/80 hover:bg-violet-600 text-white text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed border border-violet-500/50"
        >
          {storyAssistantMutation.isPending ? (
            '…'
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              Send
            </>
          )}
        </button>
      </div>
    </div>
  );
}
