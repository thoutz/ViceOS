import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Character, GameSession } from '@workspace/api-client-react';
import { DiceRoll } from 'rpg-dice-roller';
import { Send, Dices, Users, MessageSquare, Swords, Heart, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { VttButton } from '../VttButton';
import type { InitiativeCombatant } from './InitiativeBar';

type MessageType = 'chat' | 'dice' | 'system' | 'whisper';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, type: MessageType, diceData?: any) => void;
  isDm: boolean;
  myCharacter: Character | null;
  allCharacters: Character[];
  activeSession: GameSession;
  campaignId: string;
  onOrderUpdate: (order: InitiativeCombatant[]) => void;
}

type Tab = 'chat' | 'dice' | 'dm';

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

function mod(score: number) { return Math.floor((score - 10) / 2); }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

export function ChatPanel({
  messages, onSendMessage, isDm, myCharacter, allCharacters, activeSession, campaignId, onOrderUpdate,
}: ChatPanelProps) {
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [whisperTo, setWhisperTo] = useState<string>('all');
  const [showDiceHistory, setShowDiceHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

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

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    if (text.startsWith('/r ') || text.startsWith('/roll ')) {
      const expr = text.replace(/^\/(r|roll)\s+/, '');
      performRoll(expr, expr);
    } else if (text.startsWith('/w ') && isDm) {
      const content = text.replace(/^\/w\s+/, '');
      onSendMessage(content, 'whisper');
    } else {
      const type = whisperTo !== 'all' ? 'whisper' : 'chat';
      onSendMessage(text, type);
    }
    setInput('');
  };

  const filteredMessages = tab === 'dice'
    ? messages.filter(m => m.type === 'dice')
    : messages;

  const stats = (myCharacter?.stats as any) || {};

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Tab header */}
      <div className="flex border-b border-border bg-background flex-shrink-0">
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 py-2.5 text-xs font-label font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${tab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Chat
        </button>
        <button
          onClick={() => setTab('dice')}
          className={`flex-1 py-2.5 text-xs font-label font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${tab === 'dice' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          <Dices className="w-3.5 h-3.5" /> Rolls
        </button>
        {isDm && (
          <button
            onClick={() => setTab('dm')}
            className={`flex-1 py-2.5 text-xs font-label font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${tab === 'dm' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <Swords className="w-3.5 h-3.5" /> DM
          </button>
        )}
      </div>

      {/* Message area (chat and dice tabs) */}
      {tab !== 'dm' && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {filteredMessages.length === 0 && (
              <div className="text-center text-muted-foreground text-xs italic pt-8">
                {tab === 'dice' ? 'No dice rolled yet.' : 'No messages yet. Say hello!'}
              </div>
            )}
            {filteredMessages.map((msg, idx) => (
              <MessageBubble key={msg.id || idx} msg={msg} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick roll bar */}
          {tab === 'dice' && (
            <div className="border-t border-border bg-background/50 px-2 py-2">
              <div className="text-[10px] font-label text-muted-foreground uppercase mb-1.5">Quick Roll</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {QUICK_ROLLS.map(r => (
                  <button
                    key={r.label}
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
                    {QUICK_CHECKS.map(c => {
                      const m = mod(stats[c.bonus] || 10);
                      const expr = `1d20${fmtMod(m)}`;
                      return (
                        <button
                          key={c.label}
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
          )}

          {/* Input area */}
          <div className="p-2.5 bg-background border-t border-border flex-shrink-0">
            {isDm && (
              <div className="flex items-center gap-2 mb-2">
                <select
                  value={whisperTo}
                  onChange={e => setWhisperTo(e.target.value)}
                  className="flex-1 bg-background border border-border/50 rounded px-2 py-1 text-xs font-sans text-muted-foreground"
                >
                  <option value="all">To: Everyone</option>
                  {allCharacters.map(c => (
                    <option key={c.id} value={c.userId || c.id}>Whisper → {c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={input.startsWith('/r') ? 'e.g. /r 2d6+3' : 'Message or /r 1d20...'}
                className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm font-sans focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className={`w-9 h-9 flex items-center justify-center rounded border transition-colors ${input.startsWith('/r') ? 'bg-magic/20 border-magic text-magic hover:bg-magic/30' : 'bg-primary/20 border-primary/50 text-primary hover:bg-primary/30'}`}
              >
                {input.startsWith('/r') ? <Dices className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
            <div className="mt-1 text-[10px] text-muted-foreground font-label">/r 2d6+3 to roll · /w [msg] to whisper (DM)</div>
          </div>
        </>
      )}

      {/* DM Tab */}
      {tab === 'dm' && isDm && (
        <DmToolsPanel
          allCharacters={allCharacters}
          activeSession={activeSession}
          onOrderUpdate={onOrderUpdate}
          onSendMessage={onSendMessage}
          performRoll={performRoll}
        />
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
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
            {(msg.diceData as any).output}
          </div>
          <div className="flex justify-end mt-1">
            <span className="text-2xl font-bold font-serif text-ember">{(msg.diceData as any).total}</span>
          </div>
        </div>
      ) : (
        <div className="text-sm text-foreground/90 font-sans leading-relaxed whitespace-pre-wrap">{msg.content}</div>
      )}
    </div>
  );
}

function DmToolsPanel({
  allCharacters, activeSession, onOrderUpdate, onSendMessage, performRoll,
}: {
  allCharacters: Character[];
  activeSession: GameSession;
  onOrderUpdate: (order: InitiativeCombatant[]) => void;
  onSendMessage: (content: string, type: any, diceData?: any) => void;
  performRoll: (expr: string, label: string) => void;
}) {
  const [announcement, setAnnouncement] = useState('');

  const sendAnnouncement = () => {
    if (!announcement.trim()) return;
    onSendMessage(announcement.trim(), 'system');
    setAnnouncement('');
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {/* Player HP Monitor */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <Heart className="w-3.5 h-3.5" /> Player Status
        </h3>
        <div className="space-y-2">
          {allCharacters.filter(c => !c.isNpc).map(c => {
            const hpPct = c.maxHp > 0 ? (c.hp || 0) / c.maxHp : 0;
            const color = hpPct > 0.5 ? 'bg-green-600' : hpPct > 0.25 ? 'bg-yellow-500' : 'bg-red-600';
            return (
              <div key={c.id} className="bg-background rounded p-2 border border-border/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-label font-bold truncate">{c.name}</span>
                  <span className="text-xs font-mono">
                    <span className={hpPct <= 0 ? 'text-destructive font-bold' : ''}>{c.hp}</span>
                    <span className="text-muted-foreground">/{c.maxHp}</span>
                  </span>
                </div>
                <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.max(0, hpPct * 100)}%` }} />
                </div>
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>AC {c.ac}</span>
                  <span>{c.race} {c.class}</span>
                  <span>Lv{c.level}</span>
                </div>
              </div>
            );
          })}
          {allCharacters.filter(c => !c.isNpc).length === 0 && (
            <div className="text-xs text-muted-foreground italic">No players yet.</div>
          )}
        </div>
      </section>

      {/* DM Quick Rolls */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <Dices className="w-3.5 h-3.5" /> DM Quick Rolls
        </h3>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: 'Perception', expr: '1d20' },
            { label: 'Attack', expr: '1d20+5' },
            { label: 'Damage d6', expr: '2d6+3' },
            { label: 'Damage d8', expr: '2d8+4' },
            { label: 'Fireball', expr: '8d6' },
            { label: 'Random', expr: '1d100' },
          ].map(r => (
            <button
              key={r.label}
              onClick={() => performRoll(r.expr, `DM: ${r.label}`)}
              className="text-xs font-label py-1.5 px-2 bg-background border border-border/50 rounded hover:border-primary/50 hover:bg-primary/10 transition-colors text-left"
            >
              <div className="font-bold">{r.label}</div>
              <div className="text-[9px] text-muted-foreground">{r.expr}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Secret Rolls (DM only) */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <EyeOff className="w-3.5 h-3.5" /> Secret Rolls
        </h3>
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_ROLLS.map(r => (
            <button
              key={r.label}
              onClick={() => {
                try {
                  const roll = new DiceRoll(r.expr);
                  onSendMessage(`🎲 Secret roll: ${r.expr} = ${roll.total}`, 'whisper');
                } catch {}
              }}
              className="text-xs font-label px-2 py-1 bg-magic/10 border border-magic/30 text-magic rounded hover:bg-magic/20 transition-colors"
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">Only visible to you</div>
      </section>

      {/* Announcements */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5" /> Announcement
        </h3>
        <div className="flex gap-1.5">
          <input
            value={announcement}
            onChange={e => setAnnouncement(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendAnnouncement()}
            placeholder="Broadcast a message to all players..."
            className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-sm font-sans focus:outline-none focus:border-primary/50"
          />
          <VttButton size="sm" onClick={sendAnnouncement}>Send</VttButton>
        </div>
      </section>

      {/* Encounter Builder */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <Swords className="w-3.5 h-3.5" /> Encounter Builder
        </h3>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="text-[10px]">Add NPCs to initiative order via the bar above (+ button). Click a combatant to apply conditions.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { name: 'Goblin', hp: 7, ac: 15, init: '+2' },
              { name: 'Orc', hp: 15, ac: 13, init: '+1' },
              { name: 'Skeleton', hp: 13, ac: 13, init: '+2' },
              { name: 'Wolf', hp: 11, ac: 13, init: '+2' },
              { name: 'Troll', hp: 84, ac: 15, init: '-1' },
              { name: 'Dragon Wyrmling', hp: 75, ac: 17, init: '+0' },
            ].map(monster => (
              <button
                key={monster.name}
                onClick={() => {
                  const initRoll = Math.floor(Math.random() * 20) + 1 + parseInt(monster.init);
                  const existing = (activeSession.initiativeOrder as InitiativeCombatant[]) || [];
                  const newCombatant: InitiativeCombatant = {
                    characterId: `${monster.name.toLowerCase()}-${Date.now()}`,
                    name: monster.name,
                    initiative: initRoll,
                    hp: monster.hp,
                    maxHp: monster.hp,
                    ac: monster.ac,
                    tokenColor: '#8B1A1A',
                    isNpc: true,
                  };
                  const newOrder = [...existing, newCombatant].sort((a, b) => b.initiative - a.initiative);
                  onOrderUpdate(newOrder);
                  onSendMessage(`${monster.name} enters the fray! (Init: ${initRoll})`, 'system');
                }}
                className="text-left p-2 bg-background border border-border/50 rounded hover:border-destructive/50 hover:bg-destructive/5 transition-colors"
              >
                <div className="font-bold text-destructive/80 font-label">{monster.name}</div>
                <div className="text-[9px] text-muted-foreground">HP {monster.hp} · AC {monster.ac} · Init {monster.init}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
