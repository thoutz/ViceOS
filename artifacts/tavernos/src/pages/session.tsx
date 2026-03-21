import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  useGetMe,
  useGetCampaign,
  useListSessions,
  useCreateSession,
  useListCharacters,
  useListMaps,
  useListMessages,
  usePostMessage,
  useUpdateCharacter,
  Character,
  GameSession,
} from '@workspace/api-client-react';
import { useVttSocket } from '@/hooks/use-socket';
import { MapCanvas } from '@/components/vtt/MapCanvas';
import { CharacterSheet } from '@/components/vtt/CharacterSheet';
import { InitiativeBar, type InitiativeCombatant } from '@/components/vtt/InitiativeBar';
import { ChatPanel } from '@/components/vtt/ChatPanel';
import { DiceRoll } from 'rpg-dice-roller';
import { LogOut, Menu, X, Wifi, WifiOff } from 'lucide-react';

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

  const { data: characters, refetch: refetchCharacters } = useListCharacters(campaignId || '');
  const { data: maps, refetch: refetchMaps } = useListMaps(campaignId || '');
  const { data: messages, refetch: refetchMessages } = useListMessages(
    campaignId || '',
    activeSession?.id || '',
    undefined,
    { query: { enabled: !!activeSession?.id } }
  );
  const postMessage = usePostMessage();
  const updateChar = useUpdateCharacter();

  const isDm = campaign?.role === 'dm';
  const myCharacter = characters?.find((c) => c.userId === user?.id) ?? null;
  const activeMap = maps?.[0] ?? null;

  const { isConnected, emit } = useVttSocket(campaignId || '', activeSession?.id || '');

  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const handleSendMessage = (content: string, type: any, diceData?: any) => {
    if (!activeSession) return;
    postMessage.mutate(
      {
        campaignId: campaignId || '',
        sessionId: activeSession.id,
        data: { content, type, diceData },
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

  const handleFogUpdate = (mapId: string, fogData: any) => {
    emit('fog_update', { mapId, fogData });
  };

  const handleNextTurn = () => {
    if (!activeSession || !campaignId) return;
    emit('initiative_advance', { direction: 'next' } as any);
  };

  const handlePrevTurn = () => {
    if (!activeSession || !campaignId) return;
    emit('initiative_advance', { direction: 'prev' } as any);
  };

  const handleInitiativeOrderUpdate = (order: any[]) => {
    if (!activeSession || !campaignId) return;
    emit('initiative_order_update', { initiativeOrder: order } as any);
  };

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
            title="Toggle Character Sheet"
          >
            <Menu className="w-5 h-5 text-primary" />
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
          <button
            onClick={() => setLocation('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors font-label font-bold"
          >
            <LogOut className="w-4 h-4" /> Exit
          </button>
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className="p-1 hover:bg-white/10 rounded"
            title="Toggle Chat Panel"
          >
            <Menu className="w-5 h-5 text-primary" />
          </button>
        </div>
      </header>

      {/* INITIATIVE STRIP */}
      <InitiativeBar
        order={(activeSession.initiativeOrder as any[]) || []}
        currentIndex={activeSession.currentTurnIndex || 0}
        roundNumber={activeSession.roundNumber || 1}
        isDm={isDm}
        onNextTurn={handleNextTurn}
        onPrevTurn={handlePrevTurn}
        onOrderUpdate={handleInitiativeOrderUpdate}
        characters={characters || []}
      />

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANEL: Character Sheet */}
        <div
          className={`absolute lg:relative z-20 h-full transition-all duration-300 ease-in-out border-r border-border shadow-2xl lg:shadow-none bg-background flex-shrink-0 ${
            leftPanelOpen ? 'translate-x-0 w-[360px]' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-none lg:overflow-hidden'
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
              <CharacterSheet
                character={myCharacter}
                isDm={isDm}
                allCharacters={characters || []}
                onRoll={handleRoll}
                onUpdateHp={handleHpChange}
                campaignId={campaignId || ''}
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
            isDm={isDm}
          />
        </div>

        {/* RIGHT PANEL: Chat & DM Tools */}
        <div
          className={`absolute right-0 lg:relative z-20 h-full transition-all duration-300 ease-in-out border-l border-border shadow-2xl lg:shadow-none bg-background flex-shrink-0 ${
            rightPanelOpen ? 'translate-x-0 w-[340px]' : 'translate-x-full lg:translate-x-0 lg:w-0 lg:border-none lg:overflow-hidden'
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
              <ChatPanel
                messages={messages || []}
                onSendMessage={handleSendMessage}
                isDm={isDm}
                myCharacter={myCharacter}
                allCharacters={characters || []}
                activeSession={activeSession}
                campaignId={campaignId || ''}
                onOrderUpdate={handleInitiativeOrderUpdate}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
