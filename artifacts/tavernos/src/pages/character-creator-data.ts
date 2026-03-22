
export const RACES: Array<{ name: string; subrace?: string[]; speed: number; traits: string[]; bonus: Record<string, number> }> = [
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

export const CLASSES: Array<{ name: string; hitDie: number; savingThrows: string[]; skills: string[]; features: string[]; spellcaster: boolean }> = [
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

export const BACKGROUNDS: Array<{ name: string; skills: string[]; feature: string }> = [
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
export const SKILL_NAMES = [
  'Acrobatics','Animal Handling','Arcana','Athletics','Deception',
  'History','Insight','Intimidation','Investigation','Medicine',
  'Nature','Perception','Performance','Persuasion','Religion',
  'Sleight of Hand','Stealth','Survival',
];

export const SKILL_NAME_TO_KEY: Record<string, string> = {
  'Acrobatics': 'acrobatics',
  'Animal Handling': 'animal_handling',
  'Arcana': 'arcana',
  'Athletics': 'athletics',
  'Deception': 'deception',
  'History': 'history',
  'Insight': 'insight',
  'Intimidation': 'intimidation',
  'Investigation': 'investigation',
  'Medicine': 'medicine',
  'Nature': 'nature',
  'Perception': 'perception',
  'Performance': 'performance',
  'Persuasion': 'persuasion',
  'Religion': 'religion',
  'Sleight of Hand': 'sleight_of_hand',
  'Stealth': 'stealth',
  'Survival': 'survival',
};

export function skillNameToKey(name: string): string {
  return SKILL_NAME_TO_KEY[name] ?? name.toLowerCase().replace(/\s+/g, '_');
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export const STAT_NAMES: Record<string, string> = { str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma' };

export const EQUIPMENT_PACKS: Record<string, string[]> = {
  "Dungeoneer's Pack": ["Backpack", "Crowbar", "Hammer", "10 Pitons", "10 Torches", "Tinderbox", "10 days rations", "Waterskin", "50ft Hemp Rope"],
  "Burglar's Pack": ["Backpack", "1000 Ball Bearings", "String (10ft)", "Bell", "5 Candles", "Crowbar", "Hammer", "10 Pitons", "Hooded Lantern", "2 Flasks Oil", "5 Days Rations", "Tinderbox", "Waterskin", "50ft Hemp Rope"],
  "Explorer's Pack": ["Backpack", "Bedroll", "Mess Kit", "Tinderbox", "10 Torches", "10 Days Rations", "Waterskin", "50ft Hemp Rope"],
  "Scholar's Pack": ["Backpack", "Book of Lore", "Ink Bottle", "Ink Pen", "10 Sheets Parchment", "Bag of Sand", "Small Knife"],
  "Entertainer's Pack": ["Backpack", "Bedroll", "2 Costumes", "5 Candles", "5 Days Rations", "Waterskin", "Disguise Kit"],
  "Diplomat's Pack": ["Chest", "2 Map Cases", "2 Sets Fine Clothes", "Ink & Pen", "Lamp", "2 Flasks Oil", "5 Sheets Paper", "Perfume", "Wax & Seal", "Soap"],
  "Priest's Pack": ["Backpack", "Blanket", "10 Candles", "Tinderbox", "Alms Box", "2 Blocks Incense", "Censer", "Vestments", "2 Days Rations", "Waterskin"],
};

export const CLASS_EQUIPMENT: Record<string, { weapons: string[]; armor: string[]; packs: string[] }> = {
  Barbarian: { weapons: ["Greataxe", "Two Handaxes", "4 Javelins"], armor: ["No armor (Unarmored Defense)"], packs: ["Explorer's Pack"] },
  Bard: { weapons: ["Rapier", "Shortbow (20 arrows)"], armor: ["Leather Armor"], packs: ["Entertainer's Pack", "Diplomat's Pack"] },
  Cleric: { weapons: ["Mace", "Light Crossbow (20 bolts)"], armor: ["Scale Mail", "Leather Armor", "Chain Mail"], packs: ["Priest's Pack", "Explorer's Pack"] },
  Druid: { weapons: ["Wooden Shield", "Scimitar", "Quarterstaff"], armor: ["Leather Armor"], packs: ["Explorer's Pack"] },
  Fighter: { weapons: ["Longsword & Shield", "Two Handaxes", "Crossbow (20 bolts)", "Longbow (20 arrows)"], armor: ["Chain Mail", "Leather Armor"], packs: ["Dungeoneer's Pack", "Explorer's Pack"] },
  Monk: { weapons: ["Shortsword", "10 Darts"], armor: ["No armor (Unarmored Defense)"], packs: ["Dungeoneer's Pack", "Explorer's Pack"] },
  Paladin: { weapons: ["Longsword & Shield", "5 Javelins", "Martial Weapon"], armor: ["Chain Mail"], packs: ["Priest's Pack", "Explorer's Pack"] },
  Ranger: { weapons: ["Two Shortswords", "Two Handaxes", "Longbow (20 arrows)"], armor: ["Scale Mail", "Leather Armor"], packs: ["Dungeoneer's Pack", "Explorer's Pack"] },
  Rogue: { weapons: ["Rapier", "Shortbow (20 arrows)", "Shortsword"], armor: ["Leather Armor"], packs: ["Burglar's Pack", "Dungeoneer's Pack", "Explorer's Pack"] },
  Sorcerer: { weapons: ["Light Crossbow (20 bolts)", "Quarterstaff", "Dagger"], armor: ["No armor"], packs: ["Dungeoneer's Pack", "Explorer's Pack"] },
  Warlock: { weapons: ["Light Crossbow (20 bolts)", "Simple Weapon", "Arcane Focus"], armor: ["Leather Armor"], packs: ["Dungeoneer's Pack", "Scholar's Pack"] },
  Wizard: { weapons: ["Quarterstaff", "Dagger"], armor: ["No armor"], packs: ["Scholar's Pack", "Explorer's Pack"] },
};

export function mod(score: number) {
  return Math.floor((score - 10) / 2);
}
export function fmtMod(n: number) {
  return n >= 0 ? `+${n}` : `${n}`;
}

export type StatKey = (typeof STAT_KEYS)[number];

export const ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
] as const;

export const TOKEN_COLORS = [
  "#C9A84C",
  "#5B3FA6",
  "#E07B39",
  "#1B6B3A",
  "#8B1A1A",
  "#1A3A8B",
  "#5A5A5A",
  "#8B5A2B",
];

export const CREATOR_STEPS = [
  { num: 1, label: "Identity" },
  { num: 2, label: "Stats" },
  { num: 3, label: "Story" },
  { num: 4, label: "Notes & Avatar" },
  { num: 5, label: "Review" },
] as const;

export type AbilityMethod = "roll" | "standard";

export interface CharacterFormState {
  name: string;
  race: string;
  subrace: string;
  class: string;
  subclass: string;
  background: string;
  level: number;
  alignment: string;
  stats: Record<StatKey, number>;
  abilityMethod: AbilityMethod;
  standardAssignments: Record<StatKey, number | "">;
  personality: string;
  backstory: string;
  ideals: string;
  bonds: string;
  flaws: string;
  appearance: string;
  notes: string;
  avatarUrl: string;
  tokenColor: string;
  extraItems: string;
}

export function defaultCharacterForm(): CharacterFormState {
  return {
    name: "",
    race: "Human",
    subrace: "",
    class: "Fighter",
    subclass: "",
    background: "Soldier",
    level: 1,
    alignment: "True Neutral",
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    abilityMethod: "standard",
    standardAssignments: { str: "", dex: "", con: "", int: "", wis: "", cha: "" },
    personality: "",
    backstory: "",
    ideals: "",
    bonds: "",
    flaws: "",
    appearance: "",
    notes: "",
    avatarUrl: "",
    tokenColor: "#C9A84C",
    extraItems: "",
  };
}

export function computeFinalStats(
  form: Pick<CharacterFormState, "abilityMethod" | "standardAssignments" | "stats">,
  selectedRace: (typeof RACES)[0],
): Record<StatKey, number> {
  if (form.abilityMethod === "standard") {
    const base: Record<StatKey, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    for (const k of STAT_KEYS) {
      const v = form.standardAssignments[k];
      if (v !== "") base[k] = v as number;
    }
    const bonus = selectedRace.bonus;
    for (const k of STAT_KEYS) {
      base[k] = (base[k] || 10) + (bonus[k] || 0);
    }
    return base;
  }
  const bonus = selectedRace.bonus;
  const result = { ...form.stats };
  for (const k of STAT_KEYS) {
    result[k] = (result[k] || 10) + (bonus[k] || 0);
  }
  return result;
}

/** First two class skills not already granted by background (for sheetData). */
export function pickAutoClassSkills(className: string, bgSkillNames: string[]): string[] {
  const cls = CLASSES.find((c) => c.name === className);
  if (!cls) return [];
  const pool = cls.skills.filter((s) => s !== "Any (3 skills)" && !bgSkillNames.includes(s));
  return pool.slice(0, 2);
}
