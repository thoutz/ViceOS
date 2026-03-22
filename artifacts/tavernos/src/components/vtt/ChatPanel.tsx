import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Character, GameSession } from '@workspace/api-client-react';
import { DiceRoll } from 'rpg-dice-roller';
import { Send, Dices, Users, MessageSquare, Swords, Heart, ShieldAlert, Eye, EyeOff, Search, Loader2, ImagePlus } from 'lucide-react';
import { SessionVideoCall } from './SessionVideoCall';
import { VttButton } from '../VttButton';
import { MessageBubble } from './message-bubble';
import type { InitiativeCombatant } from './InitiativeBar';

interface Open5eMonster {
  name: string;
  hit_points: number;
  armor_class: number;
  challenge_rating: string;
  type: string;
  size: string;
  speed: { walk?: string };
  dexterity: number;
  strength: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  document__slug: string;
}

type MessageType = 'chat' | 'dice' | 'system' | 'whisper';

const MAX_NPC_PORTRAIT_BYTES = 750_000;

interface MapRef { id: string; name: string; }

/** communications = session sidebar (video + chat + rolls). dmTools = DM Command Center drawer only. */
export type ChatPanelVariant = 'communications' | 'dmTools';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, type: MessageType, diceData?: { total: number; output: string; expr: string }, recipientId?: string) => void;
  isDm: boolean;
  myCharacter: Character | null;
  allCharacters: Character[];
  activeSession: GameSession;
  campaignId: string;
  onOrderUpdate: (order: InitiativeCombatant[]) => void;
  onCreateMap?: (name: string, imageData?: string) => void;
  onSwitchMap?: (mapId: string) => void;
  allMaps?: MapRef[];
  /** Default: communications (video + chat; dice messages excluded from chat stream). Use dmTools for the DM drawer. */
  panelVariant?: ChatPanelVariant;
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


export function ChatPanel({
  messages, onSendMessage, isDm, myCharacter, allCharacters, activeSession, campaignId, onOrderUpdate, onCreateMap, onSwitchMap, allMaps,
  panelVariant = 'communications',
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [whisperTo, setWhisperTo] = useState<string>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  /** Table talk only — dice posts appear on the Rolls tab, not here */
  const chatStreamMessages = messages.filter((m) => m.type !== 'dice');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatStreamMessages.length]);

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
    } else if (text.startsWith('/w ')) {
      // Anyone can whisper — DM to specific player, player to DM
      const content = text.replace(/^\/w\s+/, '');
      // 'dm' means "send to DM" — server auto-resolves DM userId when recipientId is undefined
      const recipientId = (whisperTo !== 'all' && whisperTo !== 'dm') ? whisperTo : undefined;
      onSendMessage(content, 'whisper', undefined, recipientId);
    } else {
      const type = (whisperTo !== 'all') ? 'whisper' : 'chat';
      const recipientId = (whisperTo !== 'all' && whisperTo !== 'dm') ? whisperTo : undefined;
      onSendMessage(text, type, undefined, recipientId);
    }
    setInput('');
  };

  if (panelVariant === 'dmTools') {
    return (
      <div className="h-full flex flex-col bg-card min-h-0">
        <DmToolsPanel
          allCharacters={allCharacters}
          activeSession={activeSession}
          onOrderUpdate={onOrderUpdate}
          onSendMessage={onSendMessage}
          performRoll={performRoll}
          campaignId={campaignId}
          onCreateMap={onCreateMap}
          onSwitchMap={onSwitchMap}
          allMaps={allMaps}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card min-h-0">
      {/* Video + table talk: one column */}
      <div className="flex-shrink-0 border-b border-border/60 bg-background/40">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/90">Session video</span>
          <span className="text-[9px] font-label text-muted-foreground hidden sm:inline">Same room for everyone</span>
        </div>
        <div className="px-2 pb-2 h-[min(240px,34vh)] flex flex-col shrink-0">
          <SessionVideoCall
            campaignId={campaignId}
            sessionId={activeSession.id}
            className="min-h-0 flex-1 h-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background flex-shrink-0">
        <MessageSquare className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-label font-bold text-primary uppercase tracking-wider">Chat</span>
        <span className="text-[10px] font-label text-muted-foreground ml-auto hidden sm:inline">Dice log → right panel</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {chatStreamMessages.length === 0 && (
          <div className="text-center text-muted-foreground text-xs italic pt-8">
            No messages yet. Say hello!
          </div>
        )}
        {chatStreamMessages.map((msg, idx) => (
          <MessageBubble key={msg.id || idx} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-2.5 bg-background border-t border-border flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <select
            value={whisperTo}
            onChange={e => setWhisperTo(e.target.value)}
            className="flex-1 bg-background border border-border/50 rounded px-2 py-1 text-xs font-sans text-muted-foreground"
          >
            <option value="all">To: Everyone</option>
            {isDm ? (
              allCharacters.map(c => (
                <option key={c.id} value={c.userId || c.id}>🤫 Whisper → {c.name}</option>
              ))
            ) : (
              <option value="dm">🤫 Whisper → DM</option>
            )}
          </select>
        </div>
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={input.startsWith('/r') ? 'e.g. /r 2d6+3 (shown in Rolls →)' : 'Message… /r to roll · /w to whisper'}
            className="flex-1 bg-card border border-border rounded px-3 py-2 text-sm font-sans focus:outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className={`w-9 h-9 flex items-center justify-center rounded border transition-colors ${input.startsWith('/r') ? 'bg-magic/20 border-magic text-magic hover:bg-magic/30' : 'bg-primary/20 border-primary/50 text-primary hover:bg-primary/30'}`}
          >
            {input.startsWith('/r') ? <Dices className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
        <div className="mt-1 text-[10px] text-muted-foreground font-label">/r posts to the Rolls tab · /w [msg] to whisper</div>
      </div>
    </div>
  );
}

function DmToolsPanel({
  allCharacters, activeSession, onOrderUpdate, onSendMessage, performRoll, onCreateMap, onSwitchMap, allMaps, campaignId,
}: {
  allCharacters: Character[];
  activeSession: GameSession;
  onOrderUpdate: (order: InitiativeCombatant[]) => void;
  onSendMessage: (content: string, type: MessageType, diceData?: { total: number; output: string; expr: string }) => void;
  performRoll: (expr: string, label: string) => void;
  onCreateMap?: (name: string, imageData?: string) => void;
  onSwitchMap?: (mapId: string) => void;
  allMaps?: MapRef[];
  campaignId: string;
}) {
  const [announcement, setAnnouncement] = useState('');
  const [npcQuery, setNpcQuery] = useState('');
  const [npcResults, setNpcResults] = useState<Open5eMonster[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [npcSelected, setNpcSelected] = useState<Open5eMonster | null>(null);
  const [npcTokenImageData, setNpcTokenImageData] = useState<string | null>(null);
  const [npcTokenSize, setNpcTokenSize] = useState<'small' | 'medium' | 'large'>('medium');
  const npcPortraitInputRef = useRef<HTMLInputElement>(null);
  const [mapName, setMapName] = useState('');
  const [mapImageData, setMapImageData] = useState('');
  const [mapCreating, setMapCreating] = useState(false);
  const [secretLayerVisible, setSecretLayerVisible] = useState(false);
  const [secretNote, setSecretNote] = useState('');
  const [activeAmbient, setActiveAmbient] = useState<string | null>(null);
  const mapFileRef = useRef<HTMLInputElement>(null);

  const searchNpc = useCallback(async (query: string) => {
    if (!query.trim()) { setNpcResults([]); return; }
    setNpcLoading(true);
    try {
      const res = await fetch(`https://api.open5e.com/v1/monsters/?search=${encodeURIComponent(query)}&limit=8&format=json`);
      const data = await res.json() as { results?: Open5eMonster[] };
      setNpcResults(data.results || []);
    } catch {
      setNpcResults([]);
    } finally {
      setNpcLoading(false);
    }
  }, []);

  const addNpcToInitiative = (monster: Open5eMonster) => {
    const dexMod = Math.floor(((monster.dexterity || 10) - 10) / 2);
    const initRoll = Math.floor(Math.random() * 20) + 1 + dexMod;
    const existing = (activeSession.initiativeOrder as InitiativeCombatant[]) || [];
    const newCombatant: InitiativeCombatant = {
      characterId: `${monster.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name: monster.name,
      initiative: initRoll,
      hp: monster.hit_points,
      maxHp: monster.hit_points,
      ac: monster.armor_class,
      tokenColor: '#8B1A1A',
      isNpc: true,
      ...(npcTokenImageData ? { tokenImageData: npcTokenImageData } : {}),
      ...(npcTokenSize !== 'medium' ? { tokenSize: npcTokenSize } : {}),
    };
    const newOrder = [...existing, newCombatant].sort((a, b) => b.initiative - a.initiative);
    onOrderUpdate(newOrder);
    onSendMessage(`${monster.name} enters the fray! (Init: ${initRoll}, HP: ${monster.hit_points}, AC: ${monster.armor_class})`, 'system');
    setNpcSelected(null);
    setNpcQuery('');
    setNpcResults([]);
    setNpcTokenImageData(null);
    setNpcTokenSize('medium');
  };

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

      {/* Open5e NPC Lookup */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <Search className="w-3.5 h-3.5" /> NPC / Monster Lookup
        </h3>
        <div className="flex gap-1.5 mb-2">
          <input
            value={npcQuery}
            onChange={e => setNpcQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchNpc(npcQuery)}
            placeholder="Search monsters... (e.g. goblin)"
            className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-sans focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={() => searchNpc(npcQuery)}
            disabled={npcLoading}
            className="h-7 px-2.5 bg-primary/20 border border-primary/40 text-primary rounded text-xs font-label font-bold hover:bg-primary/30 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {npcLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          </button>
        </div>
        {npcResults.length > 0 && !npcSelected && (
          <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
            {npcResults.map(m => (
              <button
                key={`${m.name}-${m.document__slug}`}
                onClick={() => setNpcSelected(m)}
                className="w-full text-left px-2 py-1.5 bg-background border border-border/50 rounded hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-label font-bold">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground">CR {m.challenge_rating}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{m.size} {m.type} · HP {m.hit_points} · AC {m.armor_class}</div>
              </button>
            ))}
          </div>
        )}
        {npcSelected && (
          <div className="bg-background border border-primary/30 rounded p-2 mb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-label font-bold text-primary">{npcSelected.name}</span>
              <button
                type="button"
                onClick={() => {
                  setNpcSelected(null);
                  setNpcTokenImageData(null);
                  setNpcTokenSize('medium');
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <input
                ref={npcPortraitInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_NPC_PORTRAIT_BYTES) return;
                  const reader = new FileReader();
                  reader.onload = () => setNpcTokenImageData(reader.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => npcPortraitInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] font-label text-muted-foreground border border-border rounded px-2 py-1 hover:bg-white/5"
              >
                <ImagePlus className="w-3 h-3" /> Token image
              </button>
              {npcTokenImageData && (
                <>
                  <img src={npcTokenImageData} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                  <button type="button" onClick={() => setNpcTokenImageData(null)} className="text-[10px] text-muted-foreground">
                    Clear
                  </button>
                </>
              )}
              <div className="flex items-center gap-0.5 border border-border/60 rounded px-1 py-0.5">
                <span className="text-[9px] text-muted-foreground pr-0.5">Size</span>
                {(['small', 'medium', 'large'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNpcTokenSize(s)}
                    className={`text-[9px] font-label px-1.5 py-0.5 rounded capitalize ${npcTokenSize === s ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                  >
                    {s[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mb-2">
              <span>CR <strong className="text-foreground">{npcSelected.challenge_rating}</strong></span>
              <span>HP <strong className="text-foreground">{npcSelected.hit_points}</strong></span>
              <span>AC <strong className="text-foreground">{npcSelected.armor_class}</strong></span>
              <span>STR <strong className="text-foreground">{npcSelected.strength}</strong></span>
              <span>DEX <strong className="text-foreground">{npcSelected.dexterity}</strong></span>
              <span>CON <strong className="text-foreground">{npcSelected.constitution}</strong></span>
              <span>INT <strong className="text-foreground">{npcSelected.intelligence}</strong></span>
              <span>WIS <strong className="text-foreground">{npcSelected.wisdom}</strong></span>
              <span>CHA <strong className="text-foreground">{npcSelected.charisma}</strong></span>
            </div>
            <button
              onClick={() => addNpcToInitiative(npcSelected)}
              className="w-full text-xs font-label font-bold py-1.5 bg-destructive/20 border border-destructive/50 text-destructive rounded hover:bg-destructive/30 transition-colors"
            >
              Add to Initiative
            </button>
          </div>
        )}
      </section>

      {/* Secret Layer */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <EyeOff className="w-3.5 h-3.5" /> Secret Layer
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSecretLayerVisible(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-label font-bold px-3 py-1.5 rounded border transition-colors ${secretLayerVisible ? 'bg-magic/20 border-magic/50 text-magic' : 'bg-background border-border text-muted-foreground hover:border-primary/40'}`}
            >
              {secretLayerVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {secretLayerVisible ? 'Secret Shown' : 'Secret Hidden'}
            </button>
            <span className="text-[10px] text-muted-foreground">(DM only)</span>
          </div>
          {secretLayerVisible && (
            <div className="bg-magic/5 border border-magic/20 rounded p-2">
              <textarea
                value={secretNote}
                onChange={e => setSecretNote(e.target.value)}
                placeholder="DM secret notes — hidden from players..."
                rows={3}
                className="w-full bg-transparent text-xs font-sans text-foreground resize-none focus:outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          )}
        </div>
      </section>

      {/* Ambient Scene */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <span className="text-xs">🎭</span> Ambient Scene
        </h3>
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {[
            { id: 'tavern', label: 'Tavern', desc: 'Warm, lively', icon: '🍺' },
            { id: 'dungeon', label: 'Dungeon', desc: 'Dark, damp', icon: '⛓' },
            { id: 'forest', label: 'Forest', desc: 'Rustling leaves', icon: '🌲' },
            { id: 'combat', label: 'Combat', desc: 'Tense battle', icon: '⚔️' },
            { id: 'market', label: 'Market', desc: 'Bustling crowd', icon: '🏪' },
            { id: 'mystery', label: 'Mystery', desc: 'Eerie silence', icon: '🔮' },
          ].map(scene => (
            <button
              key={scene.id}
              onClick={() => {
                const next = activeAmbient === scene.id ? null : scene.id;
                setActiveAmbient(next);
                if (next) {
                  onSendMessage(`🎭 Scene: ${scene.label} — ${scene.desc}`, 'system');
                }
              }}
              className={`text-left p-2 rounded border transition-colors ${activeAmbient === scene.id ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-background border-border/50 hover:border-primary/30 text-muted-foreground'}`}
            >
              <div className="text-sm">{scene.icon}</div>
              <div className="font-label font-bold text-[10px]">{scene.label}</div>
              <div className="text-[9px] opacity-70">{scene.desc}</div>
            </button>
          ))}
        </div>
        {activeAmbient && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded p-2">
            <span className="text-[10px] font-label text-primary">Active scene: <strong>{activeAmbient}</strong></span>
            <button onClick={() => setActiveAmbient(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}
      </section>

      {/* Map Management */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" /> Map Management
        </h3>
        <div className="space-y-2">
          <div className="flex flex-col gap-1.5">
            <input
              value={mapName}
              onChange={e => setMapName(e.target.value)}
              placeholder="Map name (e.g. Dungeon Level 1)..."
              className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-sans focus:outline-none focus:border-primary/50"
            />
            <div className="flex gap-1.5">
              <input
                value={mapImageData}
                onChange={e => setMapImageData(e.target.value)}
                placeholder="Image URL (optional)..."
                className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-sans focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                title="Upload local image"
                onClick={() => mapFileRef.current?.click()}
                className="h-[30px] px-2 bg-background border border-border rounded text-[10px] font-label text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1"
              >
                📁
              </button>
            </div>
            <input
              ref={mapFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  const result = ev.target?.result as string;
                  setMapImageData(result);
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
            {mapImageData && mapImageData.startsWith('data:') && (
              <div className="text-[10px] text-green-500 font-label flex items-center gap-1">✓ Image loaded from file</div>
            )}
            <button
              disabled={!mapName.trim() || mapCreating}
              onClick={() => {
                if (!mapName.trim() || !onCreateMap) return;
                setMapCreating(true);
                onCreateMap(mapName.trim(), mapImageData.trim() || undefined);
                setMapName('');
                setMapImageData('');
                setTimeout(() => setMapCreating(false), 1500);
              }}
              className="w-full text-xs font-label font-bold py-1.5 bg-primary/20 border border-primary/40 text-primary rounded hover:bg-primary/30 transition-colors disabled:opacity-50"
            >
              {mapCreating ? 'Creating...' : 'Create Map'}
            </button>
          </div>
          {allMaps && allMaps.length > 1 && (
            <div className="mt-2">
              <div className="text-[10px] font-label text-muted-foreground mb-1">Switch Active Map:</div>
              <div className="flex flex-col gap-1">
                {allMaps.map(m => (
                  <button
                    key={m.id}
                    onClick={() => onSwitchMap?.(m.id)}
                    className={`text-xs font-label text-left px-2 py-1.5 rounded border transition-colors ${
                      activeSession.activeMapId === m.id
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : 'border-border/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
                    }`}
                  >
                    {activeSession.activeMapId === m.id ? '▶ ' : ''}{m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Encounter Builder */}
      <section>
        <h3 className="text-[10px] font-label font-bold uppercase tracking-widest text-primary/80 mb-2 flex items-center gap-1">
          <Swords className="w-3.5 h-3.5" /> Quick NPCs
        </h3>
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="text-[10px]">Quick-add common monsters to combat.</p>
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
