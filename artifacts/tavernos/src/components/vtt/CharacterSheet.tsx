import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Character, type UpdateCharacterRequest } from '@workspace/api-client-react';
import { Shield, Heart, Zap, Crosshair, BookOpen, Star, ChevronDown, ChevronUp, Swords, User, ScrollText } from 'lucide-react';
import { VttButton } from '../VttButton';

interface CharacterSheetProps {
  character: Character | null;
  isDm: boolean;
  allCharacters: Character[];
  onRoll: (expr: string, label: string) => void;
  onUpdateHp: (change: number) => void;
  campaignId: string;
  /** When set and this user owns the viewed sheet, they can edit and save via the campaign API. */
  currentUserId?: string | null;
  onSaveCharacter?: (characterId: string, data: UpdateCharacterRequest) => Promise<void>;
}

function mod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ABILITY_NAMES: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution',
  int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma',
};
const ABILITY_SHORT: Record<string, string> = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA',
};

const SAVE_ABILITY: Record<string, string> = {
  str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha',
};

const SKILLS: Array<{ key: string; ability: string; name: string }> = [
  { key: 'acrobatics', ability: 'dex', name: 'Acrobatics' },
  { key: 'animal_handling', ability: 'wis', name: 'Animal Handling' },
  { key: 'arcana', ability: 'int', name: 'Arcana' },
  { key: 'athletics', ability: 'str', name: 'Athletics' },
  { key: 'deception', ability: 'cha', name: 'Deception' },
  { key: 'history', ability: 'int', name: 'History' },
  { key: 'insight', ability: 'wis', name: 'Insight' },
  { key: 'intimidation', ability: 'cha', name: 'Intimidation' },
  { key: 'investigation', ability: 'int', name: 'Investigation' },
  { key: 'medicine', ability: 'wis', name: 'Medicine' },
  { key: 'nature', ability: 'int', name: 'Nature' },
  { key: 'perception', ability: 'wis', name: 'Perception' },
  { key: 'performance', ability: 'cha', name: 'Performance' },
  { key: 'persuasion', ability: 'cha', name: 'Persuasion' },
  { key: 'religion', ability: 'int', name: 'Religion' },
  { key: 'sleight_of_hand', ability: 'dex', name: 'Sleight of Hand' },
  { key: 'stealth', ability: 'dex', name: 'Stealth' },
  { key: 'survival', ability: 'wis', name: 'Survival' },
];

const PROF_BY_LEVEL: Record<number, number> = {
  1: 2, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 4, 13: 5, 14: 5, 15: 5, 16: 5,
  17: 6, 18: 6, 19: 6, 20: 6,
};

function profBonus(level: number): number {
  return PROF_BY_LEVEL[Math.max(1, Math.min(20, level))] ?? 2;
}

type TabId = 'core' | 'bio' | 'skills' | 'spells' | 'inventory';

const TAB_ORDER: TabId[] = ['core', 'bio', 'skills', 'spells', 'inventory'];

function BioSection({ title, text }: { title: string; text: string }) {
  const t = text.trim();
  if (!t) return null;
  return (
    <section className="border border-border/30 rounded-lg overflow-hidden bg-foreground/5">
      <h4 className="text-[10px] font-sans font-bold uppercase tracking-widest text-primary/80 px-3 py-2 bg-foreground/5 border-b border-border/20 flex items-center gap-1.5">
        <ScrollText className="w-3 h-3 opacity-80" aria-hidden />
        {title}
      </h4>
      <div className="px-3 py-2.5 text-sm font-sans leading-relaxed whitespace-pre-wrap text-foreground/90">
        {t}
      </div>
    </section>
  );
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const color = pct > 0.5 ? 'bg-green-600' : pct > 0.25 ? 'bg-yellow-500' : 'bg-red-600';
  return (
    <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

function characterToUpdateDraft(c: Character): UpdateCharacterRequest {
  const stats = c.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  return {
    name: c.name,
    race: c.race ?? '',
    subrace: c.subrace ?? '',
    class: c.class ?? '',
    subclass: c.subclass ?? '',
    background: c.background ?? '',
    alignment: c.alignment ?? '',
    level: c.level,
    hp: c.hp,
    maxHp: c.maxHp,
    tempHp: c.tempHp ?? 0,
    ac: c.ac,
    speed: c.speed,
    stats: { ...stats },
    personality: c.personality ?? '',
    backstory: c.backstory ?? '',
    ideals: c.ideals ?? '',
    bonds: c.bonds ?? '',
    flaws: c.flaws ?? '',
    appearance: c.appearance ?? '',
    notes: c.notes ?? '',
  };
}

export function CharacterSheet({
  character,
  isDm,
  allCharacters,
  onRoll,
  onUpdateHp,
  campaignId: _campaignId,
  currentUserId,
  onSaveCharacter,
}: CharacterSheetProps) {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabId>('core');
  const [dmViewChar, setDmViewChar] = useState<string | null>(null);
  const [hpDelta, setHpDelta] = useState('');
  const [expandSaves, setExpandSaves] = useState(false);
  const [sheetEditing, setSheetEditing] = useState(false);
  const [sheetDraft, setSheetDraft] = useState<UpdateCharacterRequest | null>(null);
  const [sheetSaving, setSheetSaving] = useState(false);

  const viewed = isDm && dmViewChar
    ? allCharacters.find(c => c.id === dmViewChar) ?? character
    : character;

  const isOwner = Boolean(currentUserId && viewed?.userId === currentUserId);
  const canSheetEdit = Boolean(isOwner && onSaveCharacter && viewed);

  const startSheetEdit = () => {
    if (!viewed) return;
    setSheetDraft(characterToUpdateDraft(viewed));
    setSheetEditing(true);
  };

  const saveSheet = async () => {
    if (!viewed || !sheetDraft || !onSaveCharacter) return;
    setSheetSaving(true);
    try {
      await onSaveCharacter(viewed.id, sheetDraft);
      setSheetEditing(false);
      setSheetDraft(null);
    } finally {
      setSheetSaving(false);
    }
  };

  if (!viewed) {
    return (
      <div className="h-full flex flex-col">
        {isDm && allCharacters.length > 0 && (
          <div className="p-3 border-b border-border/30 bg-background/60">
            <label className="block text-[10px] font-sans font-bold text-muted-foreground uppercase mb-1">View Character</label>
            <select
              className="w-full bg-card border border-border rounded p-1.5 text-sm text-foreground font-sans"
              value={dmViewChar || ''}
              onChange={e => setDmViewChar(e.target.value || null)}
            >
              <option value="">Select a character</option>
              {allCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center text-muted-foreground italic font-sans text-center p-6">
          {allCharacters.length === 0
            ? 'No characters in this campaign yet.'
            : 'No character assigned to you.'}
        </div>
      </div>
    );
  }

  const stats = (viewed.stats as unknown as Record<string, number>) || {};
  const sheetData = (viewed.sheetData as Record<string, unknown>) || {};
  const prof = profBonus(viewed.level || 1);
  const saveProficiencies = (sheetData.saveProficiencies as string[]) || [];
  const skillProficiencies = (sheetData.skillProficiencies as string[]) || [];
  const skillExpertise = (sheetData.skillExpertise as string[]) || [];
  const spellSlots = (sheetData.spellSlots as Record<string, { total: number; used: number }>) || {};
  const spells = (sheetData.spells as { name: string; level: number; prepared: boolean }[]) || [];
  const inventory = (sheetData.inventory as { name: string; qty: number; weight?: number; notes?: string }[]) || [];
  const features = (sheetData.features as { name: string; source: string; desc: string }[]) || [];

  const getSkillMod = (skill: typeof SKILLS[0]) => {
    const base = mod(stats[skill.ability] || 10);
    if (skillExpertise.includes(skill.key)) return base + prof * 2;
    if (skillProficiencies.includes(skill.key)) return base + prof;
    return base;
  };

  const getSaveMod = (ability: string) => {
    const base = mod(stats[ability] || 10);
    return saveProficiencies.includes(ability) ? base + prof : base;
  };

  const applyHpDelta = (sign: 1 | -1) => {
    const n = parseInt(hpDelta, 10);
    if (isNaN(n) || n <= 0) return;
    onUpdateHp(sign * n);
    setHpDelta('');
  };

  return (
    <div className="h-full flex flex-col bg-card text-foreground overflow-hidden">
      {/* DM character switcher */}
      {isDm && allCharacters.length > 1 && (
        <div className="px-3 py-1.5 bg-background/60 border-b border-border/30 flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <select
            className="flex-1 bg-transparent text-primary text-xs font-sans font-bold uppercase border-none outline-none cursor-pointer"
            value={dmViewChar || ''}
            onChange={e => setDmViewChar(e.target.value || null)}
          >
            <option value="">My Character</option>
            {allCharacters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b-2 border-border bg-background/30">
        <div className="flex gap-3 items-start">
          {viewed.avatarUrl ? (
            <img
              src={viewed.avatarUrl}
              alt=""
              className="w-14 h-14 rounded-lg object-cover border border-border shrink-0"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-sans font-bold text-primary leading-none mb-0.5 truncate">{viewed.name}</h2>
            <div className="text-xs font-sans font-semibold text-muted-foreground tracking-widest">
              Level {viewed.level}{' '}
              {[viewed.subrace || viewed.race, viewed.subclass || viewed.class, viewed.background]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <div className="mt-1 flex gap-4 text-xs font-sans">
              <span>
                Prof <strong className="text-primary">+{prof}</strong>
              </span>
              <span>
                Speed <strong>{viewed.speed || 30} ft</strong>
              </span>
              {viewed.isNpc && <span className="text-destructive font-bold">NPC</span>}
            </div>
          </div>
          {isOwner && viewed ? (
            <div className="flex flex-col gap-1 shrink-0">
              {!sheetEditing ? (
                <>
                  {canSheetEdit && (
                    <VttButton
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-[10px] px-2 py-1 h-auto"
                      onClick={startSheetEdit}
                    >
                      Quick edit
                    </VttButton>
                  )}
                  <VttButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-[10px] px-2 py-1 h-auto"
                    onClick={() => setLocation(`/hero/${viewed.id}`)}
                  >
                    Full studio
                  </VttButton>
                </>
              ) : (
                canSheetEdit && (
                  <>
                    <VttButton
                      type="button"
                      size="sm"
                      className="text-[10px] px-2 py-1 h-auto"
                      disabled={sheetSaving}
                      onClick={() => void saveSheet()}
                    >
                      {sheetSaving ? '…' : 'Save'}
                    </VttButton>
                    <VttButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-[10px] px-2 py-1 h-auto"
                      disabled={sheetSaving}
                      onClick={() => {
                        setSheetEditing(false);
                        setSheetDraft(null);
                      }}
                    >
                      Cancel
                    </VttButton>
                  </>
                )
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Core stats row */}
      <div className="grid grid-cols-6 gap-1 px-3 pt-3 pb-2 border-b border-border/30">
        {ABILITY_KEYS.map(k => (
          <button
            key={k}
            onClick={() => onRoll(`1d20${fmtMod(mod(stats[k] || 10))}`, `${ABILITY_NAMES[k]} Check`)}
            className="flex flex-col items-center justify-center py-2 border-2 border-border/50 bg-background/40 rounded hover:bg-primary/15 hover:border-primary/60 transition-colors active:scale-95"
          >
            <span className="text-[8px] font-sans font-bold text-primary/80 uppercase">{ABILITY_SHORT[k]}</span>
            <span className="text-lg font-bold font-sans leading-tight text-foreground">{fmtMod(mod(stats[k] || 10))}</span>
            <span className="text-[9px] font-bold bg-primary/20 text-primary rounded-full w-6 h-4 flex items-center justify-center">{stats[k] || 10}</span>
          </button>
        ))}
      </div>

      {/* Combat row */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2 p-2 border border-border/40 rounded bg-foreground/5">
          <Shield className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <div className="text-xl font-bold font-sans leading-none text-foreground">{viewed.ac}</div>
            <div className="text-[9px] font-sans uppercase opacity-70">AC</div>
          </div>
        </div>
        <button
          onClick={() => onRoll(`1d20${fmtMod(viewed.initiativeBonus ?? mod(stats.dex || 10))}`, 'Initiative')}
          className="flex items-center gap-2 p-2 border border-border/40 rounded bg-foreground/5 hover:bg-primary/15 transition-colors"
        >
          <Zap className="w-5 h-5 text-accent flex-shrink-0" />
          <div>
            <div className="text-xl font-bold font-sans leading-none text-foreground">{fmtMod(viewed.initiativeBonus ?? mod(stats.dex || 10))}</div>
            <div className="text-[9px] font-sans uppercase opacity-70">Init</div>
          </div>
        </button>
        <div className="flex items-center gap-2 p-2 border border-border/40 rounded bg-foreground/5">
          <Crosshair className="w-5 h-5 text-magic flex-shrink-0" />
          <div>
            <div className="text-xl font-bold font-sans leading-none text-foreground">{viewed.speed || 30}</div>
            <div className="text-[9px] font-sans uppercase opacity-70">Speed</div>
          </div>
        </div>
      </div>

      {/* HP Block */}
      <div className="px-3 py-2 border-b border-border/30">
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1 text-xs font-sans font-bold">
            <Heart className="w-4 h-4 fill-red-500 text-red-500" /> Hit Points
          </span>
          <span className="font-bold font-sans">
            <span className="text-xl text-red-400">{viewed.hp}</span>
            <span className="text-sm opacity-50"> / {viewed.maxHp}</span>
            {(viewed.tempHp ?? 0) > 0 && (
              <span className="text-sm text-accent ml-1">(+{viewed.tempHp} temp)</span>
            )}
          </span>
        </div>
        <HpBar current={viewed.hp || 0} max={viewed.maxHp || 1} />
        <div className="mt-2 flex gap-1">
          <input
            type="number"
            min={1}
            placeholder="amt"
            value={hpDelta}
            onChange={e => setHpDelta(e.target.value)}
            className="w-16 text-center border border-border/50 rounded px-1 py-1 text-sm bg-background/50 text-foreground font-mono"
          />
          <button
            onClick={() => applyHpDelta(-1)}
            className="flex-1 py-1 text-xs font-sans font-bold bg-red-700 text-white rounded hover:bg-red-800 transition-colors"
          >
            DAMAGE
          </button>
          <button
            onClick={() => applyHpDelta(1)}
            className="flex-1 py-1 text-xs font-sans font-bold bg-green-700 text-white rounded hover:bg-green-800 transition-colors"
          >
            HEAL
          </button>
        </div>
      </div>

      {sheetEditing && sheetDraft ? (
        <div className="flex-1 overflow-y-auto min-h-0 border-t border-border/30">
          <SheetQuickEditForm draft={sheetDraft} setDraft={setSheetDraft} />
        </div>
      ) : (
        <>
          {/* Sub-tabs */}
          <div className="flex border-b border-border/30 bg-background/20 text-[9px] sm:text-[10px] font-sans font-bold">
            {TAB_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 min-w-0 py-2 uppercase tracking-wider sm:tracking-widest transition-colors border-b-2 ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">

        {/* CORE Tab */}
        {tab === 'core' && (
          <div className="p-3 space-y-3">
            {/* Saving Throws */}
            <div className="border border-border/30 rounded overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2 bg-foreground/5 text-xs font-sans font-bold uppercase tracking-widest hover:bg-foreground/10 transition-colors"
                onClick={() => setExpandSaves(!expandSaves)}
              >
                <span className="flex items-center gap-1 text-muted-foreground"><BookOpen className="w-3.5 h-3.5" /> Saving Throws</span>
                {expandSaves ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {expandSaves && (
                <div className="divide-y divide-border/15">
                  {ABILITY_KEYS.map(k => {
                    const isProficient = saveProficiencies.includes(k);
                    const m = getSaveMod(k);
                    return (
                      <button
                        key={k}
                        onClick={() => onRoll(`1d20${fmtMod(m)}`, `${ABILITY_NAMES[k]} Save`)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-primary/10 transition-colors text-left"
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${isProficient ? 'bg-primary border-primary' : 'border-border/60'}`} />
                        <span className="flex-1 text-xs font-sans text-foreground/90">{ABILITY_NAMES[k]}</span>
                        <span className="font-bold font-sans text-sm text-primary">{fmtMod(m)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Attack / Actions */}
            <div>
              <h4 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                <Swords className="w-3 h-3" /> Quick Attacks
              </h4>
              <div className="space-y-1">
                <button
                  className="w-full flex justify-between items-center p-2 hover:bg-primary/10 rounded border border-transparent hover:border-border/30 text-sm transition-colors"
                  onClick={() => onRoll(`1d20${fmtMod(mod(stats.str || 10) + prof)}`, 'Melee Attack')}
                >
                  <span className="font-semibold flex items-center gap-1.5 text-foreground/90"><Crosshair className="w-3.5 h-3.5" /> Melee Attack</span>
                  <span className="font-bold font-sans text-primary">{fmtMod(mod(stats.str || 10) + prof)}</span>
                </button>
                <button
                  className="w-full flex justify-between items-center p-2 hover:bg-primary/10 rounded border border-transparent hover:border-border/30 text-sm transition-colors"
                  onClick={() => onRoll(`1d20${fmtMod(mod(stats.dex || 10) + prof)}`, 'Ranged Attack')}
                >
                  <span className="font-semibold flex items-center gap-1.5 text-foreground/90"><Crosshair className="w-3.5 h-3.5" /> Ranged Attack</span>
                  <span className="font-bold font-sans text-primary">{fmtMod(mod(stats.dex || 10) + prof)}</span>
                </button>
                <button
                  className="w-full flex justify-between items-center p-2 hover:bg-primary/10 rounded border border-transparent hover:border-border/30 text-sm transition-colors"
                  onClick={() => onRoll(`1d20+${mod(stats.str || 10) + prof}`, 'Athletics')}
                >
                  <span className="font-semibold text-foreground/90">Athletics</span>
                  <span className="font-bold font-sans text-primary">{fmtMod(mod(stats.str || 10) + prof)}</span>
                </button>
              </div>
            </div>

            {/* Features */}
            {features.length > 0 && (
              <div>
                <h4 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <Star className="w-3 h-3" /> Features & Traits
                </h4>
                <div className="space-y-1.5">
                  {features.map((f, i) => (
                    <div key={i} className="p-2 bg-foreground/5 border border-border/20 rounded">
                      <div className="text-xs font-bold font-sans text-primary">{f.name}</div>
                      {f.source && <div className="text-[9px] text-muted-foreground font-sans">{f.source}</div>}
                      {f.desc && <div className="text-xs font-sans mt-0.5 leading-relaxed text-foreground/80">{f.desc}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* BIO — creator fields: backstory, personality, ideals, etc. */}
        {tab === 'bio' && (
          <div className="p-3 space-y-3">
            {(() => {
              const alignment =
                viewed.alignment?.trim() ||
                (typeof sheetData.alignment === 'string' ? sheetData.alignment.trim() : '') ||
                '';
              const personality =
                viewed.personality?.trim() ||
                (typeof sheetData.personalityTrait === 'string' ? sheetData.personalityTrait.trim() : '') ||
                '';
              const rows: { title: string; text: string }[] = [
                { title: 'Alignment', text: alignment },
                { title: 'Personality & mannerisms', text: personality },
                { title: 'Backstory', text: viewed.backstory?.trim() || '' },
                { title: 'Ideals', text: viewed.ideals?.trim() || '' },
                { title: 'Bonds', text: viewed.bonds?.trim() || '' },
                { title: 'Flaws', text: viewed.flaws?.trim() || '' },
                { title: 'Appearance', text: viewed.appearance?.trim() || '' },
                { title: 'Notes', text: viewed.notes?.trim() || '' },
              ];
              const filled = rows.filter((r) => r.text);
              if (filled.length === 0) {
                return (
                  <div className="text-center py-8 px-2">
                    <ScrollText className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" aria-hidden />
                    <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                      No biography or notes on this sheet yet. Text you enter in the character creator
                      (personality, backstory, ideals, bonds, flaws, appearance, notes) appears here.
                    </p>
                  </div>
                );
              }
              return filled.map((r) => <BioSection key={r.title} title={r.title} text={r.text} />);
            })()}
          </div>
        )}

        {/* SKILLS Tab */}
        {tab === 'skills' && (
          <div className="divide-y divide-border/15">
            {SKILLS.map(skill => {
              const m = getSkillMod(skill);
              const isExpert = skillExpertise.includes(skill.key);
              const isProf = skillProficiencies.includes(skill.key);
              return (
                <button
                  key={skill.key}
                  onClick={() => onRoll(`1d20${fmtMod(m)}`, skill.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/10 transition-colors text-left"
                >
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${isExpert ? 'bg-accent border-accent' : isProf ? 'bg-primary border-primary' : 'border-border/60'}`} />
                  <span className="flex-1 text-xs font-sans text-foreground/90">{skill.name}</span>
                  <span className="text-[9px] text-muted-foreground font-sans">{ABILITY_SHORT[skill.ability]}</span>
                  <span className="font-bold font-sans text-sm w-8 text-right text-primary">{fmtMod(m)}</span>
                </button>
              );
            })}
            <div className="p-3 text-[10px] text-muted-foreground font-sans">
              ● Proficient &nbsp; ◆ Expert (×2 Prof)
            </div>
          </div>
        )}

        {/* SPELLS Tab */}
        {tab === 'spells' && (
          <div className="p-3 space-y-3">
            {/* Spell Slots */}
            <div>
              <h4 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-2">Spell Slots</h4>
              {Object.keys(spellSlots).length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No spell slots recorded.</div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {Object.entries(spellSlots).map(([level, slot]) => (
                    <div key={level} className="text-center border border-border/40 rounded p-1.5 bg-foreground/5">
                      <div className="text-[9px] font-sans uppercase text-muted-foreground">Level {level}</div>
                      <div className="font-bold font-sans text-primary">{slot.total - slot.used} / {slot.total}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Spell list */}
            <div>
              <h4 className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground mb-2">Spells Known</h4>
              {spells.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No spells recorded.</div>
              ) : (
                <div className="space-y-1">
                  {[...new Set(spells.map(s => s.level))].sort().map(level => (
                    <div key={level}>
                      <div className="text-[9px] font-sans font-bold uppercase text-muted-foreground mb-0.5">
                        {level === 0 ? 'Cantrips' : `Level ${level}`}
                      </div>
                      {spells.filter(s => s.level === level).map((s, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1 hover:bg-primary/10 rounded text-xs">
                          <div className={`w-2 h-2 rounded-full ${s.prepared ? 'bg-accent' : 'border border-border/60'}`} />
                          <span className="text-foreground/90">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* INVENTORY Tab */}
        {tab === 'inventory' && (
          <div className="p-3 space-y-2">
            {inventory.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">No items in inventory.</div>
            ) : (
              <div className="space-y-1">
                {inventory.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-foreground/5 border border-border/20 rounded">
                    <div className="flex-1">
                      <div className="text-xs font-bold font-sans text-foreground">{item.name}</div>
                      {item.notes && <div className="text-[10px] text-muted-foreground">{item.notes}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-primary">×{item.qty}</div>
                      {item.weight !== undefined && <div className="text-[9px] text-muted-foreground">{item.weight}lb</div>}
                    </div>
                  </div>
                ))}
                <div className="text-[10px] text-muted-foreground font-sans pt-1">
                  Total weight: {inventory.reduce((sum, i) => sum + (i.weight || 0) * i.qty, 0)} lb
                </div>
              </div>
            )}
          </div>
        )}
          </div>
        </>
      )}
    </div>
  );
}

const quickInputCls =
  'w-full text-xs border border-border/50 rounded px-2 py-1 bg-background/50 text-foreground font-sans';

function SheetQuickEditForm({
  draft,
  setDraft,
}: {
  draft: UpdateCharacterRequest;
  setDraft: React.Dispatch<React.SetStateAction<UpdateCharacterRequest | null>>;
}) {
  const stats = draft.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const set = <K extends keyof UpdateCharacterRequest>(key: K, value: UpdateCharacterRequest[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };
  const setStat = (k: keyof typeof stats, v: number) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...(d.stats || stats), [k]: Number.isFinite(v) ? v : 10 };
      return { ...d, stats: next };
    });
  };
  return (
    <div className="p-3 space-y-3">
      <p className="text-[10px] text-muted-foreground font-sans leading-snug">
        Changes apply at the table when you save. Portrait, backdrop, and larger edits live in{' '}
        <span className="text-primary">Full studio</span>.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground col-span-2">Name</label>
        <input className={`${quickInputCls} col-span-2`} value={draft.name ?? ''} onChange={(e) => set('name', e.target.value)} />
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Level</label>
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Alignment</label>
        <input
          type="number"
          min={1}
          max={20}
          className={quickInputCls}
          value={draft.level ?? 1}
          onChange={(e) => set('level', parseInt(e.target.value, 10) || 1)}
        />
        <input className={quickInputCls} value={draft.alignment ?? ''} onChange={(e) => set('alignment', e.target.value)} />
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Race</label>
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Subrace</label>
        <input className={quickInputCls} value={draft.race ?? ''} onChange={(e) => set('race', e.target.value)} />
        <input className={quickInputCls} value={draft.subrace ?? ''} onChange={(e) => set('subrace', e.target.value)} />
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Class</label>
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Subclass</label>
        <input className={quickInputCls} value={draft.class ?? ''} onChange={(e) => set('class', e.target.value)} />
        <input className={quickInputCls} value={draft.subclass ?? ''} onChange={(e) => set('subclass', e.target.value)} />
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Background</label>
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Speed</label>
        <input className={quickInputCls} value={draft.background ?? ''} onChange={(e) => set('background', e.target.value)} />
        <input
          type="number"
          className={quickInputCls}
          value={draft.speed ?? 30}
          onChange={(e) => set('speed', parseInt(e.target.value, 10) || 0)}
        />
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">HP</label>
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">Max HP</label>
        <input
          type="number"
          className={quickInputCls}
          value={draft.hp ?? 0}
          onChange={(e) => set('hp', parseInt(e.target.value, 10) || 0)}
        />
        <input
          type="number"
          className={quickInputCls}
          value={draft.maxHp ?? 0}
          onChange={(e) => set('maxHp', parseInt(e.target.value, 10) || 0)}
        />
        <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground">AC</label>
        <div />
        <input
          type="number"
          className={quickInputCls}
          value={draft.ac ?? 10}
          onChange={(e) => set('ac', parseInt(e.target.value, 10) || 0)}
        />
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k) => (
          <div key={k}>
            <span className="text-[8px] font-bold text-muted-foreground uppercase block mb-0.5">{k}</span>
            <input
              type="number"
              className={quickInputCls}
              value={stats[k]}
              onChange={(e) => setStat(k, parseInt(e.target.value, 10) || 10)}
            />
          </div>
        ))}
      </div>
      {(
        [
          ['personality', 'Personality'],
          ['ideals', 'Ideals'],
          ['bonds', 'Bonds'],
          ['flaws', 'Flaws'],
          ['appearance', 'Appearance'],
          ['backstory', 'Backstory'],
          ['notes', 'Notes'],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground block mb-1">{label}</label>
          <textarea
            className={`${quickInputCls} min-h-[52px]`}
            rows={key === 'backstory' || key === 'notes' ? 4 : 2}
            value={(draft[key] as string) ?? ''}
            onChange={(e) => set(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
