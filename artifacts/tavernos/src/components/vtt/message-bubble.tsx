import React from 'react';
import { ChatMessage } from '@workspace/api-client-react';
import { format } from 'date-fns';

export function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isSystem = msg.type === 'system';
  const isDice = msg.type === 'dice';
  const isWhisper = msg.type === 'whisper';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-primary/10 border border-primary/30 text-primary/80 px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-wider">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`${isWhisper ? 'bg-magic/10 border border-magic/30 rounded p-2' : ''}`}>
      <div className="flex items-center justify-between mb-0.5">
        <span className={`font-label font-bold text-xs ${isWhisper ? 'text-magic' : 'text-primary'}`}>
          {msg.senderName}
          {isWhisper && <span className="ml-1 opacity-70">(Whisper)</span>}
        </span>
        <span className="text-[9px] text-muted-foreground">
          {format(new Date(msg.createdAt), 'HH:mm')}
        </span>
      </div>

      {isDice && msg.diceData ? (
        <div className="bg-[#1A1208] border border-[#7A6228]/50 rounded p-2.5 mt-1">
          <div className="text-xs text-muted-foreground mb-1">{msg.content}</div>
          <div className="font-mono text-xs break-all bg-background p-1.5 rounded border border-border/40 text-foreground/80">
            {(msg.diceData as { output: string; total: number }).output}
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-2xl font-bold font-serif text-ember">{(msg.diceData as { output: string; total: number }).total}</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap">{msg.content}</div>
      )}
    </div>
  );
}
