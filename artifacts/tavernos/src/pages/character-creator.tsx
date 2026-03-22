import React, { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useGetCampaign, useCreatePlayerCharacter, useListPlayerCharacters } from "@workspace/api-client-react";
import { DiceRoll } from "rpg-dice-roller";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Dices, Check, Save } from "lucide-react";
import { VttButton } from "@/components/VttButton";
import { VttInput } from "@/components/VttInput";
import {
  RACES,
  CLASSES,
  BACKGROUNDS,
  STANDARD_ARRAY,
  STAT_KEYS,
  STAT_NAMES,
  EQUIPMENT_PACKS,
  CLASS_EQUIPMENT,
  CREATOR_STEPS,
  TOKEN_COLORS,
  ALIGNMENTS,
  mod,
  fmtMod,
  skillNameToKey,
  computeFinalStats,
  pickAutoClassSkills,
  defaultCharacterForm,
  type CharacterFormState,
  type StatKey,
} from "./character-creator-data";

function draftKey(campaignId: string | undefined) {
  return `viceos_character_draft_v1_${campaignId ?? "pool"}`;
}

function legacyDraftKey(campaignId: string | undefined) {
  return `tavernos_character_draft_v1_${campaignId ?? "pool"}`;
}

export default function CharacterCreator() {
  const params = useParams<{ campaignId?: string }>();
  const campaignId = params.campaignId;
  const [, setLocation] = useLocation();
  const { data: campaign, isLoading } = useGetCampaign(campaignId ?? "");
  const { data: myCharacters = [] } = useListPlayerCharacters();
  const createMutation = useCreatePlayerCharacter();

  /** Already have a hero for this campaign — skip creator (e.g. returning player or bookmarked URL). */
  useEffect(() => {
    if (!campaignId || !campaign || campaign.role === "dm") return;
    const roster = myCharacters
      .filter((ch) => ch.campaignId === campaignId && ch.isActive !== false)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const first = roster[0];
    if (first) {
      setLocation(`/session/${campaignId}/latest`);
    }
  }, [campaignId, campaign, myCharacters, setLocation]);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CharacterFormState>(() => defaultCharacterForm());

  useEffect(() => {
    try {
      const key = draftKey(campaignId);
      const raw =
        localStorage.getItem(key) ?? localStorage.getItem(legacyDraftKey(campaignId));
      if (raw) {
        const parsed = JSON.parse(raw) as CharacterFormState;
        setForm({ ...defaultCharacterForm(), ...parsed });
        try {
          localStorage.setItem(key, raw);
          localStorage.removeItem(legacyDraftKey(campaignId));
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }, [campaignId]);

  const saveDraft = () => {
    try {
      localStorage.setItem(draftKey(campaignId), JSON.stringify(form));
    } catch {
      /* ignore */
    }
  };

  const selectedRace = RACES.find((r) => r.name === form.race) || RACES[0];
  const selectedClass = CLASSES.find((c) => c.name === form.class) || CLASSES[0];
  const selectedBackground = BACKGROUNDS.find((b) => b.name === form.background) || BACKGROUNDS[0];

  const finalStats = (): Record<StatKey, number> =>
    computeFinalStats(form, selectedRace);

  const rollStats = () => {
    const next = { ...form.stats };
    for (const k of STAT_KEYS) {
      const roll = new DiceRoll("4d6d1");
      next[k] = roll.total;
    }
    setForm((f) => ({ ...f, stats: next, abilityMethod: "roll" }));
  };

  const computeHp = (stats: Record<StatKey, number>) => {
    const conMod = mod(stats.con);
    return Math.max(1, selectedClass.hitDie + conMod);
  };

  const computeAc = (stats: Record<StatKey, number>) => 10 + mod(stats.dex);

  const handleAvatar = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) {
      setForm((f) => ({ ...f, avatarUrl: "" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";
      setForm((f) => ({ ...f, avatarUrl: url }));
    };
    reader.readAsDataURL(file);
  };

  const handleComplete = () => {
    if (!form.name.trim()) return;

    const stats = finalStats();
    const hp = computeHp(stats);
    const ac = computeAc(stats);
    const bgSkills = selectedBackground.skills.map(skillNameToKey);
    const extraClass = pickAutoClassSkills(form.class, selectedBackground.skills);
    const allSkillProfs = [...new Set([...bgSkills, ...extraClass.map(skillNameToKey)])];
    const savingThrowProfs = selectedClass.savingThrows;

    const features: Array<{ name: string; source: string; desc: string }> = [
      ...selectedClass.features.map((feat) => ({ name: feat, source: form.class, desc: "" })),
      { name: selectedBackground.feature, source: form.background, desc: "" },
      ...selectedRace.traits.map((t) => ({ name: t, source: form.race, desc: "" })),
    ];

    const classEquip = CLASS_EQUIPMENT[selectedClass.name] || { weapons: [], armor: [], packs: [] };
    const selectedWeapon = classEquip.weapons[0] || "";
    const selectedArmor = classEquip.armor[0] || "";
    const selectedPack = classEquip.packs[0] || "";
    const packItems = selectedPack ? EQUIPMENT_PACKS[selectedPack] || [] : [];
    const inventoryItems = [
      ...(selectedWeapon ? [{ name: selectedWeapon, type: "weapon", qty: 1 }] : []),
      ...(selectedArmor ? [{ name: selectedArmor, type: "armor", qty: 1 }] : []),
      ...(selectedPack ? [{ name: selectedPack, type: "pack", qty: 1 }] : []),
      ...packItems.map((item) => ({ name: item, type: "item", qty: 1 })),
      ...form.extraItems
        .split("\n")
        .filter(Boolean)
        .map((item) => ({ name: item.trim(), type: "item", qty: 1 })),
    ];

    createMutation.mutate(
      {
        data: {
          name: form.name.trim(),
          campaignId: campaignId || undefined,
          race: form.race,
          subrace: form.subrace || undefined,
          class: form.class,
          subclass: form.subclass || undefined,
          background: form.background,
          level: form.level,
          alignment: form.alignment,
          strength: stats.str,
          dexterity: stats.dex,
          constitution: stats.con,
          intelligence: stats.int,
          wisdom: stats.wis,
          charisma: stats.cha,
          hit_points: hp,
          armor_class: ac,
          speed: selectedRace.speed,
          personality: form.personality || undefined,
          backstory: form.backstory || undefined,
          ideals: form.ideals || undefined,
          bonds: form.bonds || undefined,
          flaws: form.flaws || undefined,
          appearance: form.appearance || undefined,
          notes: form.notes || undefined,
          avatar_url: form.avatarUrl || undefined,
          stats,
          game_system: "D&D 5e",
          tokenColor: form.tokenColor,
          sheetData: {
            saveProficiencies: savingThrowProfs,
            skillProficiencies: allSkillProfs,
            skillExpertise: [],
            spellSlots: {},
            spells: [],
            inventory: inventoryItems,
            features,
            alignment: form.alignment,
            personalityTrait: form.personality,
            subclass: form.subclass,
          },
        },
      },
      {
        onSuccess: () => {
          try {
            localStorage.removeItem(draftKey(campaignId));
          } catch {
            /* ignore */
          }
          if (campaignId) {
            setLocation(`/session/${campaignId}/latest`);
          } else {
            setLocation("/dashboard");
          }
        },
      },
    );
  };

  const canProceed = (() => {
    if (step === 1) return !!(form.race && form.class && form.background);
    if (step === 2) {
      if (form.abilityMethod === "standard") {
        return STAT_KEYS.every((k) => form.standardAssignments[k] !== "");
      }
      return true;
    }
    if (step === 3 || step === 4) return true;
    if (step === 5) return !!form.name.trim();
    return true;
  })();

  if (campaignId && isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-primary font-sans text-xl animate-pulse">Consulting the archives...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="z-10 w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-sans text-primary gold-text-glow mb-1">Forge Your Legend</h1>
          <p className="text-muted-foreground font-sans tracking-widest text-sm">
            {campaign ? campaign.name : "New character sheet"}
          </p>
        </div>

        <div className="flex items-center justify-between mb-8 px-2 relative">
          <div className="absolute top-4 left-4 right-4 h-px bg-border" />
          {CREATOR_STEPS.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => s.num < step && setStep(s.num)}
              className="relative flex flex-col items-center bg-background px-1"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-sm transition-all ${
                  step > s.num
                    ? "bg-primary border-primary text-card"
                    : step === s.num
                      ? "bg-primary/20 border-primary text-primary scale-110"
                      : "bg-card border-border text-muted-foreground"
                }`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span
                className={`text-[10px] font-sans mt-1.5 uppercase font-bold whitespace-nowrap ${step >= s.num ? "text-primary" : "text-muted-foreground/50"}`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>

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
              {step === 1 && (
                <div className="flex flex-col flex-1 p-6 gap-4 overflow-y-auto">
                  <h2 className="font-sans text-2xl text-primary">Identity</h2>
                  <p className="text-xs text-muted-foreground font-sans">
                    Name is required before you finish — you can save a draft anytime.
                  </p>
                  <div>
                    <label className="text-xs font-sans font-bold text-primary uppercase block mb-1">Character name</label>
                    <VttInput
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Who are you?"
                      className="text-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-sans font-bold text-primary uppercase block mb-1">Level</label>
                      <VttInput
                        type="number"
                        min={1}
                        max={20}
                        value={form.level}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, level: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-sans font-bold text-primary uppercase block mb-1">Alignment</label>
                      <select
                        value={form.alignment}
                        onChange={(e) => setForm((f) => ({ ...f, alignment: e.target.value }))}
                        className="w-full h-10 rounded-sm border border-border bg-input/50 px-3 text-sm text-foreground"
                      >
                        {ALIGNMENTS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-sans font-bold text-primary uppercase block mb-1">Subclass / path (optional)</label>
                    <VttInput
                      value={form.subclass}
                      onChange={(e) => setForm((f) => ({ ...f, subclass: e.target.value }))}
                      placeholder="Champion, Evocation, etc."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-sans font-bold text-primary uppercase block mb-2">Race</label>
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                      {RACES.map((race) => (
                        <button
                          key={race.name}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, race: race.name, subrace: "" }))}
                          className={`p-2 border-2 rounded text-left text-xs font-sans transition-all ${
                            form.race === race.name ? "border-primary bg-primary/10" : "border-border hover:bg-card/50"
                          }`}
                        >
                          {race.name}
                        </button>
                      ))}
                    </div>
                    {selectedRace.subrace && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedRace.subrace.map((sr) => (
                          <button
                            key={sr}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, subrace: sr }))}
                            className={`text-xs px-2 py-1 rounded border ${
                              form.subrace === sr ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"
                            }`}
                          >
                            {sr}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-sans font-bold text-primary uppercase block mb-2">Class</label>
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                      {CLASSES.map((cls) => (
                        <button
                          key={cls.name}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, class: cls.name }))}
                          className={`p-2 border-2 rounded text-left text-xs font-sans transition-all ${
                            form.class === cls.name ? "border-primary bg-primary/10" : "border-border hover:bg-card/50"
                          }`}
                        >
                          {cls.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-sans font-bold text-primary uppercase block mb-2">Background</label>
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                      {BACKGROUNDS.map((bg) => (
                        <button
                          key={bg.name}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, background: bg.name }))}
                          className={`p-2 border-2 rounded text-left text-xs font-sans transition-all ${
                            form.background === bg.name ? "border-primary bg-primary/10" : "border-border hover:bg-card/50"
                          }`}
                        >
                          {bg.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h2 className="font-sans text-2xl text-primary">Ability scores</h2>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          abilityMethod: "standard",
                          standardAssignments: { str: "", dex: "", con: "", int: "", wis: "", cha: "" },
                        }))
                      }
                      className={`text-xs font-sans px-3 py-1.5 rounded border ${
                        form.abilityMethod === "standard" ? "border-primary text-primary bg-primary/10" : "border-border"
                      }`}
                    >
                      Standard array
                    </button>
                    <button
                      type="button"
                      onClick={rollStats}
                      className={`flex items-center gap-1 text-xs font-sans px-3 py-1.5 rounded border ${
                        form.abilityMethod === "roll" ? "border-primary text-primary bg-primary/10" : "border-border"
                      }`}
                    >
                      <Dices className="w-3.5 h-3.5" /> Roll 4d6 (drop lowest)
                    </button>
                  </div>
                  {form.abilityMethod === "standard" && (
                    <p className="text-xs text-muted-foreground">
                      Assign each value once: <strong>{STANDARD_ARRAY.join(", ")}</strong>
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    {STAT_KEYS.map((k) => {
                      const raceBonus = selectedRace.bonus[k] || 0;
                      const rawVal =
                        form.abilityMethod === "standard"
                          ? form.standardAssignments[k] !== ""
                            ? (form.standardAssignments[k] as number)
                            : 0
                          : form.stats[k] || 10;
                      const finalVal = rawVal + raceBonus;
                      return (
                        <div key={k} className="flex flex-col items-center bg-card border border-border rounded p-3 gap-2">
                          <span className="text-[10px] font-sans font-bold text-primary uppercase">{STAT_NAMES[k]}</span>
                          {form.abilityMethod === "standard" ? (
                            <select
                              value={form.standardAssignments[k]}
                              onChange={(e) => {
                                const v = e.target.value === "" ? "" : parseInt(e.target.value, 10);
                                setForm((f) => ({
                                  ...f,
                                  standardAssignments: { ...f.standardAssignments, [k]: v },
                                }));
                              }}
                              className="w-full bg-background border border-border rounded px-2 py-1.5 text-center text-lg font-sans font-bold text-foreground"
                            >
                              <option value="">—</option>
                              {STANDARD_ARRAY.filter(
                                (val) =>
                                  val === form.standardAssignments[k] ||
                                  !Object.values(form.standardAssignments).includes(val),
                              ).map((val) => (
                                <option key={val} value={val}>
                                  {val}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              min={3}
                              max={20}
                              value={form.stats[k]}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  stats: { ...f.stats, [k]: parseInt(e.target.value, 10) || 10 },
                                }))
                              }
                              className="w-full bg-background border border-border rounded px-2 py-1.5 text-center text-lg font-sans font-bold text-foreground"
                            />
                          )}
                          {raceBonus !== 0 && (
                            <div className="text-[10px] text-primary font-sans">+{raceBonus} racial</div>
                          )}
                          <div className="text-xl font-bold font-sans text-primary">{fmtMod(mod(finalVal))}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-sm font-sans text-muted-foreground border-t border-border/30 pt-3">
                    <div>
                      HP (preview): <strong className="text-foreground">{computeHp(finalStats())}</strong>
                    </div>
                    <div>
                      AC (preview): <strong className="text-foreground">{computeAc(finalStats())}</strong> · Speed:{" "}
                      <strong className="text-foreground">{selectedRace.speed} ft</strong>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h2 className="font-sans text-2xl text-primary">Story</h2>
                  <p className="text-xs text-muted-foreground font-sans border border-primary/20 bg-primary/5 rounded px-3 py-2">
                    This is what Tavern AI will use to voice your character — be descriptive.
                  </p>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground">Personality</label>
                    <textarea
                      value={form.personality}
                      onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))}
                      placeholder="How does your character act? What do others notice first about them?"
                      rows={3}
                      maxLength={2000}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans"
                    />
                    <span className="text-[10px] text-muted-foreground">{form.personality.length} / 2000</span>
                  </div>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground">Backstory</label>
                    <textarea
                      value={form.backstory}
                      onChange={(e) => setForm((f) => ({ ...f, backstory: e.target.value }))}
                      placeholder="Where did they come from? What drives them?"
                      rows={4}
                      maxLength={8000}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans"
                    />
                    <span className="text-[10px] text-muted-foreground">{form.backstory.length} / 8000</span>
                  </div>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground">Ideals</label>
                    <textarea
                      value={form.ideals}
                      onChange={(e) => setForm((f) => ({ ...f, ideals: e.target.value }))}
                      rows={2}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground">Bonds</label>
                    <textarea
                      value={form.bonds}
                      onChange={(e) => setForm((f) => ({ ...f, bonds: e.target.value }))}
                      rows={2}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground">Flaws</label>
                    <textarea
                      value={form.flaws}
                      onChange={(e) => setForm((f) => ({ ...f, flaws: e.target.value }))}
                      rows={2}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground">Appearance</label>
                    <textarea
                      value={form.appearance}
                      onChange={(e) => setForm((f) => ({ ...f, appearance: e.target.value }))}
                      rows={3}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans"
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h2 className="font-sans text-2xl text-primary">Notes &amp; portrait</h2>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground">Notes for DM / AI</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Anything else the DM or AI should know — secrets, goals, fears..."
                      rows={5}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground block mb-1">Portrait (optional)</label>
                    <VttInput type="file" accept="image/*" onChange={(e) => handleAvatar(e.target.files?.[0] ?? null)} />
                    {form.avatarUrl ? (
                      <img src={form.avatarUrl} alt="" className="mt-2 max-h-32 rounded border border-border object-cover" />
                    ) : null}
                  </div>
                  <div>
                    <label className="text-xs font-sans text-muted-foreground block mb-1">Token color</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {TOKEN_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, tokenColor: c }))}
                          className="w-8 h-8 rounded-full border-2"
                          style={{ backgroundColor: c, borderColor: form.tokenColor === c ? "#fff" : "transparent" }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                  <h2 className="font-sans text-2xl text-primary">Review</h2>
                  <div className="bg-card/50 border border-border/30 rounded p-4 space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      <strong className="text-foreground">{form.name.trim() || "(required)"}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Ancestry:</span>{" "}
                      <strong>
                        {form.subrace || form.race} {form.class}
                        {form.subclass ? ` (${form.subclass})` : ""}
                      </strong>{" "}
                      · Lv {form.level} · {form.alignment}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Background:</span> <strong>{form.background}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      HP {computeHp(finalStats())} · AC {computeAc(finalStats())} · Spd {selectedRace.speed} ft
                    </p>
                    {form.personality && (
                      <p className="text-xs line-clamp-3">
                        <span className="text-primary font-sans">Personality:</span> {form.personality}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="px-6 py-4 border-t border-border/30 flex justify-between items-center flex-wrap gap-2 flex-shrink-0">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 text-sm font-sans font-bold text-muted-foreground hover:text-foreground disabled:opacity-30 px-3 py-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-sans hidden sm:inline">Autosave: use Save draft</span>
              <VttButton type="button" variant="outline" size="sm" onClick={saveDraft} className="gap-1">
                <Save className="w-3.5 h-3.5" /> Save draft
              </VttButton>
            </div>
            {step < 5 ? (
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-1.5 px-5 py-2 bg-primary/20 border border-primary/50 text-primary rounded font-sans font-bold text-sm hover:bg-primary/30 disabled:opacity-30"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <VttButton
                type="button"
                disabled={!canProceed || createMutation.isPending}
                onClick={handleComplete}
                className="gap-1.5"
              >
                {createMutation.isPending ? "Saving…" : "Save character"}
                <ChevronRight className="w-4 h-4" />
              </VttButton>
            )}
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setLocation("/dashboard")}
            className="text-xs text-muted-foreground hover:text-foreground font-sans transition-colors"
          >
            Cancel & return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
