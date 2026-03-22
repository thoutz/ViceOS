import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import {
  useGetMe,
  useGetPlayerCharacter,
  useUpdatePlayerCharacter,
  useGetCampaign,
  getGetPlayerCharacterQueryKey,
  getGetCampaignQueryKey,
  getListPlayerCharactersQueryKey,
  type Character,
  type UpdateCharacterRequest,
  type UpdatePlayerCharacterRequest,
} from '@workspace/api-client-react';
import { VttButton } from '@/components/VttButton';
import { VttInput } from '@/components/VttInput';
import { ThemeSlider } from '@/components/ThemeSlider';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Book, ImageIcon, Loader2, Save } from 'lucide-react';

const MAX_AVATAR_BYTES = 500 * 1024;
const MAX_BG_BYTES = 1_200 * 1024;

function readImageDataUrl(file: File, maxBytes: number): Promise<string> {
  if (file.size > maxBytes) {
    return Promise.reject(new Error(`Image must be under ${Math.round(maxBytes / 1024)} KB`));
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

/** Trims and maps empty to null so the API persists clears correctly. */
function trimUrlField(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

function draftFromCharacter(c: Character): UpdateCharacterRequest {
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
    avatarUrl: c.avatarUrl ?? '',
    sheetBackgroundUrl: c.sheetBackgroundUrl ?? '',
  };
}

export default function HeroStudio() {
  const { characterId = '' } = useParams<{ characterId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading, isError: userErr } = useGetMe();
  const { data: ch, isLoading, isError } = useGetPlayerCharacter(characterId, {
    query: {
      queryKey: getGetPlayerCharacterQueryKey(characterId),
      enabled: Boolean(characterId),
    },
  });
  const campaignIdForLookup = ch?.campaignId || '';
  const { data: campaign } = useGetCampaign(campaignIdForLookup, {
    query: {
      queryKey: getGetCampaignQueryKey(campaignIdForLookup),
      enabled: Boolean(ch?.campaignId),
    },
  });

  const [draft, setDraft] = useState<UpdateCharacterRequest | null>(null);
  const updateMutation = useUpdatePlayerCharacter();
  const syncedCharacterId = useRef<string | null>(null);

  useEffect(() => {
    syncedCharacterId.current = null;
  }, [characterId]);

  useEffect(() => {
    if (!ch) return;
    if (syncedCharacterId.current !== ch.id) {
      syncedCharacterId.current = ch.id;
      setDraft(draftFromCharacter(ch));
    }
  }, [ch]);

  const canEdit = Boolean(user?.id && ch?.userId === user.id);

  const setField = useCallback(<K extends keyof UpdateCharacterRequest>(key: K, value: UpdateCharacterRequest[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }, []);

  const setStat = useCallback((key: keyof NonNullable<UpdateCharacterRequest['stats']>, value: number) => {
    setDraft((d) => {
      if (!d?.stats) return d;
      const n = Number.isFinite(value) ? value : 10;
      return { ...d, stats: { ...d.stats, [key]: n } };
    });
  }, []);

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    try {
      const url = await readImageDataUrl(f, MAX_AVATAR_BYTES);
      setField('avatarUrl', url);
      toast({ title: 'Portrait updated', description: 'Save to keep it on your sheet.' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Portrait',
        description: err instanceof Error ? err.message : 'Could not use this image.',
      });
    }
  };

  const onPickBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !f.type.startsWith('image/')) return;
    try {
      const url = await readImageDataUrl(f, MAX_BG_BYTES);
      setField('sheetBackgroundUrl', url);
      toast({ title: 'Background updated', description: 'Save to apply on this page.' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Background',
        description: err instanceof Error ? err.message : 'Could not use this image.',
      });
    }
  };

  const handleSave = async () => {
    if (!characterId || !draft || !canEdit) return;
    const payload: UpdatePlayerCharacterRequest = {
      ...draft,
      avatarUrl: trimUrlField(draft.avatarUrl ?? null),
      sheetBackgroundUrl: trimUrlField(draft.sheetBackgroundUrl ?? null),
    };
    try {
      const saved = await updateMutation.mutateAsync({
        characterId,
        data: payload,
      });
      setDraft(draftFromCharacter(saved));
      queryClient.setQueryData(getGetPlayerCharacterQueryKey(characterId), saved);
      void queryClient.invalidateQueries({ queryKey: getListPlayerCharactersQueryKey() });
      toast({ title: 'Saved', description: 'Your hero is updated.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not save.';
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description:
          /column|sheet_background|avatar_url/i.test(msg) && /does not exist/i.test(msg)
            ? `${msg} — Run DB migrations (e.g. pnpm --filter @workspace/db run push) so portrait/backdrop columns exist.`
            : msg,
      });
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-sans">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (userErr) {
    setTimeout(() => setLocation('/'), 0);
    return null;
  }

  if (!characterId) {
    setTimeout(() => setLocation('/dashboard'), 0);
    return null;
  }

  if (isLoading || !draft) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-sans">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (isError || !ch) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8">
        <p className="font-sans text-muted-foreground mb-4">Could not load this character.</p>
        <VttButton onClick={() => setLocation('/dashboard')}>Back to dashboard</VttButton>
      </div>
    );
  }

  const d = draft;
  const stats = d.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

  const bgUrl = draft?.sheetBackgroundUrl?.trim();

  return (
    <div className="min-h-screen text-foreground flex flex-col relative">
      {bgUrl ? (
        <>
          <div
            className="fixed inset-0 -z-20 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgUrl})` }}
            aria-hidden
          />
          <div className="fixed inset-0 -z-10 bg-background/88 backdrop-blur-[1px]" aria-hidden />
        </>
      ) : null}
      <header className="border-b border-border/60 bg-background/90 backdrop-blur-sm py-3 px-6 flex flex-wrap items-center gap-3 sticky top-0 z-20">
        <VttButton type="button" variant="ghost" size="sm" onClick={() => setLocation('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
        </VttButton>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Book className="w-6 h-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-sans font-bold text-primary truncate">Hero studio</h1>
            <p className="text-xs text-muted-foreground font-sans truncate">
              {ch.name}
              {campaign?.name ? ` · ${campaign.name}` : ch.campaignId ? ' · Campaign' : ' · Roster'}
            </p>
          </div>
        </div>
        <ThemeSlider />
        {canEdit && (
          <VttButton type="button" size="sm" disabled={updateMutation.isPending} onClick={() => void handleSave()}>
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save
          </VttButton>
        )}
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-6 space-y-6 pb-24">
        {!canEdit && (
          <div className="rounded-lg border border-border/60 bg-card/90 p-4 text-sm font-sans text-muted-foreground">
            You can view this sheet, but only the player who owns it can edit it here.
          </div>
        )}

        {/* Portrait + imagery (studio-focused) */}
        <section className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-5 space-y-4 shadow-lg">
          <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-primary">Portrait & backdrop</h2>
          <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
            Portrait appears on your VTT sheet header. The backdrop is only used on this full-page studio (not on the
            table to save space). You can paste an image URL or upload a file.
          </p>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-32 h-32 rounded-xl border-2 border-border bg-background/80 overflow-hidden flex items-center justify-center">
                {d.avatarUrl ? (
                  <img src={d.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                )}
              </div>
              {canEdit && (
                <label className="text-xs font-sans text-primary cursor-pointer hover:underline">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void onPickAvatar(e)} />
                  Upload portrait
                </label>
              )}
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              <label className="text-[10px] font-sans font-bold uppercase text-muted-foreground">Portrait URL</label>
              <VttInput
                value={d.avatarUrl ?? ''}
                onChange={(e) => setField('avatarUrl', e.target.value)}
                disabled={!canEdit}
                placeholder="https://… or data:image/…"
                className="text-xs font-mono"
              />
              <label className="text-[10px] font-sans font-bold uppercase text-muted-foreground pt-2 block">
                Backdrop URL (this page only)
              </label>
              <VttInput
                value={d.sheetBackgroundUrl ?? ''}
                onChange={(e) => setField('sheetBackgroundUrl', e.target.value)}
                disabled={!canEdit}
                placeholder="https://… or upload below"
                className="text-xs font-mono"
              />
              {canEdit && (
                <label className="inline-flex items-center gap-2 text-xs font-sans text-primary cursor-pointer mt-1">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => void onPickBackground(e)} />
                  <span className="border-b border-dotted border-primary">Upload backdrop image</span>
                </label>
              )}
            </div>
          </div>
        </section>

        {/* Core */}
        <section className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-5 space-y-4 shadow-lg">
          <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-primary">Identity & combat</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <VttInput value={d.name ?? ''} onChange={(e) => setField('name', e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Level">
              <VttInput
                type="number"
                min={1}
                max={20}
                value={d.level ?? 1}
                onChange={(e) => setField('level', parseInt(e.target.value, 10) || 1)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Race">
              <VttInput value={d.race ?? ''} onChange={(e) => setField('race', e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Subrace">
              <VttInput
                value={d.subrace ?? ''}
                onChange={(e) => setField('subrace', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Class">
              <VttInput value={d.class ?? ''} onChange={(e) => setField('class', e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Subclass">
              <VttInput
                value={d.subclass ?? ''}
                onChange={(e) => setField('subclass', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Background">
              <VttInput
                value={d.background ?? ''}
                onChange={(e) => setField('background', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Alignment">
              <VttInput
                value={d.alignment ?? ''}
                onChange={(e) => setField('alignment', e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="HP">
              <VttInput
                type="number"
                value={d.hp ?? 0}
                onChange={(e) => setField('hp', parseInt(e.target.value, 10) || 0)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Max HP">
              <VttInput
                type="number"
                value={d.maxHp ?? 0}
                onChange={(e) => setField('maxHp', parseInt(e.target.value, 10) || 0)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="AC">
              <VttInput
                type="number"
                value={d.ac ?? 10}
                onChange={(e) => setField('ac', parseInt(e.target.value, 10) || 0)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Speed (ft)">
              <VttInput
                type="number"
                value={d.speed ?? 30}
                onChange={(e) => setField('speed', parseInt(e.target.value, 10) || 0)}
                disabled={!canEdit}
              />
            </Field>
          </div>
        </section>

        {/* Abilities */}
        <section className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-5 space-y-4 shadow-lg">
          <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-primary">Ability scores</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((k) => (
              <div key={k}>
                <label className="text-[9px] font-sans font-bold uppercase text-muted-foreground block mb-1">{k}</label>
                <VttInput
                  type="number"
                  value={stats[k]}
                  onChange={(e) => setStat(k, parseInt(e.target.value, 10) || 10)}
                  disabled={!canEdit}
                  className="text-center"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Bio */}
        <section className="rounded-xl border border-border/50 bg-card/95 backdrop-blur-sm p-5 space-y-4 shadow-lg">
          <h2 className="text-xs font-sans font-bold uppercase tracking-widest text-primary">Biography & notes</h2>
          {(
            [
              ['personality', 'Personality'],
              ['backstory', 'Backstory'],
              ['ideals', 'Ideals'],
              ['bonds', 'Bonds'],
              ['flaws', 'Flaws'],
              ['appearance', 'Appearance'],
              ['notes', 'Notes'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="text-[10px] font-sans font-bold uppercase text-muted-foreground block mb-1">
                {label}
              </label>
              <textarea
                value={(d[key] as string) ?? ''}
                onChange={(e) => setField(key, e.target.value)}
                disabled={!canEdit}
                rows={key === 'backstory' || key === 'notes' ? 5 : 3}
                className="w-full rounded-sm border border-border bg-input/50 px-3 py-2 text-sm text-foreground font-sans focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
              />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-sans font-bold uppercase text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}
