import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, PostMessageRequestType } from '@workspace/api-client-react';
import { DiceRoll } from 'rpg-dice-roller';
import { Dices, Send, Settings, User } from 'lucide-react';
import { VttInput } from '../VttInput';
import { VttButton } from '../VttButton';
import { useVttStore } from '@/hooks/use-vtt-state';
import { format } from 'date-fns';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, type: PostMessageRequestType, diceData?: any) => void;
  isDm: boolean;
}

export function ChatPanel({ messages, onSendMessage, isDm }: ChatPanelProps) {
  const { activeTab, setActiveTab, diceInput, setDiceInput } = useVttStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!diceInput.trim()) return;

    // Check if it's a roll command
    if (diceInput.startsWith('/r ') || diceInput.startsWith('/roll ')) {
      const expr = diceInput.replace(/^\/(r|roll)\s+/, '');
      try {
        const roll = new DiceRoll(expr);
        onSendMessage(`Rolled: ${expr}`, 'dice', {
          total: roll.total,
          output: roll.output,
        });
      } catch (err) {
        onSendMessage(`Invalid dice expression: ${expr}`, 'system');
      }
    } else {
      onSendMessage(diceInput, 'chat');
    }
    setDiceInput("");
  };

  const filteredMessages = messages.filter(m => activeTab === 'chat' ? true : m.type === 'dice');

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Tabs */}
      <div className="flex border-b border-border bg-background">
        <button 
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-3 text-sm font-label font-bold border-b-2 transition-colors ${activeTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Table Chat
        </button>
        <button 
          onClick={() => setActiveTab('dice')}
          className={`flex-1 py-3 text-sm font-label font-bold border-b-2 transition-colors ${activeTab === 'dice' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Dice Log
        </button>
        {isDm && (
          <button 
            onClick={() => setActiveTab('dm')}
            className={`flex-1 py-3 text-sm font-label font-bold border-b-2 transition-colors ${activeTab === 'dm' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            DM Tools
          </button>
        )}
      </div>

      {/* Message Area */}
      {activeTab !== 'dm' && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredMessages.map((msg, idx) => (
              <div key={msg.id || idx} className={`flex flex-col ${msg.type === 'system' ? 'items-center' : 'items-start'}`}>
                {msg.type === 'system' ? (
                  <div className="bg-primary/10 border border-primary/30 text-primary px-4 py-1.5 rounded-full text-xs font-label uppercase tracking-wider">
                    {msg.content}
                  </div>
                ) : (
                  <div className={`w-full max-w-[95%] ${msg.type === 'dice' ? 'bg-[#2A1F12] border border-[#7A6228] p-3 rounded-lg shadow-sm' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-label font-bold text-primary text-sm flex items-center gap-1">
                        {msg.senderName} 
                        {msg.type === 'whisper' && <span className="text-magic text-xs">(Whisper)</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(msg.createdAt), 'HH:mm')}</span>
                    </div>
                    
                    {msg.type === 'dice' && msg.diceData ? (
                      <div className="mt-2">
                        <div className="text-xs text-muted-foreground mb-1">{msg.content}</div>
                        <div className="font-mono text-sm break-words bg-background p-2 rounded border border-border/50 text-foreground">
                          {msg.diceData.output}
                        </div>
                        <div className="mt-2 flex justify-end">
                          <div className="text-2xl font-bold font-serif text-ember drop-shadow-md">
                            {msg.diceData.total}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-foreground/90 font-sans whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-background border-t border-border">
            <form onSubmit={handleSend} className="flex gap-2">
              <VttInput 
                value={diceInput}
                onChange={(e) => setDiceInput(e.target.value)}
                placeholder="Type a message or /r 1d20..."
                className="flex-1 font-sans text-base"
              />
              <VttButton type="submit" size="icon" variant={diceInput.startsWith('/r') ? 'magic' : 'default'}>
                {diceInput.startsWith('/r') ? <Dices className="w-5 h-5" /> : <Send className="w-5 h-5" />}
              </VttButton>
            </form>
          </div>
        </>
      )}

      {/* DM Tools Tab */}
      {activeTab === 'dm' && isDm && (
        <div className="flex-1 p-4 overflow-y-auto space-y-6">
          <div className="glass-panel p-4 rounded-lg">
            <h3 className="font-display text-primary text-lg mb-2 border-b border-border/50 pb-1">Encounter Tools</h3>
            <div className="space-y-2">
              <VttButton variant="outline" className="w-full justify-start"><User className="w-4 h-4 mr-2" /> Add NPC Token</VttButton>
              <VttButton variant="outline" className="w-full justify-start"><Settings className="w-4 h-4 mr-2" /> Map Settings</VttButton>
            </div>
          </div>
          
          <div className="glass-panel p-4 rounded-lg">
            <h3 className="font-display text-primary text-lg mb-2 border-b border-border/50 pb-1">Atmosphere</h3>
            <div className="grid grid-cols-2 gap-2">
              <VttButton variant="ghost" className="bg-background/50 border border-border/50 text-xs">Tavern</VttButton>
              <VttButton variant="ghost" className="bg-background/50 border border-border/50 text-xs">Dungeon</VttButton>
              <VttButton variant="ghost" className="bg-background/50 border border-border/50 text-xs">Forest</VttButton>
              <VttButton variant="ghost" className="bg-background/50 border border-border/50 text-xs text-destructive">Battle</VttButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
