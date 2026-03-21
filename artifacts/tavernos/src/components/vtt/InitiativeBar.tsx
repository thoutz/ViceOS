import React, { useState } from 'react';
import { Character } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Heart, Skull, Plus, Trash2, ArrowUp, ArrowDown, ChevronRight, ChevronLeft, Swords } from 'lucide-react';
import { VttButton } from '../VttButton';
import { DiceRoll } from 'rpg-dice-roller';

export interface InitiativeCombatant {
  characterId: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  tokenColor?: string;
  isNpc?: boolean;
  conditions?: string[];
}

interface InitiativeBarProps {
  order: InitiativeCombatant[];
  currentIndex: number;
  roundNumber: number;
  isDm: boolean;
  characters: Character[];
  onNextTurn: () => void;
  onPrevTurn: () => void;
  onOrderUpdate: (order: InitiativeCombatant[]) => void;
}

const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Exhaustion'];

function rollInitiative(character: Character): number {
  const stats = (character.stats as Record<string, number>) || {};
  const dex = stats.dex || 10;
  const mod = Math.floor((dex - 10) / 2);
  const bonus = (character.initiativeBonus as number | undefined) ?? mod;
  try {
    const roll = new DiceRoll(`1d20+${bonus}`);
    return roll.total;
  } catch {
    return Math.floor(Math.random() * 20) + 1 + bonus;
  }
}

export function InitiativeBar({ order, currentIndex, roundNumber, isDm, characters, onNextTurn, onPrevTurn, onOrderUpdate }: InitiativeBarProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addInit, setAddInit] = useState('');
  const [addHp, setAddHp] = useState('');
  const [addAc, setAddAc] = useState('10');
  const [selectedConditionTarget, setSelectedConditionTarget] = useState<string | null>(null);

  const handleAddCombatant = () => {
    if (!addName.trim()) return;
    const newCombatant: InitiativeCombatant = {
      characterId: `npc-${Date.now()}`,
      name: addName.trim(),
      initiative: parseInt(addInit, 10) || 0,
      hp: parseInt(addHp, 10) || 10,
      maxHp: parseInt(addHp, 10) || 10,
      ac: parseInt(addAc, 10) || 10,
      tokenColor: '#8B1A1A',
      isNpc: true,
    };
    const newOrder = [...order, newCombatant].sort((a, b) => b.initiative - a.initiative);
    onOrderUpdate(newOrder);
    setAddName('');
    setAddInit('');
    setAddHp('');
    setAddAc('10');
    setShowAdd(false);
  };

  const handleRollAll = () => {
    if (!isDm) return;
    const fromChars: InitiativeCombatant[] = characters.map(c => ({
      characterId: c.id,
      name: c.name,
      initiative: rollInitiative(c),
      hp: c.hp || 0,
      maxHp: c.maxHp || 1,
      ac: c.ac || 10,
      tokenColor: c.tokenColor || '#C9A84C',
    }));
    const npcs = order.filter(c => c.isNpc);
    const combined = [...fromChars, ...npcs].sort((a, b) => b.initiative - a.initiative);
    onOrderUpdate(combined);
  };

  const handleRemove = (id: string) => {
    const newOrder = order.filter(c => c.characterId !== id);
    const adjustedIndex = Math.min(currentIndex, Math.max(0, newOrder.length - 1));
    onOrderUpdate(newOrder);
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const newOrder = [...order];
    const swap = idx + dir;
    if (swap < 0 || swap >= newOrder.length) return;
    [newOrder[idx], newOrder[swap]] = [newOrder[swap], newOrder[idx]];
    onOrderUpdate(newOrder);
  };

  const handleToggleCondition = (combatantId: string, condition: string) => {
    const newOrder = order.map(c => {
      if (c.characterId !== combatantId) return c;
      const conditions = c.conditions || [];
      const has = conditions.includes(condition);
      return { ...c, conditions: has ? conditions.filter(x => x !== condition) : [...conditions, condition] };
    });
    onOrderUpdate(newOrder);
  };

  const handleClearCombat = () => {
    onOrderUpdate([]);
  };

  if (!order || order.length === 0) {
    return (
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3 text-muted-foreground italic font-label text-sm">
          <Swords className="w-4 h-4" />
          Combat not started
        </div>
        {isDm && (
          <div className="flex items-center gap-2">
            <VttButton variant="outline" size="sm" onClick={handleRollAll} className="text-xs">
              Roll Initiative
            </VttButton>
            <VttButton variant="ghost" size="sm" onClick={() => setShowAdd(true)} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </VttButton>
            {showAdd && (
              <div className="absolute top-[72px] right-4 z-50 bg-card border border-border rounded-lg shadow-2xl p-3 w-64">
                <div className="text-xs font-label font-bold uppercase mb-2 text-primary">Add Combatant</div>
                <div className="space-y-1.5">
                  <input
                    autoFocus
                    placeholder="Name"
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-sm"
                  />
                  <div className="grid grid-cols-3 gap-1">
                    <input placeholder="Init" type="number" value={addInit} onChange={e => setAddInit(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-center" />
                    <input placeholder="HP" type="number" value={addHp} onChange={e => setAddHp(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-center" />
                    <input placeholder="AC" type="number" value={addAc} onChange={e => setAddAc(e.target.value)} className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-center" />
                  </div>
                  <div className="flex gap-1">
                    <VttButton size="sm" onClick={handleAddCombatant} className="flex-1">Add</VttButton>
                    <VttButton size="sm" variant="ghost" onClick={() => setShowAdd(false)} className="flex-1">Cancel</VttButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const currentCombatant = order[currentIndex];

  return (
    <div className="bg-card border-b border-border relative z-10">
      <div className="flex items-center h-16 px-3 gap-3">
        {/* Round counter */}
        <div className="flex flex-col items-center justify-center min-w-[56px] border-r border-border pr-3">
          <span className="text-[9px] font-label text-primary uppercase tracking-widest">Round</span>
          <span className="text-xl font-display font-bold text-foreground leading-tight">{roundNumber}</span>
        </div>

        {/* Combatant strip */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <AnimatePresence>
            {order.map((combatant, idx) => {
              const isActive = idx === currentIndex;
              const hpPct = combatant.maxHp > 0 ? combatant.hp / combatant.maxHp : 0;
              const isDead = combatant.hp <= 0;

              return (
                <motion.div
                  key={combatant.characterId}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={`relative flex items-center gap-2 px-2.5 py-1.5 rounded min-w-[140px] max-w-[180px] flex-shrink-0 cursor-pointer transition-all ${
                    isActive
                      ? 'bg-primary/20 border-2 border-primary shadow-[0_0_12px_rgba(201,168,76,0.5)]'
                      : 'bg-background/60 border border-border/50 opacity-70 hover:opacity-90'
                  }`}
                  onClick={() => isDm && setSelectedConditionTarget(selectedConditionTarget === combatant.characterId ? null : combatant.characterId)}
                >
                  {/* Initiative badge */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-inner flex-shrink-0"
                    style={{ backgroundColor: combatant.tokenColor || '#3A3228' }}
                  >
                    {combatant.initiative}
                  </div>

                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-label font-bold text-xs truncate text-foreground">{combatant.name}</span>
                      {combatant.isNpc && <span className="text-[8px] text-destructive font-bold">NPC</span>}
                    </div>

                    {isDm && (
                      <div className="flex gap-2 text-[9px] text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-2.5 h-2.5 text-destructive" />
                          {combatant.hp}/{combatant.maxHp}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Shield className="w-2.5 h-2.5 text-primary" />
                          {combatant.ac}
                        </span>
                      </div>
                    )}

                    {/* HP bar */}
                    <div className="w-full h-1 bg-black/30 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${hpPct > 0.5 ? 'bg-green-500' : hpPct > 0.25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.max(0, hpPct * 100)}%` }}
                      />
                    </div>

                    {/* Conditions */}
                    {(combatant.conditions || []).length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-0.5">
                        {(combatant.conditions || []).map(c => (
                          <span key={c} className="text-[7px] bg-magic/30 text-magic border border-magic/40 px-1 rounded">{c.substring(0, 3).toUpperCase()}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {isDead && (
                    <div className="absolute -top-2 -right-2 bg-destructive rounded-full p-0.5 border-2 border-card">
                      <Skull className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}

                  {/* DM controls overlay */}
                  {isDm && isActive && (
                    <div className="absolute -top-1.5 -right-1.5 flex gap-0.5">
                      {idx > 0 && (
                        <button
                          className="w-4 h-4 bg-card border border-border rounded-full flex items-center justify-center hover:bg-primary/20"
                          onClick={e => { e.stopPropagation(); handleMove(idx, -1); }}
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {idx < order.length - 1 && (
                        <button
                          className="w-4 h-4 bg-card border border-border rounded-full flex items-center justify-center hover:bg-primary/20"
                          onClick={e => { e.stopPropagation(); handleMove(idx, 1); }}
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* DM Controls */}
        {isDm && (
          <div className="flex items-center gap-1.5 pl-3 border-l border-border flex-shrink-0">
            <button onClick={onPrevTurn} className="w-7 h-7 flex items-center justify-center border border-border rounded hover:bg-primary/20 hover:border-primary transition-colors" title="Previous Turn">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={onNextTurn} className="px-3 h-7 flex items-center justify-center bg-primary/20 border border-primary rounded hover:bg-primary/30 transition-colors text-xs font-label font-bold text-primary" title="Next Turn">
              NEXT
            </button>
            <button onClick={() => setShowAdd(!showAdd)} className="w-7 h-7 flex items-center justify-center border border-border rounded hover:bg-primary/20 transition-colors" title="Add Combatant">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={handleClearCombat} className="w-7 h-7 flex items-center justify-center border border-destructive/50 rounded hover:bg-destructive/10 transition-colors" title="End Combat">
              <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
            </button>
          </div>
        )}
      </div>

      {/* Add Combatant form */}
      {isDm && showAdd && (
        <div className="border-t border-border bg-card/90 px-4 py-2 flex items-center gap-2">
          <input
            autoFocus
            placeholder="Name (NPC/monster)"
            value={addName}
            onChange={e => setAddName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCombatant()}
            className="bg-background border border-border rounded px-2 py-1 text-sm flex-1 font-sans"
          />
          <input placeholder="Init" type="number" value={addInit} onChange={e => setAddInit(e.target.value)} className="w-14 bg-background border border-border rounded px-2 py-1 text-sm text-center" />
          <input placeholder="HP" type="number" value={addHp} onChange={e => setAddHp(e.target.value)} className="w-14 bg-background border border-border rounded px-2 py-1 text-sm text-center" />
          <input placeholder="AC" type="number" value={addAc} onChange={e => setAddAc(e.target.value)} className="w-12 bg-background border border-border rounded px-2 py-1 text-sm text-center" />
          <VttButton size="sm" onClick={handleAddCombatant}>Add</VttButton>
          <VttButton size="sm" variant="ghost" onClick={() => setShowAdd(false)}>×</VttButton>
        </div>
      )}

      {/* Conditions picker */}
      {isDm && selectedConditionTarget && (
        <div className="border-t border-border bg-card/90 px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-label text-muted-foreground uppercase">Conditions:</span>
            {CONDITIONS.map(cond => {
              const target = order.find(c => c.characterId === selectedConditionTarget);
              const has = target?.conditions?.includes(cond);
              return (
                <button
                  key={cond}
                  onClick={() => handleToggleCondition(selectedConditionTarget, cond)}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${has ? 'bg-magic/30 text-magic border-magic/50' : 'border-border/50 text-muted-foreground hover:border-magic/30 hover:text-magic'}`}
                >
                  {cond}
                </button>
              );
            })}
            <button onClick={() => setSelectedConditionTarget(null)} className="text-[10px] text-muted-foreground hover:text-foreground ml-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
