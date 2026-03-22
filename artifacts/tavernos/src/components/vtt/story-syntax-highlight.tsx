import React, { useMemo } from 'react';
import type { Character, InitiativeCombatant } from '@workspace/api-client-react';

/** Semantic spans for “code-like” story coloring */
export type StorySpanKind =
  | 'plain'
  | 'pc'
  | 'friendlyNpc'
  | 'combatant'
  | 'creature'
  | 'gold'
  | 'magicItem'
  | 'weapon'
  | 'armor'
  | 'clothing'
  | 'shop';

export interface StoryHighlightContext {
  pcNames: string[];
  friendlyNpcNames: string[];
  combatantNames: string[];
}

function uniqueSortedByLength(names: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

type NameRow = { name: string; kind: 'pc' | 'friendlyNpc' | 'combatant' };

/**
 * PCs: campaign heroes. Friendly NPCs: roster NPCs not currently on initiative.
 * Combatants: NPCs on the initiative tracker (typical enemies / scene combat).
 */
export function buildStoryHighlightContext(
  characters: Character[],
  initiativeOrder: InitiativeCombatant[] | undefined | null,
): StoryHighlightContext {
  const pcNames = new Set<string>();
  const npcRoster = new Set<string>();
  const combatant = new Set<string>();

  for (const c of characters) {
    const n = c.name?.trim();
    if (!n) continue;
    if (c.isNpc) npcRoster.add(n);
    else pcNames.add(n);
  }

  for (const comb of initiativeOrder ?? []) {
    const n = comb.name?.trim();
    if (!n) continue;
    if (comb.isNpc === true) combatant.add(n);
  }

  const friendly = new Set<string>();
  for (const n of npcRoster) {
    if (!combatant.has(n)) friendly.add(n);
  }

  return {
    pcNames: uniqueSortedByLength(pcNames),
    friendlyNpcNames: uniqueSortedByLength(friendly),
    combatantNames: uniqueSortedByLength(combatant),
  };
}

function flattenNameRows(ctx: StoryHighlightContext): NameRow[] {
  const rows: NameRow[] = [];
  for (const name of ctx.pcNames) rows.push({ name, kind: 'pc' });
  for (const name of ctx.friendlyNpcNames) rows.push({ name, kind: 'friendlyNpc' });
  for (const name of ctx.combatantNames) rows.push({ name, kind: 'combatant' });
  rows.sort((a, b) => b.name.length - a.name.length);
  return rows;
}

function isWordBoundaryOk(text: string, start: number, len: number): boolean {
  const before = start > 0 ? text[start - 1] : ' ';
  const after = start + len < text.length ? text[start + len] : ' ';
  const isWord = (c: string) => /[0-9A-Za-z_]/.test(c);
  if (isWord(before)) return false;
  if (isWord(after)) return false;
  return true;
}

function matchNameAt(text: string, pos: number, name: string): boolean {
  if (pos + name.length > text.length) return false;
  const slice = text.slice(pos, pos + name.length);
  if (slice.toLowerCase() !== name.toLowerCase()) return false;
  return isWordBoundaryOk(text, pos, name.length);
}

function findNameAt(text: string, pos: number, rows: NameRow[]): NameRow | null {
  for (const row of rows) {
    if (matchNameAt(text, pos, row.name)) return row;
  }
  return null;
}

/** Common hostile / neutral creatures when not already matched as a named character */
const CREATURE_RE =
  /\b(goblins?|hobgoblins?|bugbears?|orcs?|half-?orcs?|kobolds?|lizardfolk|dragonborn|dragons?|wyverns?|griffons?|hippogriffs?|zombies?|skeletons?|ghouls?|ghasts?|wights?|specters?|ghosts?|wraiths?|vampires?|liches?|beholders?|mind flayers?|illithids?|giants?|trolls?|ogres?|ettins?|cyclops|demons?|devils?|fiends?|imps?|quasits?|succubi|incubi|elementals?|mephits?|mimics?|gelatinous cubes?|slimes?|oozes?|black puddings?|rust monsters?|roper|cloakers?|bulettes?|ankhegs?|gricks?|chimeras?|manticores?|hydras?|basilisks?|medusas?|harpy|harpies|centaurs?|satyrs?|dryads?|pixies?|sprites?|banshees?|will-o['’-]?wisps?|shamblers?|treants?|awakened trees?|awakened shrubs?|scouts?|guards?|bandits?|thugs?|cultists?|acolytes?|priests?|mages?|assassins?|knights?|veterans?|gladiators?|spies?|nobles?|commoners?)\b/i;

const GOLD_RE =
  /^(\d[\d,]*\s*(gp|sp|cp|pp|electrum|gold pieces?|silver pieces?|copper pieces?|platinum pieces?|gold|silver|copper|platinum))\b/i;

const MAGIC_PATTERNS: Array<{ kind: 'magicItem'; re: RegExp }> = [
  { kind: 'magicItem', re: /^(\+[12] [A-Za-z][A-Za-z\s\-]{1,42})\b/ },
  { kind: 'magicItem', re: /^((Potion|Elixir|Philter|Ointment|Oil) of [A-Za-z][A-Za-z\s']{2,40})\b/i },
  { kind: 'magicItem', re: /^((Wand|Ring|Scroll|Staff|Rod) of [A-Za-z][A-Za-z\s']{2,40})\b/i },
  { kind: 'magicItem', re: /^(Spell Scroll \([^)]{1,48}\))/i },
  { kind: 'magicItem', re: /^(Figurine of Wondrous Power[^.!?\n]{0,24})/i },
  { kind: 'magicItem', re: /^(Deck of Many Things)\b/i },
  { kind: 'magicItem', re: /^(Bag of Holding|Bag of Tricks|Portable Hole|Heward's Handy Haversack)\b/i },
  { kind: 'magicItem', re: /^(Ioun Stone[^.!?\n]{0,30})/i },
];

const ARMOR_PHRASES = [
  'studded leather armor',
  'studded leather',
  'leather armor',
  'hide armor',
  'chain shirt',
  'chain mail',
  'scale mail',
  'breastplate',
  'half plate',
  'half plate armor',
  'plate armor',
  'splint armor',
  'ring mail',
  'padded armor',
  'shield',
];

const ARMOR_RE = new RegExp(
  `^(${ARMOR_PHRASES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'i',
);

const WEAPON_RE =
  /^(longsword|shortsword|greatsword|rapier|scimitar|daggers?|clubs?|greatclubs?|maces?|morningstars?|warhammers?|battleaxe|battleaxes|greataxe|greataxes|halberds?|spears?|tridents?|whips?|pikes?|glaives?|lances?|mauls?|flails?|war picks?|sickles?|handaxes?|light hammers?|quarterstaff|quarterstaffs?|nets?|blowguns?|light crossbow|heavy crossbow|hand crossbow|crossbows?|longbow|shortbow|javelins?|slings?|dart|darts)\b/i;

const CLOTHING_RE =
  /\b(cloak|cloaks?|robe|robes?|boots?|hat|hats?|gloves?|tunic|tunics?|vest|vests?|sash|sashes|belt|belts?|cap|caps?|hood|hoods?|scarf|scarves|sandals?|doublet|doublets?|chemise|breeches?|stockings?|baldric|gauntlets?|bracers?|circlet|circlets?|brooch|brooches|amulet|amulets?|pendant|pendants?|torc|torcs?)\b/i;

const SHOP_RE =
  /\b(merchant|merchants?|shopkeeper|shopkeepers?|clerk|clerks?|vendor|vendors?|bartender|bartenders?|innkeeper|innkeepers?|blacksmith|blacksmiths?|armorers?|stablemaster|stable hand|shop|shops|tavern|taverns|inn|inns|market|markets|bazaar|bazaars|stall|stalls|wares|apothecary|apothecaries|general store)\b/i;

export interface StorySegment {
  kind: StorySpanKind;
  value: string;
}

function tryPatternAt(slice: string): { len: number; kind: StorySpanKind } | null {
  const gold = slice.match(GOLD_RE);
  if (gold) return { len: gold[0].length, kind: 'gold' };

  for (const { kind, re } of MAGIC_PATTERNS) {
    const m = slice.match(re);
    if (m?.[0]) return { len: m[0].length, kind };
  }

  const armor = slice.match(ARMOR_RE);
  if (armor) return { len: armor[0].length, kind: 'armor' };

  const weapon = slice.match(WEAPON_RE);
  if (weapon) return { len: weapon[0].length, kind: 'weapon' };

  const clothing = slice.match(CLOTHING_RE);
  if (clothing && clothing.index === 0) return { len: clothing[0].length, kind: 'clothing' };

  const shop = slice.match(SHOP_RE);
  if (shop && shop.index === 0) return { len: shop[0].length, kind: 'shop' };

  const creature = slice.match(CREATURE_RE);
  if (creature && creature.index === 0) return { len: creature[0].length, kind: 'creature' };

  return null;
}

export function parseStoryToSegments(text: string, ctx: StoryHighlightContext): StorySegment[] {
  const rows = flattenNameRows(ctx);
  const segments: StorySegment[] = [];
  let i = 0;
  while (i < text.length) {
    const nameHit = findNameAt(text, i, rows);
    if (nameHit) {
      segments.push({ kind: nameHit.kind, value: text.slice(i, i + nameHit.name.length) });
      i += nameHit.name.length;
      continue;
    }
    const pat = tryPatternAt(text.slice(i));
    if (pat) {
      segments.push({ kind: pat.kind, value: text.slice(i, i + pat.len) });
      i += pat.len;
      continue;
    }
    segments.push({ kind: 'plain', value: text[i] });
    i += 1;
  }
  return mergePlain(segments);
}

function mergePlain(segments: StorySegment[]): StorySegment[] {
  const out: StorySegment[] = [];
  for (const s of segments) {
    const last = out[out.length - 1];
    if (last && last.kind === 'plain' && s.kind === 'plain') {
      last.value += s.value;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

const KIND_CLASS: Record<StorySpanKind, string> = {
  plain: '',
  pc: 'text-sky-300 font-semibold [text-shadow:0_0_12px_rgba(56,189,248,0.35)]',
  friendlyNpc: 'text-emerald-400/95',
  combatant: 'text-rose-400 font-medium',
  creature: 'text-orange-400/85',
  gold: 'text-amber-400 font-mono text-[0.92em] tracking-tight',
  magicItem: 'text-violet-400 font-medium',
  weapon: 'text-orange-300/90',
  armor: 'text-slate-400',
  clothing: 'text-fuchsia-300/90',
  shop: 'text-amber-100/85 italic',
};

const DEFAULT_CTX: StoryHighlightContext = {
  pcNames: [],
  friendlyNpcNames: [],
  combatantNames: [],
};

function contextKey(ctx: StoryHighlightContext): string {
  return [ctx.pcNames.join('\u0001'), ctx.friendlyNpcNames.join('\u0001'), ctx.combatantNames.join('\u0001')].join(
    '\u0002',
  );
}

export function StoryRichText({
  text,
  context,
  className,
}: {
  text: string;
  context?: StoryHighlightContext | null;
  /** Applied to the wrapper; spans add semantic colors */
  className?: string;
}) {
  const ctx = context ?? DEFAULT_CTX;
  const ck = contextKey(ctx);
  const segments = useMemo(() => parseStoryToSegments(text, ctx), [text, ck]);
  return (
    <span className={className}>
      {segments.map((s, idx) =>
        s.kind === 'plain' ? (
          <span key={idx}>{s.value}</span>
        ) : (
          <span key={idx} className={KIND_CLASS[s.kind]}>
            {s.value}
          </span>
        ),
      )}
    </span>
  );
}
