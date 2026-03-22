import React, { useMemo, useState } from 'react';
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
  type CampaignWithRole,
  type PendingInvite,
} from '@workspace/api-client-react';
import { VttButton } from '@/components/VttButton';
import { VttInput } from '@/components/VttInput';
import { Book, Plus, Users, Swords, LogOut, Mail, UserPlus } from 'lucide-react';

/** Where to send the user when opening a campaign card (onboarding vs table). */
function campaignCardDestination(c: CampaignWithRole): string {
  if (c.role === 'dm') {
    return `/session/${c.id}/latest`;
  }
  if (c.playerMembershipCharacterId) {
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

  const [inviteModal, setInviteModal] = useState<PendingInvite | null>(null);
  const [inviteUseExistingId, setInviteUseExistingId] = useState<string>('');

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
  const createMutation = useCreateCampaign();

  const [isCreating, setIsCreating] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');

  const [isJoining, setIsJoining] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCharacterId, setJoinCharacterId] = useState('');

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
      <div className="min-h-screen flex items-center justify-center bg-background text-primary font-display text-2xl animate-pulse">
        Loading Chronicles...
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
          <h1 className="text-3xl font-display text-primary gold-text-glow">TavernOS</h1>
        </div>
        <div className="flex items-center gap-4">
          <VttButton variant="outline" size="sm" onClick={() => setLocation('/create-character')}>
            <UserPlus className="w-4 h-4 mr-2" />
            New hero
          </VttButton>
          <span className="font-label text-muted-foreground">
            Hail, <strong className="text-foreground">{user?.username}</strong>
          </span>
          <VttButton variant="ghost" size="sm" onClick={() => setLocation('/')}>
            <LogOut className="w-4 h-4 mr-2" /> Leave
          </VttButton>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        <div className="flex justify-between items-end mb-8 border-b border-border/50 pb-4">
          <div>
            <h2 className="text-4xl font-display mb-2">Your Chronicles</h2>
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
              <h3 className="text-2xl font-display text-primary mb-4">Forge a New Chronicle</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-sm font-label mb-1 block">Campaign Name</label>
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
              <h3 className="text-2xl font-display text-primary mb-4">Join an Adventure</h3>
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="text-sm font-label mb-1 block">Invite Code</label>
                  <VttInput
                    autoFocus
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-label mb-1 block">
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

        {inviteModal && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="glass-panel p-6 rounded-lg max-w-md w-full">
              <h3 className="text-2xl font-display text-primary mb-2">Accept invitation</h3>
              <p className="text-sm text-muted-foreground font-sans mb-4">
                Join <strong className="text-foreground">{inviteModal.campaignName}</strong> as
                invited by {inviteModal.invitedByUsername}.
              </p>
              <div className="space-y-3">
                <label className="text-sm font-label block">How do you want to join?</label>
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

        {pendingInvites.length > 0 && (
          <section className="mb-10" aria-label="Pending campaign invitations">
            <h3 className="text-2xl font-display mb-4 flex items-center gap-2">
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
                    <p className="text-lg font-display text-primary">{inv.campaignName}</p>
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
            <h3 className="text-xl font-display text-muted-foreground">No campaigns found</h3>
            <p className="font-sans mt-2 opacity-70">
              Create a new campaign or join an existing one to begin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns?.map((c) => (
              <div
                key={c.id}
                className="group glass-panel rounded-xl overflow-hidden hover:border-primary/80 transition-all cursor-pointer hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(201,168,76,0.15)] flex flex-col"
                onClick={() => setLocation(campaignCardDestination(c))}
              >
                <div className="h-32 bg-card border-b border-border/50 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent mix-blend-overlay" />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-2xl font-display text-primary truncate pr-2">{c.name}</h3>
                    <span
                      className={`text-[10px] font-bold font-label uppercase px-2 py-1 rounded border ${
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

                  <div className="mt-auto pt-4 border-t border-border/30 flex justify-between items-center">
                    <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-1 rounded">
                      Code: {c.inviteCode}
                    </span>
                    <span className="text-sm font-label font-bold group-hover:text-primary transition-colors flex items-center">
                      Enter{' '}
                      <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0">
                        →
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
