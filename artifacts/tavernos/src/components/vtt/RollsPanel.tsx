import React, { useRef, useEffect } from 'react';
import { ChatMessage, Character } from '@workspace/api-client-react';
import { DiceRoll } from 'rpg-dice-roller';
import { Dices } from 'lucide-react';
import { MessageBubble } from './message-bubble';

type MessageType = 'chat' | 'dice' | 'system' | 'whisper' | 'story' | 'story_prompt';

interface RollsPanelProps {
  messages: ChatMessage[];
  myCharacter: Character | null;
  onSendMessage: (
    content: string,
    type: MessageType,
    diceData?: { total: number; output: string; expr: string },
    recipientId?: string
  ) => void;
}

const QUICK_ROLLS = [
  { label: 'd4', expr: '1d4' },
  { label: 'd6', expr: '1d6' },
  { label: 'd8', expr: '1d8' },
  { label: 'd10', expr: '1d10' },
  { label: 'd12', expr: '1d12' },
  { label: 'd20', expr: '1d20' },
  { label: 'd100', expr: '1d100' },
];

const QUICK_CHECKS = [
  { label: 'Perc', expr: '1d20', bonus: 'wis' },
  { label: 'Inv', expr: '1d20', bonus: 'int' },
  { label: 'Ath', expr: '1d20', bonus: 'str' },
  { label: 'Ste', expr: '1d20', bonus: 'dex' },
  { label: 'Ins', expr: '1d20', bonus: 'wis' },
  { label: 'Pers', expr: '1d20', bonus: 'cha' },
];

function mod(score: number) {
  return Math.floor((score - 10) / 2);
}
function fmtMod(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function RollsPanel({ messages, myCharacter, onSendMessage }: RollsPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const diceMessages = messages.filter((m) => m.type === 'dice');

  const performRoll = (expr: string, label: string) => {
    try {
      const roll = new DiceRoll(expr);
      onSendMessage(
        `${myCharacter?.name || 'Someone'} rolled ${label}`,
        'dice',
        { total: roll.total, output: roll.output, expr }
      );
    } catch {
      onSendMessage(`Invalid dice expression: ${expr}`, 'system');
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [diceMessages.length]);

  const stats = (myCharacter?.stats as unknown as Record<string, number>) || {};

  return (
    <div className="h-full flex flex-col bg-card min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {diceMessages.length === 0 && (
          <div className="text-center text-muted-foreground text-xs italic pt-8">
            No dice rolled yet. Use quick rolls below or type /r in chat.
          </div>
        )}
        {diceMessages.map((msg, idx) => (
          <MessageBubble key={msg.id || idx} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-background/50 px-2 py-2 shrink-0">
        <div className="text-[10px] font-label text-muted-foreground uppercase mb-1.5">Quick Roll</div>
        <div className="flex flex-wrap gap-1 mb-2">
          {QUICK_ROLLS.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => performRoll(r.expr, r.label)}
              className="px-2 py-1 text-xs font-label font-bold bg-primary/10 border border-primary/30 text-primary rounded hover:bg-primary/20 transition-colors"
            >
              {r.label}
            </button>
          ))}
        </div>
        {myCharacter && (
          <>
            <div className="text-[10px] font-label text-muted-foreground uppercase mb-1">Skill Checks</div>
            <div className="flex flex-wrap gap-1">
              {QUICK_CHECKS.map((c) => {
                const m = mod(stats[c.bonus] || 10);
                const expr = `1d20${fmtMod(m)}`;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => performRoll(expr, c.label)}
                    className="px-1.5 py-0.5 text-[10px] font-label bg-card border border-border rounded hover:bg-primary/10 hover:border-primary/30 transition-colors"
                  >
                    {c.label} {fmtMod(m)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="p-2 border-t border-border/60 bg-background/30 shrink-0">
        <p className="text-[10px] text-muted-foreground font-label flex items-center gap-1">
          <Dices className="w-3 h-3 text-primary shrink-0" />
          Table chat and /r also log here — only this tab shows the dice log.
        </p>
      </div>
    </div>
  );
}
