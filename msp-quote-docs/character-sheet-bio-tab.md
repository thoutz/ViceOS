# Character sheet — BIO tab (creator text)

## Goal

Players could not read narrative fields from the character creator (personality, backstory, ideals, bonds, flaws, appearance, notes) in the VTT right-hand **Sheet** panel.

## Implementation

**File:** `artifacts/tavernos/src/components/vtt/CharacterSheet.tsx`

- Extended sub-tab set: **CORE · BIO · SKILLS · SPELLS · INVENTORY** (`TabId` + `TAB_ORDER`).
- **BIO** tab renders sections only when text is non-empty:
  - **Alignment** — `character.alignment` or `sheetData.alignment`
  - **Personality & mannerisms** — `character.personality` or `sheetData.personalityTrait` (creator duplicate)
  - **Backstory**, **Ideals**, **Bonds**, **Flaws**, **Appearance**, **Notes** — from `Character` API fields
- Empty state explains that creator content will show here.
- Sub-tab row uses slightly smaller type on narrow screens (`text-[9px] sm:text-[10px]`, `tracking-wider`) so five tabs fit on mobile.

## Styling

Matches existing sheet parchment palette (`#7A6228`, `#5A1111`, `#F2E8CE`, `#1A1208`) and section cards consistent with Core/Inventory blocks.

## Verification

- `pnpm --filter @workspace/tavernos run typecheck`
- In session: Sheet → **BIO** → confirm text matches character creator submission.
