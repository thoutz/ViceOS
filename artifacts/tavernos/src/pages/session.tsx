import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  useGetMe,
  useGetCampaign,
  useListSessions,
  useCreateSession,
  useListCharacters,
  useListMaps,
  useCreateMap,
  useListMessages,
  usePostMessage,
  useUpdateCharacter,
  useUpdateSession,
  useGetSessionAiContext,
  getGetSessionAiContextQueryKey,
  usePostDmStoryAssistant,
  useDeleteMessage,
  Character,
  GameSession,
  type Token,
} from '@workspace/api-client-react';
import { useVttSocket } from '@/hooks/use-socket';
import { MapCanvas } from '@/components/vtt/MapCanvas';
import { CharacterSheet } from '@/components/vtt/CharacterSheet';
import { InitiativeBar, type InitiativeCombatant } from '@/components/vtt/InitiativeBar';
import { ChatPanel } from '@/components/vtt/ChatPanel';
import { StoryMapOverlay } from '@/components/vtt/StoryMapOverlay';
import { RollsPanel } from '@/components/vtt/RollsPanel';
import { DiceRoll } from 'rpg-dice-roller';
import { LogOut, X, Wifi, WifiOff, Dices, StickyNote, Shield, Swords, MessageSquare, User, ScrollText, Copy, RefreshCw, Sparkles } from 'lucide-react';

const CONDITIONS = [
  'Blinded','Charmed','Deafened','Exhaustion','Frightened',
  'Grappled','Incapacitated','Invisible','Paralyzed','Petrified',
  'Poisoned','Prone','Restrained','Stunned','Unconscious',
];

const QUICK_ROLL_HOTBAR = [
  { label: 'd4', expr: '1d4' },
  { label: 'd6', expr: '1d6' },
  { label: 'd8', expr: '1d8' },
  { label: 'd10', expr: '1d10' },
  { label: 'd12', expr: '1d12' },
  { label: 'd20', expr: '1d20' },
  { label: 'd100', expr: '1d100' },
  { label: '2d6', expr: '2d6' },
  { label: 'Adv', expr: '2d20kh1' },
  { label: 'Dis', expr: '2d20kl1' },
];

interface FogRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FogPolygon {
  points: number[];
}

interface FogData {
  revealed: FogRect[];
  hidden: FogRect[];
  hiddenPolygons?: FogPolygon[];
  revealedPolygons?: FogPolygon[];
}

export default function Session() {
  const { campaignId, sessionId } = useParams();
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const { data: campaign } = useGetCampaign(campaignId || '');
  const { data: sessions, refetch: refetchSessions } = useListSessions(campaignId || '');
  const createSession = useCreateSession();
  const creatingRef = useRef(false);

  const [activeSession, setActiveSession] = useState<GameSession | null>(null);

  useEffect(() => {
    if (!sessions || !campaign) return;

    if (sessionId && sessionId !== 'latest') {
      const found = sessions.find((s) => s.id === sessionId);
      if (found) {
        setActiveSession(found);
      } else if (sessions.length > 0) {
        setActiveSession(sessions[sessions.length - 1]);
      }
      return;
    }

    if (sessions.length > 0) {
      setActiveSession(sessions[sessions.length - 1]);
      return;
    }

    if (campaign.role === 'dm' && !creatingRef.current) {
      creatingRef.current = true;
      createSession.mutate(
        { campaignId: campaignId || '' },
        {
          onSuccess: () => {
            creatingRef.current = false;
            refetchSessions();
          },
          onError: () => {
            creatingRef.current = false;
          },
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, campaign, sessionId, campaignId]);

  const prevRoundRef = useRef<number>(1);

  const { data: characters, refetch: refetchCharacters } = useListCharacters(campaignId || '');
  const { data: maps, refetch: refetchMaps } = useListMaps(campaignId || '');
  const createMap = useCreateMap();
  const updateSession = useUpdateSession();
  const messagesQueryKey = [
    `/api/campaigns/${campaignId}/sessions/${activeSession?.id}/messages`,
  ] as const;
  const { data: messages, refetch: refetchMessages } = useListMessages(
    campaignId || '',
    activeSession?.id || '',
    undefined,
    { query: { enabled: !!activeSession?.id, queryKey: messagesQueryKey } }
  );
  const postMessage = usePostMessage();
  const deleteMessage = useDeleteMessage();
  const updateChar = useUpdateCharacter();

  const isDm = campaign?.role === 'dm';

  const {
    data: aiContext,
    refetch: refetchAiContext,
    isFetching: aiContextLoading,
    isError: aiContextError,
  } = useGetSessionAiContext(campaignId || '', activeSession?.id || '', {
    query: {
      queryKey: getGetSessionAiContextQueryKey(campaignId || '', activeSession?.id || ''),
      enabled: Boolean(isDm && campaignId && activeSession?.id),
    },
  });

  const myCharacter = characters?.find((c) => c.userId === user?.id) ?? null;
  // Prefer the session's pinned activeMapId; fall back to the first available map
  const activeMap = (maps && activeSession?.activeMapId
    ? (maps.find(m => m.id === activeSession.activeMapId) ?? maps[0])
    : maps?.[0]) ?? null;

  const { isConnected, emit } = useVttSocket(campaignId || '', activeSession?.id || '');

  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightSidebarTab, setRightSidebarTab] = useState<'character' | 'rolls'>('character');
  const [dmDrawerOpen, setDmDrawerOpen] = useState(false);
  const [aiCopied, setAiCopied] = useState(false);
  const [storyPrompt, setStoryPrompt] = useState('');
  const [storyReply, setStoryReply] = useState<string | null>(null);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [includeStoryContext, setIncludeStoryContext] = useState(true);
  const [placementCombatant, setPlacementCombatant] = useState<InitiativeCombatant | null>(null);

  const storyAssistantMutation = usePostDmStoryAssistant();

  const [hotbarDiceExpr, setHotbarDiceExpr] = useState('');
  const [hotbarLastRoll, setHotbarLastRoll] = useState<{ total: number; output: string } | null>(null);
  const [activeConditions, setActiveConditions] = useState<Array<{ name: string; expiresRound: number | null }>>([]);
  const [quickNotes, setQuickNotes] = useState('');
  const [showConditions, setShowConditions] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const handleDeleteStoryMessage = (messageId: string) => {
    if (!campaignId || !activeSession?.id) return;
    deleteMessage.mutate(
      { campaignId, sessionId: activeSession.id, messageId },
      { onSuccess: () => void refetchMessages() }
    );
  };

  const handleSendMessage = (
    content: string,
    type: 'chat' | 'dice' | 'system' | 'whisper' | 'story',
    diceData?: { total: number; output: string; expr?: string },
    recipientId?: string
  ) => {
    if (!activeSession) return;
    postMessage.mutate(
      {
        campaignId: campaignId || '',
        sessionId: activeSession.id,
        data: { content, type, diceData, recipientId },
      },
      {
        onSuccess: (msg) => {
          emit('chat_message', { message: msg });
        },
      }
    );
  };

  const handleRoll = (expr: string, label: string) => {
    try {
      const roll = new DiceRoll(expr);
      handleSendMessage(
        `${myCharacter?.name || user?.username} rolled ${label}`,
        'dice',
        { total: roll.total, output: roll.output }
      );
    } catch (e) {
      console.error('Dice roll error:', e);
    }
  };

  const handleHpChange = (change: number) => {
    if (!myCharacter || !campaignId) return;
    const newHp = Math.max(0, Math.min(myCharacter.maxHp, (myCharacter.hp || 0) + change));
    updateChar.mutate(
      {
        campaignId,
        characterId: myCharacter.id,
        data: { hp: newHp },
      },
      {
        onSuccess: () => {
          emit('hp_update', { characterId: myCharacter.id, hp: newHp, maxHp: myCharacter.maxHp });
          const verb = change < 0 ? `took ${Math.abs(change)} damage` : `healed ${change} HP`;
          handleSendMessage(`${myCharacter.name} ${verb}`, 'system');
        },
      }
    );
  };

  const handleTokenMove = (mapId: string, tokenId: string, x: number, y: number) => {
    emit('token_move', { mapId, tokenId, x, y });
    refetchMaps();
  };

  const handleTokenPlace = (mapId: string, token: Token) => {
    emit('token_place', { mapId, token });
  };

  const handleTokenRemove = (mapId: string, tokenId: string) => {
    emit('token_remove', { mapId, tokenId });
  };

  const handleFogUpdate = (mapId: string, fogData: FogData) => {
    emit('fog_update', { mapId, fogData });
  };

  const handleNextTurn = () => {
    if (!activeSession || !campaignId) return;
    emit('initiative_advance', { direction: 'next' });
  };

  const handlePrevTurn = () => {
    if (!activeSession || !campaignId) return;
    emit('initiative_advance', { direction: 'prev' });
  };

  const handleInitiativeOrderUpdate = (order: InitiativeCombatant[]) => {
    if (!activeSession || !campaignId) return;
    emit('initiative_order_update', { initiativeOrder: order });
  };

  const handleCreateMap = (name: string, imageData?: string) => {
    if (!campaignId) return;
    createMap.mutate(
      { campaignId, data: { name, ...(imageData ? { imageData } : {}) } },
      { onSuccess: (newMap) => {
        refetchMaps();
        // Auto-switch to the newly created map
        if (activeSession && campaignId) {
          updateSession.mutate(
            { campaignId, sessionId: activeSession.id, data: { activeMapId: newMap.id } },
            { onSuccess: () => refetchSessions() }
          );
        }
      } }
    );
  };

  const handleSwitchMap = (mapId: string) => {
    if (!activeSession || !campaignId) return;
    updateSession.mutate(
      { campaignId, sessionId: activeSession.id, data: { activeMapId: mapId } },
      { onSuccess: () => refetchSessions() }
    );
  };

  const handleHotbarRoll = (expr: string, label?: string) => {
    try {
      const roll = new DiceRoll(expr);
      setHotbarLastRoll({ total: roll.total, output: roll.output });
      handleRoll(expr, label || expr);
    } catch (e) {
      console.error('Hotbar roll error:', e);
    }
  };

  const toggleCondition = (c: string, durationRounds?: number) => {
    setActiveConditions(prev => {
      const existing = prev.find(x => x.name === c);
      if (existing) return prev.filter(x => x.name !== c);
      const currentRound = activeSession?.roundNumber || 1;
      return [...prev, { name: c, expiresRound: durationRounds != null ? currentRound + durationRounds : null }];
    });
  };

  const tickConditions = (newRound: number) => {
    setActiveConditions(prev => {
      const expired = prev.filter(x => x.expiresRound !== null && x.expiresRound <= newRound);
      if (expired.length > 0) {
        expired.forEach(e => handleSendMessage(`⚠️ Condition expired: ${e.name}`, 'system'));
      }
      return prev.filter(x => x.expiresRound === null || x.expiresRound > newRound);
    });
  };

  useEffect(() => {
    const round = activeSession?.roundNumber || 1;
    if (round > prevRoundRef.current) {
      prevRoundRef.current = round;
      tickConditions(round);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.roundNumber]);

  if (!campaign || !activeSession) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="font-display text-2xl text-primary animate-pulse gold-text-glow tracking-wider">
          {campaign?.role === 'player' && sessions?.length === 0
            ? 'Waiting for the DM to start a session...'
            : 'LOADING TABLE...'}
        </div>
        <button
          onClick={() => setLocation('/dashboard')}
          className="text-sm text-muted-foreground hover:text-primary transition-colors font-label"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0a] overflow-hidden text-foreground">
      {/* TOP BAR */}
      <header className="h-12 bg-card border-b border-border/50 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            className="p-1 hover:bg-white/10 rounded"
            title="Party chat & video"
          >
            <MessageSquare className="w-5 h-5 text-primary" />
          </button>
          <div className="font-display font-bold text-lg text-primary gold-text-glow tracking-wider">
            {campaign.name}
          </div>
          {isDm && (
            <span className="text-[10px] font-label uppercase bg-destructive/20 text-destructive border border-destructive px-2 py-0.5 rounded">
              DM
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div title={isConnected ? 'Connected' : 'Disconnected'}>
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <span className="text-xs text-muted-foreground font-label hidden md:block">
            {activeSession.name}
          </span>
          {isDm && (
            <button
              onClick={() => setDmDrawerOpen(true)}
              className="flex items-center gap-1.5 text-sm text-destructive/80 hover:text-destructive border border-destructive/30 hover:border-destructive/60 px-2.5 py-1 rounded font-label font-bold transition-colors"
              title="DM Command Center"
            >
              <Swords className="w-4 h-4" /> DM
            </button>
          )}
          <button
            onClick={() => setLocation('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors font-label font-bold"
          >
            <LogOut className="w-4 h-4" /> Exit
          </button>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="p-1 hover:bg-white/10 rounded"
            title="Character sheet & rolls"
          >
            <User className="w-5 h-5 text-primary" />
          </button>
        </div>
      </header>

      {/* INITIATIVE STRIP */}
      <InitiativeBar
        order={(activeSession.initiativeOrder as InitiativeCombatant[]) || []}
        currentIndex={activeSession.currentTurnIndex || 0}
        roundNumber={activeSession.roundNumber || 1}
        isDm={isDm}
        onNextTurn={handleNextTurn}
        onPrevTurn={handlePrevTurn}
        onOrderUpdate={handleInitiativeOrderUpdate}
        characters={characters || []}
        onBeginMapPlacement={isDm ? (c) => setPlacementCombatant(c) : undefined}
      />

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANEL: Party chat + video + dice */}
        <div
          className={`absolute lg:relative z-20 h-full transition-all duration-300 ease-in-out border-r border-border shadow-2xl lg:shadow-none bg-background flex-shrink-0 flex flex-col min-h-0 min-w-0 ${
            leftPanelOpen ? 'translate-x-0 w-[min(100vw,400px)] lg:w-[400px]' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-none lg:overflow-hidden'
          }`}
        >
          {leftPanelOpen && (
            <>
              <button
                className="lg:hidden absolute top-2 right-2 p-1 z-50 bg-card rounded-full border border-border"
                onClick={() => setLeftPanelOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
              <ChatPanel
                messages={messages || []}
                onSendMessage={handleSendMessage}
                isDm={isDm}
                myCharacter={myCharacter}
                allCharacters={characters || []}
                activeSession={activeSession}
                campaignId={campaignId || ''}
                onOrderUpdate={handleInitiativeOrderUpdate}
                onCreateMap={isDm ? handleCreateMap : undefined}
                onSwitchMap={isDm ? handleSwitchMap : undefined}
                allMaps={maps ?? []}
                panelVariant="communications"
                onDeleteStoryMessage={isDm ? handleDeleteStoryMessage : undefined}
                deletingStoryMessageId={
                  deleteMessage.isPending ? deleteMessage.variables?.messageId : undefined
                }
              />
            </>
          )}
        </div>

        {/* CENTER: Map Canvas */}
        <div className="flex-1 relative bg-black min-w-0">
          <MapCanvas
            map={activeMap}
            characters={characters || []}
            onTokenMove={handleTokenMove}
            onFogUpdate={handleFogUpdate}
            onTokenPlace={handleTokenPlace}
            onTokenRemove={handleTokenRemove}
            isDm={isDm}
            placementDraft={placementCombatant}
            onPlacementDraftConsumed={() => setPlacementCombatant(null)}
          />
          <StoryMapOverlay sessionId={activeSession.id} messages={messages || []} />
        </div>

        {/* RIGHT PANEL: Character sheet + Rolls */}
        <div
          className={`absolute right-0 lg:relative z-20 h-full transition-all duration-300 ease-in-out border-l border-border shadow-2xl lg:shadow-none bg-background flex-shrink-0 min-h-0 min-w-0 flex flex-col ${
            rightPanelOpen ? 'translate-x-0 w-[min(100vw,400px)] lg:w-[400px]' : 'translate-x-full lg:translate-x-0 lg:w-0 lg:border-none lg:overflow-hidden'
          }`}
        >
          {rightPanelOpen && (
            <>
              <button
                className="lg:hidden absolute top-2 left-2 p-1 z-50 bg-card rounded-full border border-border"
                onClick={() => setRightPanelOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex border-b border-border bg-card shrink-0 pt-8 lg:pt-0">
                <button
                  type="button"
                  onClick={() => setRightSidebarTab('character')}
                  className={`flex-1 py-2.5 text-xs font-label font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${
                    rightSidebarTab === 'character'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ScrollText className="w-3.5 h-3.5" /> Sheet
                </button>
                <button
                  type="button"
                  onClick={() => setRightSidebarTab('rolls')}
                  className={`flex-1 py-2.5 text-xs font-label font-bold border-b-2 transition-colors flex items-center justify-center gap-1 ${
                    rightSidebarTab === 'rolls'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Dices className="w-3.5 h-3.5" /> Rolls
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {rightSidebarTab === 'character' ? (
                  <CharacterSheet
                    character={myCharacter}
                    isDm={isDm}
                    allCharacters={characters || []}
                    onRoll={handleRoll}
                    onUpdateHp={handleHpChange}
                    campaignId={campaignId || ''}
                  />
                ) : (
                  <RollsPanel
                    messages={messages || []}
                    myCharacter={myCharacter}
                    onSendMessage={handleSendMessage}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* DM COMMAND CENTER DRAWER OVERLAY */}
      {isDm && (
        <>
          {/* Backdrop */}
          {dmDrawerOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setDmDrawerOpen(false)}
            />
          )}
          {/* Drawer */}
          <div
            className={`fixed top-0 right-0 h-full w-[380px] max-w-full z-50 bg-background border-l border-border/50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
              dmDrawerOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card shrink-0">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-destructive" />
                <span className="font-display text-lg text-primary">Command Center</span>
                <span className="text-[10px] font-label uppercase bg-destructive/20 text-destructive border border-destructive/40 px-1.5 py-0.5 rounded">DM Only</span>
              </div>
              <button
                onClick={() => setDmDrawerOpen(false)}
                className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* AI session context (DM) — paste into external LLM tools */}
            <div className="shrink-0 border-b border-border/50 px-4 py-3 space-y-2 bg-card/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ScrollText className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-label text-xs font-bold text-primary uppercase tracking-wide truncate">
                    AI session context
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Refresh"
                    onClick={() => void refetchAiContext()}
                    disabled={aiContextLoading}
                    className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${aiContextLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    title="Copy compiled narrative"
                    onClick={async () => {
                      if (!aiContext?.compiledNarrativeContext) return;
                      try {
                        await navigator.clipboard.writeText(aiContext.compiledNarrativeContext);
                        setAiCopied(true);
                        setTimeout(() => setAiCopied(false), 2000);
                      } catch {
                        /* ignore */
                      }
                    }}
                    disabled={!aiContext?.compiledNarrativeContext || aiContextLoading}
                    className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground font-sans leading-snug">
                Campaign summary, party, memory JSON, and recent chat as one text block. Paste into your
                favorite AI assistant.
              </p>
              {aiContextError && (
                <p className="text-[10px] text-destructive font-sans">Could not load AI context.</p>
              )}
              {aiCopied && (
                <p className="text-[10px] text-emerald-500 font-sans">Copied to clipboard.</p>
              )}
            </div>
            {/* Groq DM story assistant */}
            <div className="shrink-0 border-b border-border/50 px-4 py-3 space-y-2 bg-card/40 flex flex-col max-h-[min(42vh,320px)]">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-magic shrink-0" />
                <span className="font-label text-xs font-bold text-magic uppercase tracking-wide truncate">
                  Story assistant (Groq)
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-sans leading-snug">
                Model: <span className="text-foreground/90 font-mono">llama-4-scout-17b-16e-instruct</span> ·
                Requires <code className="text-[9px]">GROQ_API_KEY</code> on the API server.
              </p>
              <label className="flex items-center gap-2 text-[10px] font-sans text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={includeStoryContext}
                  onChange={(e) => setIncludeStoryContext(e.target.checked)}
                />
                Include compiled session & campaign context
              </label>
              <textarea
                value={storyPrompt}
                onChange={(e) => setStoryPrompt(e.target.value)}
                placeholder="Ask for narration, NPC lines, consequences, or brainstorming…"
                rows={3}
                className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-sans text-foreground focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!campaignId || !activeSession?.id || !storyPrompt.trim()) return;
                    setStoryError(null);
                    storyAssistantMutation.mutate(
                      {
                        campaignId,
                        sessionId: activeSession.id,
                        data: {
                          message: storyPrompt.trim(),
                          includeSessionContext: includeStoryContext,
                        },
                      },
                      {
                        onSuccess: (data) => {
                          setStoryReply(data.reply);
                          setStoryError(null);
                          const reply = data.reply?.trim();
                          if (!reply) return;
                          postMessage.mutate(
                            {
                              campaignId,
                              sessionId: activeSession.id,
                              data: { content: reply, type: 'story' },
                            },
                            {
                              onSuccess: (msg) => {
                                emit('chat_message', { message: msg });
                              },
                            }
                          );
                        },
                        onError: (err: unknown) => {
                          setStoryReply(null);
                          setStoryError(
                            err instanceof Error ? err.message : 'Story assistant request failed.'
                          );
                        },
                      }
                    );
                  }}
                  disabled={
                    storyAssistantMutation.isPending ||
                    !storyPrompt.trim() ||
                    !activeSession?.id
                  }
                  className="flex-1 h-8 rounded border border-magic/50 bg-magic/10 text-magic text-xs font-label font-bold hover:bg-magic/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {storyAssistantMutation.isPending ? 'Thinking…' : 'Send to assistant'}
                </button>
              </div>
              {storyError && (
                <p className="text-[10px] text-destructive font-sans leading-snug">{storyError}</p>
              )}
              {storyReply && (
                <div className="text-[10px] font-sans text-foreground/95 leading-relaxed overflow-y-auto max-h-40 pr-1 border border-border/40 rounded bg-background/80 p-2 whitespace-pre-wrap">
                  {storyReply}
                </div>
              )}
            </div>
            {/* Drawer Content — DM tools only (ChatPanel dmTools variant) */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <ChatPanel
                messages={messages || []}
                onSendMessage={handleSendMessage}
                isDm={true}
                myCharacter={myCharacter}
                allCharacters={characters || []}
                activeSession={activeSession}
                campaignId={campaignId || ''}
                onOrderUpdate={handleInitiativeOrderUpdate}
                onCreateMap={handleCreateMap}
                onSwitchMap={handleSwitchMap}
                allMaps={maps ?? []}
                panelVariant="dmTools"
                onDeleteStoryMessage={handleDeleteStoryMessage}
                deletingStoryMessageId={
                  deleteMessage.isPending ? deleteMessage.variables?.messageId : undefined
                }
              />
            </div>
          </div>
        </>
      )}

      {/* BOTTOM HOTBAR */}
      <div className="h-auto shrink-0 bg-card border-t border-border/50 z-30 relative">
        {/* Popups */}
        {showConditions && (
          <div className="absolute bottom-full left-0 right-0 bg-card border border-border/50 shadow-2xl p-3 z-50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-label font-bold text-primary uppercase">Conditions</div>
              <div className="text-[10px] text-muted-foreground font-label">Round {activeSession?.roundNumber || 1} · Click to toggle · Shift+click for 1-round timer</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CONDITIONS.map(c => {
                const active = activeConditions.find(x => x.name === c);
                return (
                  <button
                    key={c}
                    onClick={e => toggleCondition(c, e.shiftKey ? 1 : undefined)}
                    className={`text-xs px-2.5 py-1 rounded border font-label font-bold transition-all flex flex-col items-center gap-0 ${
                      active
                        ? 'bg-destructive/20 border-destructive text-destructive'
                        : 'border-border text-muted-foreground hover:border-border/80'
                    }`}
                  >
                    <span>{c}</span>
                    {active?.expiresRound != null && (
                      <span className="text-[9px] opacity-70">R{active.expiresRound}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {showNotes && (
          <div className="absolute bottom-full left-0 right-0 bg-card border border-border/50 shadow-2xl p-3 z-50">
            <div className="text-xs font-label font-bold text-primary uppercase mb-2">Quick Notes</div>
            <textarea
              value={quickNotes}
              onChange={e => setQuickNotes(e.target.value)}
              placeholder="Jot down notes, reminders, or anything else..."
              rows={4}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm font-sans text-foreground focus:outline-none focus:border-primary resize-none"
            />
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2 h-12">
          {/* Dice expr input + roll */}
          <div className="flex items-center gap-1.5 mr-1">
            <input
              type="text"
              value={hotbarDiceExpr}
              onChange={e => setHotbarDiceExpr(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && hotbarDiceExpr.trim()) handleHotbarRoll(hotbarDiceExpr.trim()); }}
              placeholder="1d20+5"
              className="w-24 bg-background border border-border/60 rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary h-7"
            />
            <button
              onClick={() => hotbarDiceExpr.trim() && handleHotbarRoll(hotbarDiceExpr.trim())}
              className="flex items-center gap-1 h-7 px-2.5 bg-primary/20 border border-primary/40 text-primary rounded text-xs font-label font-bold hover:bg-primary/30 transition-colors"
            >
              <Dices className="w-3.5 h-3.5" /> Roll
            </button>
          </div>

          {/* Separator */}
          <div className="w-px h-6 bg-border/50" />

          {/* Quick-roll buttons */}
          <div className="flex items-center gap-1 flex-wrap">
            {QUICK_ROLL_HOTBAR.map(({ label, expr }) => (
              <button
                key={label}
                onClick={() => handleHotbarRoll(expr, label)}
                title={expr}
                className="h-7 px-2 rounded border border-border/40 text-[11px] font-label font-bold text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 transition-all"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Last roll result */}
          {hotbarLastRoll && (
            <div className="ml-2 flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded px-2 py-1 flex-shrink-0">
              <span className="text-primary font-bold text-base font-serif leading-none">{hotbarLastRoll.total}</span>
              <span className="text-muted-foreground text-[10px] font-mono hidden md:block">{hotbarLastRoll.output}</span>
            </div>
          )}

          <div className="flex-1" />

          {/* Active conditions chips */}
          {activeConditions.length > 0 && (
            <div className="flex gap-1 items-center mr-2 flex-wrap">
              {activeConditions.map(({ name, expiresRound }) => (
                <span
                  key={name}
                  onClick={() => toggleCondition(name)}
                  title={expiresRound != null ? `Expires round ${expiresRound}` : 'Indefinite'}
                  className="text-[10px] font-label font-bold px-2 py-0.5 rounded bg-destructive/20 border border-destructive/60 text-destructive cursor-pointer hover:bg-destructive/30 transition-colors"
                >
                  {name}{expiresRound != null ? ` (R${expiresRound})` : ''}
                </span>
              ))}
            </div>
          )}

          {/* Conditions toggle */}
          <button
            onClick={() => { setShowConditions(v => !v); setShowNotes(false); }}
            title="Conditions"
            className={`flex items-center gap-1 h-7 px-2.5 rounded border text-xs font-label font-bold transition-all ${
              showConditions || activeConditions.length > 0
                ? 'border-destructive/60 text-destructive bg-destructive/10'
                : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Conditions</span>
            {activeConditions.length > 0 && <span className="text-destructive font-bold">({activeConditions.length})</span>}
          </button>

          {/* Notes toggle */}
          <button
            onClick={() => { setShowNotes(v => !v); setShowConditions(false); }}
            title="Quick Notes"
            className={`flex items-center gap-1 h-7 px-2.5 rounded border text-xs font-label font-bold transition-all ${
              showNotes || quickNotes
                ? 'border-primary/60 text-primary bg-primary/10'
                : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Notes</span>
          </button>
        </div>
      </div>
    </div>
  );
}
