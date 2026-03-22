# Plan: Hard caps on ability scores (D&D 5e, level 1 creation)

**Overview:** Enforce official D&D 5e limits for level-1-style creation in the character creator: cap rolled base scores (4d6 drop lowest: 3–18), cap final scores after racial bonuses at 20 (PHB), and replace fragile number-spinner behavior with explicit clamping and optional +/- controls.

## Implementation checklist

- [ ] **constants-clamp** — Add PHB constants + clamp helpers; apply max-20 (and sensible mins) in `computeFinalStats` in `character-creator-data.ts`
- [ ] **roll-ui** — Clamp rolled base 3–18 on change; fix min/max; add +/- buttons with disabled bounds in `character-creator.tsx`
- [ ] **can-proceed** — Validate step 2 roll method: all bases in [3, 18] before advancing
- [ ] **api-optional** — Optional: reject create if any ability outside [1, 20] for level 1 in `player-characters` route
- [ ] **doc-msp** — Add `msp-quote-docs` note for ability cap behavior after implementation

## Rules (Player’s Handbook)

- **During creation**, each rolled score (before racial bonuses) uses **4d6, drop the lowest** — possible range **3–18** per ability.
- **Standard array** values **15, 14, 13, 12, 10, 8** are already the only options in the UI ([`artifacts/tavernos/src/pages/character-creator.tsx`](../artifacts/tavernos/src/pages/character-creator.tsx)); max **15** before racials, which matches the array method.
- **After applying racial bonuses**, a creature’s ability score **cannot exceed 20** unless a feature says otherwise (PHB: “A score can’t be higher than 20.”). This is the critical missing clamp today: e.g. base **18** + **+2** racial could become **20** (legal) but values could exceed 20 without a cap.

**Point buy** (27 points, scores **8–15** before racials) is *not* implemented in the app today (only *Standard array* and *Roll*). It can be a **follow-up** if you want full PHB parity for all three methods.

## Current gaps

| Area | Issue |
|------|--------|
| Roll path | `<input type="number" min={3} max={20}>` in character-creator — `max={20}` is wrong for **base** (should be **18** before racials); browsers may still allow bad values via typing/spinner. |
| `computeFinalStats` in character-creator-data | No **max 20** after racial bonuses. |
| `rollStats` in character-creator | Already uses `4d6d1` (correct); final clamp still applies after racials. |

## Implementation plan

### 1. Central constants and math ([`artifacts/tavernos/src/pages/character-creator-data.ts`](../artifacts/tavernos/src/pages/character-creator-data.ts))

- Add named constants, e.g. `ABILITY_SCORE_MIN = 1`, `ABILITY_SCORE_MAX = 20` (PHB absolute cap), `ABILITY_BASE_MIN_ROLLED = 3`, `ABILITY_BASE_MAX_ROLLED = 18` (4d6 drop lowest).
- Add small helpers: `clampAbilityScore(n)`, `clampRolledBase(n)`.
- Update **`computeFinalStats`** to:
  - For **standard** method: compute base from assignments + racial as today, then `Math.min(ABILITY_SCORE_MAX, score)` per stat (safety net).
  - For **roll** method: `Math.min(ABILITY_SCORE_MAX, (base + racial))` per stat.
- Document in a one-line comment that **20** is the PHB general maximum.

### 2. Roll method UI ([`artifacts/tavernos/src/pages/character-creator.tsx`](../artifacts/tavernos/src/pages/character-creator.tsx))

- On change of rolled base: parse integer, apply **`clampRolledBase`** before writing to `form.stats`.
- Set input attributes to **`min={3}` `max={18}`** (base only), **`step={1}`**.
- Replace or supplement the raw spinner with **explicit − / + buttons** that increment/decrement by 1 and **disable at 3 and 18** so users cannot “infinite crank” via repeated clicks.
- Optionally block invalid keys / paste (same clamp).

### 3. Step validation

- Tighten **`canProceed`** for step 2 when `abilityMethod === "roll"`: require every `form.stats[k]` in **[3, 18]** after any edit.

### 4. (Optional but recommended) API guard

- In [`artifacts/api-server/src/routes/player-characters.ts`](../artifacts/api-server/src/routes/player-characters.ts) (create path), after building merged stats for **level 1** characters, reject with **400** if any ability is **&lt; 1 or &gt; 20**. This prevents bypass via crafted requests.

### 5. Docs (after implementation)

- Short entry in `msp-quote-docs/` describing PHB caps and where they’re enforced.

## Out of scope (unless you want it next)

- **Point buy** with the official **27-point** cost table and **8–15** pre-racial caps (new UI + budget tracker).
- Changing **level** in the creator to unlock higher scores (would mix creation rules with advancement rules; not typical for this screen).

## Files to touch

- [`artifacts/tavernos/src/pages/character-creator-data.ts`](../artifacts/tavernos/src/pages/character-creator-data.ts) — constants, `computeFinalStats` clamping.
- [`artifacts/tavernos/src/pages/character-creator.tsx`](../artifacts/tavernos/src/pages/character-creator.tsx) — rolled stat input clamp, +/- buttons, `canProceed`.
- Optionally [`artifacts/api-server/src/routes/player-characters.ts`](../artifacts/api-server/src/routes/player-characters.ts) — validate ability range on create.
