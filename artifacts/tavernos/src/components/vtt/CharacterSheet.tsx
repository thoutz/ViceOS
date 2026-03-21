import React from 'react';
import { Character } from '@workspace/api-client-react';
import { formatModifier } from '@/lib/utils';
import { Shield, Heart, Zap, Crosshair } from 'lucide-react';
import { VttButton } from '../VttButton';
import { VttInput } from '../VttInput';

interface CharacterSheetProps {
  character: Character | null;
  onRoll: (expr: string, label: string) => void;
  onUpdateHp: (change: number) => void;
}

export function CharacterSheet({ character, onRoll, onUpdateHp }: CharacterSheetProps) {
  if (!character) {
    return (
      <div className="p-6 h-full flex items-center justify-center text-muted-foreground italic font-sans text-center">
        No character assigned to this session.
      </div>
    );
  }

  const stats = [
    { label: 'STR', value: character.stats.str },
    { label: 'DEX', value: character.stats.dex },
    { label: 'CON', value: character.stats.con },
    { label: 'INT', value: character.stats.int },
    { label: 'WIS', value: character.stats.wis },
    { label: 'CHA', value: character.stats.cha },
  ];

  return (
    <div className="h-full flex flex-col bg-parchment-texture text-[#1A1208] overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b-2 border-[#7A6228] bg-black/5">
        <h2 className="text-3xl font-display text-[#5A1111] leading-none mb-1">{character.name}</h2>
        <div className="text-sm font-label font-semibold opacity-80 tracking-widest">
          Level {character.level} {character.race} {character.class}
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-4 grid grid-cols-3 gap-3 border-b border-[#7A6228]/30">
        {stats.map(s => (
          <div 
            key={s.label} 
            className="flex flex-col items-center justify-center p-3 border-2 border-[#7A6228] bg-[#F2E8CE] rounded-tl-lg rounded-br-lg shadow-sm cursor-pointer hover:bg-[#E8CC7A] transition-colors"
            onClick={() => onRoll(`1d20${formatModifier(s.value)}`, `${s.label} Check`)}
          >
            <span className="text-[10px] font-label font-bold text-[#5A1111]">{s.label}</span>
            <span className="text-2xl font-bold font-serif my-1">{formatModifier(s.value)}</span>
            <div className="w-8 h-5 rounded-full border border-[#7A6228]/50 flex items-center justify-center text-xs font-bold bg-[#1A1208] text-[#F2E8CE]">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Combat Blocks */}
      <div className="p-4 grid grid-cols-2 gap-4 border-b border-[#7A6228]/30">
        <div className="flex items-center gap-3 p-3 border border-[#7A6228]/50 rounded bg-white/30">
          <Shield className="w-8 h-8 text-[#5A1111]" />
          <div>
            <div className="text-2xl font-bold font-serif leading-none">{character.ac}</div>
            <div className="text-xs font-label uppercase font-bold opacity-70">Armor Class</div>
          </div>
        </div>
        <div 
          className="flex items-center gap-3 p-3 border border-[#7A6228]/50 rounded bg-white/30 cursor-pointer hover:bg-black/5"
          onClick={() => onRoll(`1d20+${character.initiativeBonus || formatModifier(character.stats.dex)}`, "Initiative")}
        >
          <Zap className="w-8 h-8 text-amber-600" />
          <div>
            <div className="text-2xl font-bold font-serif leading-none">
              {character.initiativeBonus !== undefined && character.initiativeBonus > 0 ? '+' : ''}
              {character.initiativeBonus !== undefined ? character.initiativeBonus : formatModifier(character.stats.dex)}
            </div>
            <div className="text-xs font-label uppercase font-bold opacity-70">Initiative</div>
          </div>
        </div>
      </div>

      {/* HP Block */}
      <div className="p-6">
        <div className="border-2 border-[#5A1111] rounded p-4 bg-white/40 shadow-inner">
          <div className="flex justify-between items-end mb-4">
            <div className="flex items-center gap-2">
              <Heart className="w-6 h-6 fill-[#5A1111] text-[#5A1111]" />
              <span className="text-sm font-label font-bold">Hit Points</span>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold font-serif text-[#5A1111]">{character.hp}</span>
              <span className="text-xl font-bold font-serif opacity-50"> / {character.maxHp}</span>
            </div>
          </div>
          
          {/* Quick HP Controls */}
          <div className="flex gap-2">
            <VttButton variant="destructive" size="sm" className="flex-1" onClick={() => onUpdateHp(-1)}>-1 DMG</VttButton>
            <VttButton variant="outline" size="sm" className="flex-1 border-[#5A1111] text-[#5A1111] hover:bg-[#5A1111] hover:text-white" onClick={() => onUpdateHp(1)}>+1 HEAL</VttButton>
          </div>
        </div>
      </div>

      {/* Skills / Actions Placeholder */}
      <div className="p-6 flex-1 border-t border-[#7A6228]/30">
        <h3 className="font-label font-bold text-lg border-b border-[#7A6228]/30 pb-2 mb-4">Quick Actions</h3>
        <div className="space-y-2">
          <div 
            className="flex justify-between items-center p-2 hover:bg-black/5 rounded cursor-pointer border border-transparent hover:border-[#7A6228]/30"
            onClick={() => onRoll(`1d20${formatModifier(character.stats.str)}`, "Melee Attack")}
          >
            <span className="font-semibold flex items-center gap-2"><Crosshair className="w-4 h-4"/> Melee Attack</span>
            <span className="font-bold">{formatModifier(character.stats.str)}</span>
          </div>
          <div 
            className="flex justify-between items-center p-2 hover:bg-black/5 rounded cursor-pointer border border-transparent hover:border-[#7A6228]/30"
            onClick={() => onRoll(`1d20${formatModifier(character.stats.dex)}`, "Ranged Attack")}
          >
            <span className="font-semibold flex items-center gap-2"><Crosshair className="w-4 h-4"/> Ranged Attack</span>
            <span className="font-bold">{formatModifier(character.stats.dex)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
