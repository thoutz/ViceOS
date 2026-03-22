import React, { useCallback, useMemo, useState } from 'react';
import { ThemeSlider } from '@/components/ThemeSlider';
import { useLocation } from 'wouter';
import {
  useGetMe,
  useListCampaigns,
  useCreateCampaign,
  useJoinCampaign,
  useListPendingInvites,
  useAcceptCampaignInvite,
  useDeclineCampaignInvite,
  useListPlayerCharacters,
  useDeleteCampaign,
  type CampaignWithRole,
  type PendingInvite,
  type PlayerCharacter,
} from '@workspace/api-client-react';
import { VttButton } from '@/components/VttButton';
import { VttInput } from '@/components/VttInput';
import { toast } from '@/hooks/use-toast';
import {
  Book,
  Plus,
  Users,
  Swords,
  LogOut,
  Mail,
  UserPlus,
  Trash2,
  Copy,
  Share2,
  ScrollText,
} from 'lucide-react';

/**
 * Where to send the user when opening a campaign card (onboarding vs table).
 * Uses membership character id from the API; falls back to the first roster character for that campaign
 * (covers stale clients or edge cases).
 */
function campaignCardDestination(
  c: CampaignWithRole,
  rosterFallbackCharacterId?: string | null,
): string {
  if (c.role === 'dm') {
    return `/session/${c.id}/latest`;
  }
  if (c.playerMembershipCharacterId || rosterFallbackCharacterId) {
    return `/session/${c.id}/latest`;
  }
  return `/campaign/${c.id}/create-character`;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading, isError } = useGetMe();

  const { data: campaignList, refetch: refetchCampaigns } = useListCampaigns();
  const { data: pendingInvites = [], refetch: refetchPendingInvites } = useListPendingInvites();
  const { data: myCharacters = [] } = useListPlayerCharacters();

  const poolCharacters = useMemo(
    () => myCharacters.filter((ch) => ch.campaignId == null || ch.campaignId === ''),
    [myCharacters],
  );

  /** First character per campaign (oldest created) for card copy + ENTER fallback. */
  const rosterByCampaign = useMemo(() => {
    const sorted = [...myCharacters].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const m = new Map<string, PlayerCharacter>();
    for (const ch of sorted) {
      if (!ch.campaignId) continue;
      if (!m.has(ch.campaignId)) m.set(ch.campaignId, ch);
    }
    return m;
  }, [myCharacters]);

  const [inviteModal, setInviteModal] = useState<PendingInvite | null>(null);
  const [inviteUseExistingId, setInviteUseExistingId] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<CampaignWithRole | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deleteTypeConfirm, setDeleteTypeConfirm] = useState('');

  const acceptInviteMutation = useAcceptCampaignInvite({
    mutation: {
      onSuccess: async (data, variables) => {
        await refetchCampaigns();
        await refetchPendingInvites();
        setInviteModal(null);
        setInviteUseExistingId('');
        if (variables.data.characterId) {
          setLocation(`/session/${data.campaignId}/latest`);
        } else {
          setLocation(`/campaign/${data.campaignId}/create-character`);
        }
      },
    },
  });
  const declineInviteMutation = useDeclineCampaignInvite({
    mutation: {
      onSuccess: async () => {
        await refetchCampaigns();
        await refetchPendingInvites();
      },
    },
  });
  const campaigns = [...(campaignList?.as_dm ?? []), ...(campaignList?.as_player ?? [])];

  const campaignNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of campaigns) m.set(c.id, c.name);
    return m;
  }, [campaigns]);
  const createMutation = useCreateCampaign();
  const deleteCampaignMutation = useDeleteCampaign({
    mutation: {
      onSuccess: () => {
        setDeleteTarget(null);
        setDeleteStep(1);
        setDeleteTypeConfirm('');
        void refetchCampaigns();
      },
    },
  });

  const [isCreating, setIsCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

  const [isJoining, setIsJoining] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCharacterId, setJoinCharacterId] = useState('');

  const copyInviteCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: 'Copied', description: 'Invite code is on your clipboard.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Could not copy',
        description: 'Select the code and copy manually (Ctrl/Cmd+C).',
      });
    }
  }, []);

  const shareOrCopyInvite = useCallback(async (campaignName: string, code: string) => {
    const text = `Join my campaign "${campaignName}" on ViceOS. Invite code: ${code}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Invite: ${campaignName}`, text });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        try {
          await navigator.clipboard.writeText(text);
          toast({ title: 'Copied invite message', description: 'Paste into chat or email.' });
        } catch {
          toast({
            variant: 'destructive',
            title: 'Share failed',
            description: 'Use the copy button for the code only.',
          });
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied invite message', description: 'Paste into chat or email.' });
      } catch {
        toast({
          variant: 'destructive',
          title: 'Could not copy',
          description: 'Try the copy-code button.',
        });
      }
    }
  }, []);

  const joinMutation = useJoinCampaign({
    mutation: {
      onSuccess: async (data, variables) => {
        await refetchCampaigns();
        setIsJoining(false);
        setInviteCode('');
        setJoinCharacterId('');
        if (data.role === 'dm') {
          setLocation(`/session/${data.id}/latest`);
          return;
        }
        if (variables.data.characterId) {
          setLocation(`/session/${data.id}/latest`);
        } else {
          setLocation(`/campaign/${data.id}/create-character`);
        }
      },
    },
  });

  if (userLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-sans text-2xl animate-pulse">
        Loading…
      </div>
    );

  if (isError) {
    setTimeout(() => setLocation('/'), 0);
    return null;
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(
      { data: { name: newCampaignName } },
      {
        onSuccess: () => {
          setIsCreating(false);
          setNewCampaignName('');
          refetchCampaigns();
        },
      },
    );
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    joinMutation.mutate({
      data: {
        inviteCode,
        ...(joinCharacterId ? { characterId: joinCharacterId } : {}),
      },
    });
  };

  const openInviteModal = (inv: PendingInvite) => {
    setInviteModal(inv);
    setInviteUseExistingId('');
  };

  const confirmInviteAccept = () => {
    if (!inviteModal) return;
    acceptInviteMutation.mutate({
      inviteId: inviteModal.id,
      data: inviteUseExistingId ? { characterId: inviteUseExistingId } : {},
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card border-b border-border py-4 px-8 flex justify-between items-center sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Book className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-sans text-primary gold-text-glow">ViceOS</h1>
        </div>
        <div className="flex items-center gap-4">
          <VttButton variant="outline" size="sm" onClick={() => setLocation('/create-character')}>
            <UserPlus className="w-4 h-4 mr-2" />
            New hero
          </VttButton>
          <span className="font-sans text-muted-foreground">
            Hail, <strong className="text-foreground">{user?.username}</strong>
          </span>
          <ThemeSlider />
          <VttButton variant="ghost" size="sm" onClick={() => setLocation('/')}>
            <LogOut className="w-4 h-4 mr-2" /> Leave
          </VttButton>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between items-end mb-8 border-b border-border/50 pb-4">
          <div>
            <h2 className="text-4xl font-sans mb-2">Your Chronicles</h2>
            <p className="text-muted-foreground font-sans text-lg">
              Select a campaign to continue your adventure.
            </p>
          </div>
          <div className="flex gap-3">
            <VttButton
              variant="outline"
              onClick={() => {
                setJoinCharacterId('');
                setIsJoining(true);
              }}
            >
              <Users className="w-4 h-4 mr-2" /> Join Campaign
            </VttButton>
            <VttButton onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Campaign
            </VttButton>
          </div>
        </div>

        {isCreating && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="glass-panel p-6 rounded-lg max-w-md w-full">
              <h3 className="text-2xl font-sans text-primary mb-4">Forge a New Chronicle</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-sm font-sans mb-1 block">Campaign Name</label>
                  <VttInput
                    autoFocus
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <VttButton type="button" variant="ghost" onClick={() => setIsCreating(false)}>
                    Cancel
                  </VttButton>
                  <VttButton type="submit" disabled={createMutation.isPending || !newCampaignName}>
                    Create
                  </VttButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {isJoining && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="glass-panel p-6 rounded-lg max-w-md w-full">
              <h3 className="text-2xl font-sans text-primary mb-4">Join an Adventure</h3>
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="text-sm font-sans mb-1 block">Invite Code</label>
                  <VttInput
                    autoFocus
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-sans mb-1 block">
                    Bring a hero (optional)
                  </label>
                  <p className="text-xs text-muted-foreground font-sans mb-2">
                    Choose a character from your roster that is not already tied to another campaign.
                    Leave empty to create a new hero after joining.
                  </p>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-sans text-foreground"
                    value={joinCharacterId}
                    onChange={(e) => setJoinCharacterId(e.target.value)}
                  >
                    <option value="">— Create a new hero after joining —</option>
                    {poolCharacters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.name}
                        {ch.class ? ` (${ch.class} ${ch.level})` : ` (Lv ${ch.level})`}
                      </option>
                    ))}
                  </select>
                </div>
                {joinMutation.isError && (
                  <p className="text-sm text-destructive font-sans" role="alert">
                    {joinMutation.error instanceof Error
                      ? joinMutation.error.message
                      : 'Could not join campaign.'}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <VttButton type="button" variant="ghost" onClick={() => setIsJoining(false)}>
                    Cancel
                  </VttButton>
                  <VttButton type="submit" disabled={joinMutation.isPending || !inviteCode}>
                    Join
                  </VttButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteTarget && deleteTarget.role === 'dm' && (
          <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="glass-panel p-6 rounded-lg max-w-md w-full border border-destructive/30">
              <h3 className="text-2xl font-sans text-destructive mb-2">Delete campaign</h3>
              {deleteStep === 1 ? (
                <>
                  <p className="text-sm text-muted-foreground font-sans mb-4">
                    Permanently delete <strong className="text-foreground">{deleteTarget.name}</strong>?
                    All sessions, maps, and character data for this campaign will be removed. This
                    cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <VttButton
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setDeleteTarget(null);
                        setDeleteStep(1);
                        setDeleteTypeConfirm('');
                      }}
                    >
                      Cancel
                    </VttButton>
                    <VttButton
                      type="button"
                      variant="outline"
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setDeleteStep(2);
                        setDeleteTypeConfirm('');
                      }}
                    >
                      Continue
                    </VttButton>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground font-sans mb-3">
                    Type <strong className="text-foreground font-mono">DELETE</strong> to confirm.
                  </p>
                  <VttInput
                    autoFocus
                    value={deleteTypeConfirm}
                    onChange={(e) => setDeleteTypeConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono tracking-wide"
                    autoComplete="off"
                    aria-label="Type DELETE to confirm"
                  />
                  {deleteCampaignMutation.isError && (
                    <p className="text-xs text-destructive font-sans mt-2">
                      Could not delete this campaign. You must be the DM.
                    </p>
                  )}
                  <div className="flex justify-end gap-2 pt-4">
                    <VttButton
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setDeleteStep(1);
                        setDeleteTypeConfirm('');
                      }}
                    >
                      Back
                    </VttButton>
                    <VttButton
                      type="button"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/15"
                      disabled={
                        deleteTypeConfirm !== 'DELETE' ||
                        deleteCampaignMutation.isPending
                      }
                      onClick={() => {
                        if (deleteTypeConfirm !== 'DELETE') return;
                        deleteCampaignMutation.mutate({ campaignId: deleteTarget.id });
                      }}
                    >
                      {deleteCampaignMutation.isPending ? 'Deleting…' : 'Delete forever'}
                    </VttButton>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {inviteModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="glass-panel p-6 rounded-lg max-w-md w-full">
              <h3 className="text-2xl font-sans text-primary mb-2">Accept invitation</h3>
              <p className="text-sm text-muted-foreground font-sans mb-4">
                Join <strong className="text-foreground">{inviteModal.campaignName}</strong> as
                invited by {inviteModal.invitedByUsername}.
              </p>
              <div className="space-y-3">
                <label className="text-sm font-sans block">How do you want to join?</label>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-sans text-foreground"
                  value={inviteUseExistingId}
                  onChange={(e) => setInviteUseExistingId(e.target.value)}
                >
                  <option value="">Create a new hero (recommended)</option>
                  {poolCharacters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      Use existing: {ch.name}
                      {ch.class ? ` — ${ch.class}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground font-sans">
                  If you pick an existing hero, you will go straight to the game table. Otherwise you
                  will open the character creator for this campaign.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-6">
                <VttButton
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setInviteModal(null);
                    setInviteUseExistingId('');
                  }}
                >
                  Cancel
                </VttButton>
                <VttButton
                  type="button"
                  disabled={acceptInviteMutation.isPending}
                  onClick={confirmInviteAccept}
                >
                  Confirm
                </VttButton>
              </div>
            </div>
          </div>
        )}

        {myCharacters.some((ch) => !ch.isNpc) && (
          <section className="mb-10" aria-label="Your heroes">
            <h3 className="text-2xl font-sans mb-4 flex items-center gap-2">
              <ScrollText className="w-6 h-6 text-primary" />
              Your heroes
            </h3>
            <p className="text-sm text-muted-foreground font-sans mb-4 max-w-2xl">
              Open a full character sheet to edit stats, biography, portrait, and an optional backdrop (studio page
              only). You can also edit your sheet while in a live session from the right-hand Sheet panel.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCharacters
                .filter((ch) => !ch.isNpc)
                .map((ch) => (
                  <div
                    key={ch.id}
                    className="glass-panel rounded-xl p-4 flex gap-4 items-center border border-border/40"
                  >
                    <div className="w-16 h-16 rounded-lg bg-card border border-border overflow-hidden shrink-0 flex items-center justify-center">
                      {ch.avatarUrl ? (
                        <img src={ch.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-8 h-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans font-bold text-primary truncate">{ch.name}</p>
                      <p className="text-xs text-muted-foreground font-sans truncate">
                        {ch.campaignId
                          ? campaignNameById.get(ch.campaignId) || 'Campaign'
                          : 'Roster — not in a campaign yet'}
                        {ch.class ? ` · ${ch.class}` : ''}
                        {ch.level != null ? ` · Lv ${ch.level}` : ''}
                      </p>
                      <VttButton
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => setLocation(`/hero/${ch.id}`)}
                      >
                        Open sheet
                      </VttButton>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {pendingInvites.length > 0 && (
          <section className="mb-10" aria-label="Pending campaign invitations">
            <h3 className="text-2xl font-sans mb-4 flex items-center gap-2">
              <Mail className="w-6 h-6 text-primary" />
              Invitations
            </h3>
            <ul className="space-y-3">
              {pendingInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="glass-panel rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div>
                    <p className="text-lg font-sans text-primary">{inv.campaignName}</p>
                    <p className="text-sm text-muted-foreground font-sans">
                      From <span className="text-foreground">{inv.invitedByUsername}</span>
                      {inv.expiresAt && <> · Expires {new Date(inv.expiresAt).toLocaleString()}</>}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <VttButton
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={declineInviteMutation.isPending}
                      onClick={() => declineInviteMutation.mutate({ inviteId: inv.id })}
                    >
                      Decline
                    </VttButton>
                    <VttButton
                      type="button"
                      size="sm"
                      disabled={acceptInviteMutation.isPending}
                      onClick={() => openInviteModal(inv)}
                    >
                      Accept
                    </VttButton>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {campaigns?.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border/50 rounded-xl bg-card/30">
            <Swords className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-sans text-muted-foreground">No campaigns found</h3>
            <p className="font-sans mt-2 opacity-70">
              Create a new campaign or join an existing one to begin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns?.map((c) => {
              const playerCh = c.role === 'player' ? rosterByCampaign.get(c.id) : undefined;
              const rosterCharId = playerCh?.id;
              return (
              <div
                key={c.id}
                className="group glass-panel rounded-xl overflow-hidden hover:border-primary/80 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-lg flex flex-col"
                onClick={() => setLocation(campaignCardDestination(c, rosterCharId))}
              >
                <div className="h-32 bg-card border-b border-border/50 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent mix-blend-overlay" />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-sans text-primary truncate pr-2">{c.name}</h3>
                    <span
                      className={`text-[10px] font-bold font-sans uppercase px-2 py-1 rounded border ${
                        c.role === 'dm'
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-magic/10 border-magic text-magic'
                      }`}
                    >
                      {c.role === 'dm' ? 'Dungeon Master' : 'Player'}
                    </span>
                  </div>
                  <p className="text-muted-foreground font-sans text-sm mb-4 line-clamp-2">
                    {c.description || 'No description provided.'}
                  </p>

                  <div className="mt-auto pt-4 border-t border-border/30 flex flex-col gap-3">
                    {c.role === 'dm' ? (
                      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-primary/85">
                          Player invite code
                        </p>
                        <div className="flex items-stretch gap-2">
                          <code
                            className="flex min-w-0 flex-1 items-center rounded-md border border-border bg-background/90 px-3 py-2 font-mono text-sm tracking-[0.2em] text-foreground select-all"
                            title="Select to copy"
                          >
                            {c.inviteCode}
                          </code>
                          <VttButton
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 px-3"
                            title="Copy invite code"
                            aria-label="Copy invite code"
                            onClick={() => void copyInviteCode(c.inviteCode)}
                          >
                            <Copy className="h-4 w-4" />
                          </VttButton>
                          <VttButton
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 px-3"
                            title="Share invite (or copy a full message)"
                            aria-label="Share invite"
                            onClick={() => void shareOrCopyInvite(c.name, c.inviteCode)}
                          >
                            <Share2 className="h-4 w-4" />
                          </VttButton>
                        </div>
                      </div>
                    ) : playerCh ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <p className="text-xs text-muted-foreground font-sans">
                          Playing as{' '}
                          <span className="text-foreground font-medium">{playerCh.name}</span>
                          {playerCh.class ? ` · ${playerCh.class}` : ''}
                          {playerCh.level != null ? ` · Lv ${playerCh.level}` : ''}
                        </p>
                        <VttButton
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/hero/${playerCh.id}`)}
                        >
                          Edit character sheet
                        </VttButton>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground font-sans">
                        You are a player in this party — create your hero to enter the table.
                      </p>
                    )}
                    <div className="flex justify-end items-center gap-2">
                      <div className="flex items-center gap-2 shrink-0">
                        {c.role === 'dm' && (
                          <button
                            type="button"
                            title="Delete campaign"
                            className="p-1.5 rounded hover:bg-destructive/15 text-destructive border border-transparent hover:border-destructive/40 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(c);
                              setDeleteStep(1);
                              setDeleteTypeConfirm('');
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <span className="text-sm font-sans font-bold group-hover:text-primary transition-colors flex items-center">
                          Enter{' '}
                          <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0">
                            →
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
