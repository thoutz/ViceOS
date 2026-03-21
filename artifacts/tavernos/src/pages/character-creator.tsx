import React, { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetCampaign, useCreateCharacter } from '@workspace/api-client-react';
import { DiceRoll } from 'rpg-dice-roller';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Dices, Check } from 'lucide-react';

// ─── D&D 5e data ────────────────────────────────────────────────────────────────

const RACES: Array<{ name: string; subrace?: string[]; speed: number; traits: string[]; bonus: Record<string, number> }> = [
  { name: 'Human', speed: 30, traits: ['+1 to all ability scores', 'Extra language', 'Extra skill'], bonus: { str:1,dex:1,con:1,int:1,wis:1,cha:1 } },
  { name: 'Elf', subrace: ['High Elf', 'Wood Elf', 'Dark Elf (Drow)'], speed: 30, traits: ['Darkvision', 'Fey Ancestry', 'Trance', 'Keen Senses'], bonus: { dex:2 } },
  { name: 'Dwarf', subrace: ['Hill Dwarf', 'Mountain Dwarf'], speed: 25, traits: ['Darkvision', 'Dwarven Resilience', 'Stonecunning', 'Tool Proficiency'], bonus: { con:2 } },
  { name: 'Halfling', subrace: ['Lightfoot', 'Stout'], speed: 25, traits: ['Lucky', 'Brave', 'Halfling Nimbleness'], bonus: { dex:2 } },
  { name: 'Gnome', subrace: ['Forest Gnome', 'Rock Gnome'], speed: 25, traits: ['Darkvision', 'Gnome Cunning'], bonus: { int:2 } },
  { name: 'Half-Elf', speed: 30, traits: ['Darkvision', 'Fey Ancestry', 'Skill Versatility (+2 skills)'], bonus: { cha:2 } },
  { name: 'Half-Orc', speed: 30, traits: ['Darkvision', 'Menacing', 'Relentless Endurance', 'Savage Attacks'], bonus: { str:2,con:1 } },
  { name: 'Tiefling', speed: 30, traits: ['Darkvision', 'Hellish Resistance', 'Infernal Legacy'], bonus: { int:1,cha:2 } },
  { name: 'Dragonborn', speed: 30, traits: ['Draconic Ancestry', 'Breath Weapon', 'Damage Resistance'], bonus: { str:2,cha:1 } },
];

const CLASSES: Array<{ name: string; hitDie: number; savingThrows: string[]; skills: string[]; features: string[]; spellcaster: boolean }> = [
  { name: 'Barbarian', hitDie: 12, savingThrows: ['str','con'], skills: ['Athletics','Intimidation','Nature','Perception','Survival'], features: ['Rage','Unarmored Defense'], spellcaster: false },
  { name: 'Bard', hitDie: 8, savingThrows: ['dex','cha'], skills: ['Any (3 skills)'], features: ['Spellcasting','Bardic Inspiration'], spellcaster: true },
  { name: 'Cleric', hitDie: 8, savingThrows: ['wis','cha'], skills: ['History','Insight','Medicine','Persuasion','Religion'], features: ['Spellcasting','Divine Domain','Channel Divinity'], spellcaster: true },
  { name: 'Druid', hitDie: 8, savingThrows: ['int','wis'], skills: ['Arcana','Animal Handling','Insight','Medicine','Nature','Perception','Religion','Survival'], features: ['Spellcasting','Druidic','Wild Shape'], spellcaster: true },
  { name: 'Fighter', hitDie: 10, savingThrows: ['str','con'], skills: ['Acrobatics','Animal Handling','Athletics','History','Insight','Intimidation','Perception','Survival'], features: ['Fighting Style','Second Wind','Action Surge'], spellcaster: false },
  { name: 'Monk', hitDie: 8, savingThrows: ['str','dex'], skills: ['Acrobatics','Athletics','History','Insight','Religion','Stealth'], features: ['Unarmored Defense','Martial Arts','Ki'], spellcaster: false },
  { name: 'Paladin', hitDie: 10, savingThrows: ['wis','cha'], skills: ['Athletics','Insight','Intimidation','Medicine','Persuasion','Religion'], features: ['Divine Sense','Lay on Hands','Spellcasting','Divine Smite'], spellcaster: true },
  { name: 'Ranger', hitDie: 10, savingThrows: ['str','dex'], skills: ['Animal Handling','Athletics','Insight','Investigation','Nature','Perception','Stealth','Survival'], features: ['Favored Enemy','Natural Explorer','Spellcasting'], spellcaster: true },
  { name: 'Rogue', hitDie: 8, savingThrows: ['dex','int'], skills: ['Acrobatics','Athletics','Deception','Insight','Intimidation','Investigation','Perception','Performance','Persuasion','Sleight of Hand','Stealth'], features: ['Expertise','Sneak Attack','Thieves Cant','Cunning Action'], spellcaster: false },
  { name: 'Sorcerer', hitDie: 6, savingThrows: ['con','cha'], skills: ['Arcana','Deception','Insight','Intimidation','Persuasion','Religion'], features: ['Spellcasting','Sorcerous Origin','Font of Magic'], spellcaster: true },
  { name: 'Warlock', hitDie: 8, savingThrows: ['wis','cha'], skills: ['Arcana','Deception','History','Intimidation','Investigation','Nature','Religion'], features: ['Otherworldly Patron','Pact Magic','Eldritch Invocations'], spellcaster: true },
  { name: 'Wizard', hitDie: 6, savingThrows: ['int','wis'], skills: ['Arcana','History','Insight','Investigation','Medicine','Religion'], features: ['Spellcasting','Arcane Recovery','Arcane Tradition'], spellcaster: true },
];

const BACKGROUNDS: Array<{ name: string; skills: string[]; feature: string }> = [
  { name: 'Acolyte', skills: ['Insight', 'Religion'], feature: 'Shelter of the Faithful' },
  { name: 'Charlatan', skills: ['Deception', 'Sleight of Hand'], feature: 'False Identity' },
  { name: 'Criminal', skills: ['Deception', 'Stealth'], feature: 'Criminal Contact' },
  { name: 'Entertainer', skills: ['Acrobatics', 'Performance'], feature: 'By Popular Demand' },
  { name: 'Folk Hero', skills: ['Animal Handling', 'Survival'], feature: 'Rustic Hospitality' },
  { name: 'Guild Artisan', skills: ['Insight', 'Persuasion'], feature: 'Guild Membership' },
  { name: 'Hermit', skills: ['Medicine', 'Religion'], feature: 'Discovery' },
  { name: 'Noble', skills: ['History', 'Persuasion'], feature: 'Position of Privilege' },
  { name: 'Outlander', skills: ['Athletics', 'Survival'], feature: 'Wanderer' },
  { name: 'Sage', skills: ['Arcana', 'History'], feature: 'Researcher' },
  { name: 'Sailor', skills: ['Athletics', 'Perception'], feature: "Ship's Passage" },
  { name: 'Soldier', skills: ['Athletics', 'Intimidation'], feature: 'Military Rank' },
  { name: 'Urchin', skills: ['Sleight of Hand', 'Stealth'], feature: 'City Secrets' },
];

const SKILL_NAMES = [
  'Acrobatics','Animal Handling','Arcana','Athletics','Deception',
  'History','Insight','Intimidation','Investigation','Medicine',
  'Nature','Perception','Performance','Persuasion','Religion',
  'Sleight of Hand','Stealth','Survival',
];

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const STAT_NAMES: Record<string, string> = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' };

function mod(score: number) { return Math.floor((score - 10) / 2); }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

type StatKey = typeof STAT_KEYS[number];
type AbilityMethod = 'roll' | 'standard';

const TOKEN_COLORS = ['#C9A84C','#5B3FA6','#E07B39','#1B6B3A','#8B1A1A','#1A3A8B','#5A5A5A','#8B5A2B'];

// ─── Steps ──────────────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Race' },
  { num: 2, label: 'Class' },
  { num: 3, label: 'Background' },
  { num: 4, label: 'Abilities' },
  { num: 5, label: 'Skills' },
  { num: 6, label: 'Finish' },
];

interface FormState {
  name: string;
  race: string;
  subrace: string;
  class: string;
  background: string;
  level: number;
  stats: Record<StatKey, number>;
  abilityMethod: AbilityMethod;
  standardAssignments: Record<StatKey, number | ''>;
  selectedSkills: string[];
  tokenColor: string;
  alignment: string;
  personalityTrait: string;
}

export default function CharacterCreator() {
  const { campaignId } = useParams();
  const [, setLocation] = useLocation();
  const { data: campaign, isLoading } = useGetCampaign(campaignId || '');
  const createMutation = useCreateCharacter();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    name: '',
    race: 'Human',
    subrace: '',
    class: 'Fighter',
    background: 'Soldier',
    level: 1,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    abilityMethod: 'standard',
    standardAssignments: { str: '', dex: '', con: '', int: '', wis: '', cha: '' },
    selectedSkills: [],
    tokenColor: '#C9A84C',
    alignment: 'Neutral',
    personalityTrait: '',
  });

  const selectedRace = RACES.find(r => r.name === form.race) || RACES[0];
  const selectedClass = CLASSES.find(c => c.name === form.class) || CLASSES[0];
  const selectedBackground = BACKGROUNDS.find(b => b.name === form.background) || BACKGROUNDS[0];

  const finalStats = (): Record<StatKey, number> => {
    if (form.abilityMethod === 'standard') {
      const base: Record<StatKey, number> = { str:10, dex:10, con:10, int:10, wis:10, cha:10 };
      for (const k of STAT_KEYS) {
        const v = form.standardAssignments[k];
        if (v !== '') base[k] = v as number;
      }
      const bonus = selectedRace.bonus;
      for (const k of STAT_KEYS) {
        base[k] = (base[k] || 10) + (bonus[k] || 0);
      }
      return base;
    } else {
      const bonus = selectedRace.bonus;
      const result = { ...form.stats };
      for (const k of STAT_KEYS) {
        result[k] = (result[k] || 10) + (bonus[k] || 0);
      }
      return result;
    }
  };

  const rollStats = () => {
    const newStats = { ...form.stats };
    for (const k of STAT_KEYS) {
      const roll = new DiceRoll('4d6d1');
      newStats[k] = roll.total;
    }
    setForm(f => ({ ...f, stats: newStats, abilityMethod: 'roll' }));
  };

  const computeHp = (stats: Record<StatKey, number>) => {
    const conMod = mod(stats.con);
    return Math.max(1, selectedClass.hitDie + conMod);
  };

  const computeAc = (stats: Record<StatKey, number>) => {
    return 10 + mod(stats.dex);
  };

  const allSkillsFromBg = selectedBackground.skills;
  const classSkillChoicesCount = 2;
  const availableClassSkills = SKILL_NAMES.filter(s => !allSkillsFromBg.includes(s));

  const handleComplete = () => {
    if (!campaignId || !form.name.trim()) return;

    const stats = finalStats();
    const bgSkills = selectedBackground.skills;
    const allSkillProfs = [...new Set([...bgSkills, ...form.selectedSkills])];
    const savingThrowProfs = selectedClass.savingThrows;

    const features: Array<{ name: string; source: string; desc: string }> = [
      ...selectedClass.features.map(f => ({ name: f, source: `${form.class}`, desc: '' })),
      { name: selectedBackground.feature, source: form.background, desc: '' },
      ...selectedRace.traits.map(t => ({ name: t, source: form.race, desc: '' })),
    ];

    createMutation.mutate(
      {
        campaignId,
        data: {
          name: form.name.trim(),
          race: form.race,
          subrace: form.subrace || undefined,
          class: form.class,
          background: form.background,
          level: form.level,
          stats,
          hp: computeHp(stats),
          maxHp: computeHp(stats),
          ac: computeAc(stats),
          speed: selectedRace.speed,
          tokenColor: form.tokenColor,
          sheetData: {
            saveProficiencies: savingThrowProfs,
            skillProficiencies: allSkillProfs,
            skillExpertise: [],
            spellSlots: {},
            spells: [],
            inventory: [],
            features,
            alignment: form.alignment,
            personalityTrait: form.personalityTrait,
          },
        },
      },
      {
        onSuccess: () => {
          setLocation(`/session/${campaignId}/latest`);
        },
      }
    );
  };

  const canProceed = (() => {
    if (step === 1) return !!form.race;
    if (step === 2) return !!form.class;
    if (step === 3) return !!form.background;
    if (step === 4) {
      if (form.abilityMethod === 'standard') {
        return STAT_KEYS.every(k => form.standardAssignments[k] !== '');
      }
      return true;
    }
    if (step === 5) return true;
    if (step === 6) return !!form.name.trim();
    return true;
  })();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary font-display text-xl animate-pulse">Consulting the archives...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="z-10 w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display text-primary gold-text-glow mb-1">Forge Your Legend</h1>
          <p className="text-muted-foreground font-label tracking-widest text-sm">{campaign?.name}</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 px-4 relative">
          <div className="absolute top-4 left-4 right-4 h-px bg-border" />
          {STEPS.map(s => (
            <button
              key={s.num}
              onClick={() => s.num < step && setStep(s.num)}
              className="relative flex flex-col items-center bg-background px-1"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-sm transition-all ${
                step > s.num
                  ? 'bg-primary border-primary text-card'
                  : step === s.num
                  ? 'bg-primary/20 border-primary text-primary scale-110'
                  : 'bg-card border-border text-muted-foreground'
              }`}>
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-[10px] font-label mt-1.5 uppercase font-bold whitespace-nowrap ${step >= s.num ? 'text-primary' : 'text-muted-foreground/50'}`}>
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="glass-panel rounded-xl overflow-hidden min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {/* Step 1: Race */}
              {step === 1 && (
                <StepRace form={form} setForm={setForm} />
              )}
              {/* Step 2: Class */}
              {step === 2 && (
                <StepClass form={form} setForm={setForm} />
              )}
              {/* Step 3: Background */}
              {step === 3 && (
                <StepBackground form={form} setForm={setForm} />
              )}
              {/* Step 4: Ability Scores */}
              {step === 4 && (
                <StepAbilities
                  form={form}
                  setForm={setForm}
                  selectedRace={selectedRace}
                  rollStats={rollStats}
                />
              )}
              {/* Step 5: Skills & Proficiencies */}
              {step === 5 && (
                <StepSkills
                  form={form}
                  setForm={setForm}
                  selectedBackground={selectedBackground}
                  selectedClass={selectedClass}
                />
              )}
              {/* Step 6: Finish */}
              {step === 6 && (
                <StepFinish
                  form={form}
                  setForm={setForm}
                  finalStats={finalStats()}
                  selectedClass={selectedClass}
                  selectedRace={selectedRace}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="px-6 py-4 border-t border-border/30 flex justify-between items-center flex-shrink-0">
            <button
              disabled={step === 1}
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1.5 text-sm font-label font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors px-3 py-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {step < 6 ? (
              <button
                disabled={!canProceed}
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-1.5 px-5 py-2 bg-primary/20 border border-primary/50 text-primary rounded font-label font-bold text-sm hover:bg-primary/30 disabled:opacity-30 transition-colors"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                disabled={!canProceed || createMutation.isPending}
                onClick={handleComplete}
                className="flex items-center gap-1.5 px-6 py-2 bg-primary border border-primary/80 text-card rounded font-label font-bold text-sm hover:bg-primary/90 disabled:opacity-30 transition-colors"
              >
                {createMutation.isPending ? 'Forging...' : 'Enter the World'}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => setLocation('/dashboard')}
            className="text-xs text-muted-foreground hover:text-foreground font-label transition-colors"
          >
            Cancel & return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step Components ────────────────────────────────────────────────────────────

function StepRace({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const selected = RACES.find(r => r.name === form.race) || RACES[0];
  return (
    <div className="flex flex-col flex-1 p-6 gap-4">
      <div>
        <h2 className="font-display text-2xl text-primary mb-1">Choose Your Race</h2>
        <p className="text-xs text-muted-foreground font-sans">Your race determines your ancestry, special traits, and some ability score bonuses.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 flex-1 overflow-y-auto">
        {RACES.map(race => (
          <button
            key={race.name}
            onClick={() => setForm(f => ({ ...f, race: race.name, subrace: '' }))}
            className={`p-3 border-2 rounded text-left transition-all ${form.race === race.name ? 'border-primary bg-primary/10' : 'border-border hover:border-border/80 hover:bg-card/50'}`}
          >
            <div className="font-label font-bold text-sm">{race.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Spd {race.speed}ft ·{' '}
              {Object.entries(race.bonus).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(', ') || 'Balanced'}
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="bg-card/50 rounded p-3 border border-border/30">
          <div className="text-xs font-label font-bold text-primary mb-1">{selected.name} Traits</div>
          <div className="flex flex-wrap gap-1">
            {selected.traits.map(t => (
              <span key={t} className="text-[10px] bg-primary/10 border border-primary/20 text-primary/80 px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
          {selected.subrace && (
            <div className="mt-2">
              <label className="text-[10px] font-label font-bold text-muted-foreground uppercase">Subrace</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {selected.subrace.map(sr => (
                  <button
                    key={sr}
                    onClick={() => setForm(f => ({ ...f, subrace: sr }))}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${form.subrace === sr ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:border-border/80'}`}
                  >
                    {sr}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepClass({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const selected = CLASSES.find(c => c.name === form.class) || CLASSES[0];
  return (
    <div className="flex flex-col flex-1 p-6 gap-4">
      <div>
        <h2 className="font-display text-2xl text-primary mb-1">Choose Your Class</h2>
        <p className="text-xs text-muted-foreground font-sans">Your class shapes your role in the party and your combat abilities.</p>
      </div>
      <div className="grid grid-cols-3 gap-2 overflow-y-auto">
        {CLASSES.map(cls => (
          <button
            key={cls.name}
            onClick={() => setForm(f => ({ ...f, class: cls.name }))}
            className={`p-3 border-2 rounded text-left transition-all ${form.class === cls.name ? 'border-primary bg-primary/10' : 'border-border hover:border-border/80 hover:bg-card/50'}`}
          >
            <div className="font-label font-bold text-sm">{cls.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              d{cls.hitDie} · {cls.spellcaster ? '✦ Caster' : '⚔ Martial'}
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="bg-card/50 rounded p-3 border border-border/30 flex-shrink-0">
          <div className="text-xs font-label font-bold text-primary mb-1">{selected.name} Features</div>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {selected.features.map(f => (
              <span key={f} className="text-[10px] bg-primary/10 border border-primary/20 text-primary/80 px-2 py-0.5 rounded-full">{f}</span>
            ))}
          </div>
          <div className="text-[10px] text-muted-foreground">
            Saving Throws: <strong>{selected.savingThrows.map(s => s.toUpperCase()).join(', ')}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function StepBackground({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const selected = BACKGROUNDS.find(b => b.name === form.background) || BACKGROUNDS[0];
  return (
    <div className="flex flex-col flex-1 p-6 gap-4">
      <div>
        <h2 className="font-display text-2xl text-primary mb-1">Choose Your Background</h2>
        <p className="text-xs text-muted-foreground font-sans">Backgrounds provide skill proficiencies and a unique feature based on your history.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1">
        {BACKGROUNDS.map(bg => (
          <button
            key={bg.name}
            onClick={() => setForm(f => ({ ...f, background: bg.name }))}
            className={`p-3 border-2 rounded text-left transition-all ${form.background === bg.name ? 'border-primary bg-primary/10' : 'border-border hover:border-border/80 hover:bg-card/50'}`}
          >
            <div className="font-label font-bold text-sm">{bg.name}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{bg.skills.join(', ')}</div>
          </button>
        ))}
      </div>
      {selected && (
        <div className="bg-card/50 rounded p-3 border border-border/30 flex-shrink-0">
          <div className="text-xs font-label font-bold text-primary mb-1">Feature: {selected.feature}</div>
          <div className="text-[10px] text-muted-foreground">
            Skill Proficiencies: <strong>{selected.skills.join(', ')}</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function StepAbilities({
  form, setForm, selectedRace, rollStats,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  selectedRace: typeof RACES[0];
  rollStats: () => void;
}) {
  const unusedStandard = STANDARD_ARRAY.filter(v =>
    !Object.values(form.standardAssignments).includes(v)
  );

  const assignStandard = (stat: StatKey, val: number | '') => {
    const prev = form.standardAssignments[stat];
    const newAssign = { ...form.standardAssignments, [stat]: val };
    setForm(f => ({ ...f, standardAssignments: newAssign }));
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-primary mb-0.5">Ability Scores</h2>
          <p className="text-xs text-muted-foreground font-sans">Assign values to your six ability scores.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setForm(f => ({ ...f, abilityMethod: 'standard', standardAssignments: { str:'',dex:'',con:'',int:'',wis:'',cha:'' } }))}
            className={`text-xs font-label px-3 py-1.5 rounded border transition-colors ${form.abilityMethod === 'standard' ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'}`}
          >
            Standard Array
          </button>
          <button
            onClick={rollStats}
            className={`flex items-center gap-1 text-xs font-label px-3 py-1.5 rounded border transition-colors ${form.abilityMethod === 'roll' ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-border/80'}`}
          >
            <Dices className="w-3.5 h-3.5" /> Roll 4d6
          </button>
        </div>
      </div>

      {form.abilityMethod === 'standard' && (
        <div className="text-xs text-muted-foreground mb-1">
          Assign each value to an ability: <strong>{STANDARD_ARRAY.join(', ')}</strong>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {STAT_KEYS.map(k => {
          const raceBonus = selectedRace.bonus[k] || 0;
          const rawVal = form.abilityMethod === 'standard'
            ? (form.standardAssignments[k] !== '' ? (form.standardAssignments[k] as number) : 0)
            : (form.stats[k] || 10);
          const finalVal = rawVal + raceBonus;

          return (
            <div key={k} className="flex flex-col items-center bg-card border border-border rounded p-3 gap-2">
              <span className="text-[10px] font-label font-bold text-primary uppercase">{STAT_NAMES[k]}</span>

              {form.abilityMethod === 'standard' ? (
                <select
                  value={form.standardAssignments[k]}
                  onChange={e => assignStandard(k, e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-center text-lg font-serif font-bold focus:outline-none focus:border-primary"
                >
                  <option value="">—</option>
                  {STANDARD_ARRAY.filter(v => v === form.standardAssignments[k] || !Object.values(form.standardAssignments).includes(v)).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={form.stats[k]}
                  onChange={e => setForm(f => ({ ...f, stats: { ...f.stats, [k]: parseInt(e.target.value) || 10 } }))}
                  className="w-full bg-background border border-border rounded px-2 py-1.5 text-center text-lg font-serif font-bold focus:outline-none focus:border-primary"
                />
              )}

              <div className="text-center">
                {raceBonus !== 0 && (
                  <div className="text-[10px] text-primary font-label">+{raceBonus} racial</div>
                )}
                <div className="text-xl font-bold font-serif text-primary">{fmtMod(mod(finalVal))}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepSkills({
  form, setForm, selectedBackground, selectedClass,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  selectedBackground: typeof BACKGROUNDS[0];
  selectedClass: typeof CLASSES[0];
}) {
  const bgSkills = selectedBackground.skills;
  const saveProfs = selectedClass.savingThrows;
  const maxClassSkills = 2;
  const classSkillsChosen = form.selectedSkills.filter(s => !bgSkills.includes(s)).length;

  const toggleSkill = (skill: string) => {
    const isBg = bgSkills.includes(skill);
    if (isBg) return; // can't toggle background skills

    if (form.selectedSkills.includes(skill)) {
      setForm(f => ({ ...f, selectedSkills: f.selectedSkills.filter(s => s !== skill) }));
    } else if (classSkillsChosen < maxClassSkills) {
      setForm(f => ({ ...f, selectedSkills: [...f.selectedSkills, skill] }));
    }
  };

  return (
    <div className="flex-1 p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl text-primary mb-0.5">Skills & Proficiencies</h2>
        <p className="text-xs text-muted-foreground font-sans">
          Choose {maxClassSkills} additional skill proficiencies from your class list.
        </p>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto flex-1">
        <div>
          <div className="text-xs font-label font-bold text-primary/80 uppercase mb-1.5">
            Saving Throws ({selectedClass.name})
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STAT_KEYS.map(k => (
              <span key={k} className={`text-xs px-2 py-0.5 rounded border font-label font-bold ${saveProfs.includes(k) ? 'bg-primary/20 border-primary text-primary' : 'border-border/30 text-muted-foreground/50'}`}>
                {k.toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-label font-bold text-primary/80 uppercase mb-1.5">
            Skills ({classSkillsChosen}/{maxClassSkills} chosen)
          </div>
          <div className="grid grid-cols-2 gap-1">
            {SKILL_NAMES.map(skill => {
              const isBg = bgSkills.includes(skill);
              const isChosen = form.selectedSkills.includes(skill);
              const canChoose = !isBg && (isChosen || classSkillsChosen < maxClassSkills);

              return (
                <button
                  key={skill}
                  disabled={!isBg && !canChoose}
                  onClick={() => toggleSkill(skill)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded border text-left transition-all text-xs ${
                    isBg
                      ? 'border-primary/30 bg-primary/10 text-primary/80 cursor-default'
                      : isChosen
                      ? 'border-primary bg-primary/20 text-primary'
                      : canChoose
                      ? 'border-border text-muted-foreground hover:border-border/80 hover:bg-card/30'
                      : 'border-border/20 text-muted-foreground/30 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${isBg || isChosen ? 'bg-primary border-primary' : 'border-border'}`} />
                  {skill}
                  {isBg && <span className="text-[9px] opacity-60 ml-auto">BG</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepFinish({
  form, setForm, finalStats, selectedClass, selectedRace,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  finalStats: Record<StatKey, number>;
  selectedClass: typeof CLASSES[0];
  selectedRace: typeof RACES[0];
}) {
  const conMod = mod(finalStats.con);
  const hp = Math.max(1, selectedClass.hitDie + conMod);
  const ac = 10 + mod(finalStats.dex);

  return (
    <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
      <div>
        <h2 className="font-display text-2xl text-primary mb-1">Finishing Touches</h2>
        <p className="text-xs text-muted-foreground font-sans">Name your character and choose their appearance.</p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-label font-bold text-primary uppercase block mb-1">Character Name *</label>
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Enter your character's name..."
            className="w-full bg-background border-2 border-primary/30 focus:border-primary rounded px-3 py-2.5 text-lg font-serif text-foreground focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-label font-bold text-primary uppercase block mb-1">Alignment</label>
            <select
              value={form.alignment}
              onChange={e => setForm(f => ({ ...f, alignment: e.target.value }))}
              className="w-full bg-background border border-border rounded px-2.5 py-2 text-sm text-foreground font-sans focus:outline-none focus:border-primary"
            >
              {['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'].map(a => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-label font-bold text-primary uppercase block mb-1">Token Color</label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {TOKEN_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, tokenColor: c }))}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: form.tokenColor === c ? '#fff' : 'transparent' }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-label font-bold text-primary uppercase block mb-1">Personality Trait (optional)</label>
          <textarea
            value={form.personalityTrait}
            onChange={e => setForm(f => ({ ...f, personalityTrait: e.target.value }))}
            placeholder="Describe a personality trait..."
            rows={2}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans text-foreground focus:outline-none focus:border-primary resize-none"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card/50 border border-border/30 rounded p-3">
        <div className="text-xs font-label font-bold text-primary mb-2">Character Summary</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-sans text-muted-foreground">
          <span>Race: <strong className="text-foreground">{form.subrace || form.race}</strong></span>
          <span>Class: <strong className="text-foreground">{form.class}</strong></span>
          <span>Background: <strong className="text-foreground">{form.background}</strong></span>
          <span>Speed: <strong className="text-foreground">{selectedRace.speed} ft</strong></span>
          <span>HP: <strong className="text-foreground">{hp}</strong></span>
          <span>AC: <strong className="text-foreground">{ac}</strong></span>
        </div>
        <div className="flex gap-3 mt-2 flex-wrap">
          {STAT_KEYS.map(k => (
            <div key={k} className="text-center">
              <div className="text-[9px] font-label uppercase text-muted-foreground">{k.toUpperCase()}</div>
              <div className="text-sm font-bold font-serif">{finalStats[k]}</div>
              <div className="text-[9px] text-primary/70">{fmtMod(mod(finalStats[k]))}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
