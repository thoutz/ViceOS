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
  GameMap,
  GameSession
} from '@workspace/api-client-react';
import { useVttSocket } from '@/hooks/use-socket';
import { useVttStore } from '@/hooks/use-vtt-state';
import { MapCanvas } from '@/components/vtt/MapCanvas';
import { CharacterSheet } from '@/components/vtt/CharacterSheet';
import { InitiativeBar } from '@/components/vtt/InitiativeBar';
import { ChatPanel } from '@/components/vtt/ChatPanel';
import { Dices, LogOut, Menu, X } from 'lucide-react';
import { DiceRoll } from 'rpg-dice-roller';

export default function Session() {
  const { campaignId, sessionId } = useParams();
  const [, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const { data: campaign } = useGetCampaign(campaignId || '');
  const { data: sessions, refetch: refetchSessions } = useListSessions(campaignId || '');
  const createSession = useCreateSession();
  const creatingRef = useRef(false);
  
  const [activeSession, setActiveSession] = useState<GameSession | null>(null);

  // Once sessions load, pick the requested one or create one
  useEffect(() => {
    if (!sessions || !campaign) return;
    
    const found = sessions.find(s => sessionId !== 'latest' ? s.id === sessionId : true);
    if (found) {
      setActiveSession(found);
    } else if (sessionId === 'latest' && campaign.role === 'dm' && !creatingRef.current) {
      creatingRef.current = true;
      createSession.mutate({ campaignId: campaignId || '' }, {
        onSuccess: () => {
          creatingRef.current = false;
          refetchSessions();
        },
        onError: () => {
          creatingRef.current = false;
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, campaign, sessionId, campaignId]);

  const { data: characters } = useListCharacters(campaignId || '');
  const { data: maps } = useListMaps(campaignId || '');
  const { data: messages } = useListMessages(campaignId || '', activeSession?.id || '', undefined, {
    query: { enabled: !!activeSession?.id }
  });
  const postMessage = usePostMessage();
  const updateChar = useUpdateCharacter();

  const isDm = campaign?.role === 'dm';
  const myCharacter = characters?.find(c => c.userId === user?.id) || characters?.[0] || null;
  const activeMap = maps?.[0] || null; // For simplicity, grab first map

  // Setup Socket
  const { emit } = useVttSocket(campaignId || '', activeSession?.id || '');

  // UI State
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  if (!campaign || !activeSession) {
    return <div className="min-h-screen bg-background flex items-center justify-center font-display text-2xl text-primary animate-pulse">Loading Table...</div>;
  }

  const handleSendMessage = (content: string, type: any, diceData?: any) => {
    postMessage.mutate({
      campaignId: campaignId || '',
      sessionId: activeSession.id,
      data: { content, type, diceData }
    }, {
      onSuccess: () => emit('chat_message', {})
    });
  };

  const handleRoll = (expr: string, label: string) => {
    try {
      const roll = new DiceRoll(expr);
      handleSendMessage(`${myCharacter?.name || user?.username} rolled for ${label}`, 'dice', {
        total: roll.total,
        output: roll.output,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleHpChange = (change: number) => {
    if (!myCharacter) return;
    const newHp = Math.max(0, Math.min(myCharacter.maxHp, myCharacter.hp + change));
    updateChar.mutate({
      campaignId: campaignId || '',
      characterId: myCharacter.id,
      data: { hp: newHp }
    }, {
      onSuccess: () => {
        emit('character_updated', { characterId: myCharacter.id });
        handleSendMessage(`${myCharacter.name} ${change < 0 ? 'took ' + Math.abs(change) + ' damage' : 'healed ' + change + ' HP'}`, 'system');
      }
    });
  };

  const handleTokenMove = (tokenId: string, x: number, y: number) => {
    // In a full implementation, we'd update the map tokens array here
    // For now, just emit the socket event
    emit('token_moved', { tokenId, x, y });
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0a] overflow-hidden text-foreground">
      
      {/* TOP BAR */}
      <header className="h-12 bg-card border-b border-border/50 flex items-center justify-between px-4 z-30 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setLeftPanelOpen(!leftPanelOpen)} className="p-1 hover:bg-white/10 rounded">
            <Menu className="w-5 h-5 text-primary" />
          </button>
          <div className="font-display font-bold text-lg text-primary gold-text-glow tracking-wider">
            {campaign.name}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {isDm && <span className="text-xs font-label uppercase bg-destructive/20 text-destructive border border-destructive px-2 py-0.5 rounded">DM Mode</span>}
          <button onClick={() => setLocation('/dashboard')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors font-label font-bold">
            <LogOut className="w-4 h-4" /> Exit
          </button>
          <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className="p-1 hover:bg-white/10 rounded">
            <Menu className="w-5 h-5 text-primary" />
          </button>
        </div>
      </header>

      {/* INITIATIVE STRIP */}
      <InitiativeBar 
        order={activeSession.initiativeOrder || []} 
        currentIndex={activeSession.currentTurnIndex || 0}
        roundNumber={activeSession.roundNumber || 1}
        isDm={isDm}
        onNextTurn={() => emit('session_updated', { action: 'next_turn' })}
        onPrevTurn={() => emit('session_updated', { action: 'prev_turn' })}
      />

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANEL: Character Sheet */}
        <div 
          className={`absolute lg:relative z-20 h-full transition-all duration-300 ease-in-out border-r border-border shadow-2xl lg:shadow-none bg-background ${
            leftPanelOpen ? 'translate-x-0 w-[400px]' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-none'
          }`}
        >
          {leftPanelOpen && (
            <>
              <button className="lg:hidden absolute top-2 right-2 p-1 z-50 bg-card rounded-full border border-border" onClick={() => setLeftPanelOpen(false)}>
                <X className="w-4 h-4" />
              </button>
              <CharacterSheet character={myCharacter} onRoll={handleRoll} onUpdateHp={handleHpChange} />
            </>
          )}
        </div>

        {/* CENTER: Map Canvas */}
        <div className="flex-1 relative bg-black">
          <MapCanvas map={activeMap} onTokenMove={handleTokenMove} isDm={isDm} />
        </div>

        {/* RIGHT PANEL: Chat & Dice */}
        <div 
          className={`absolute right-0 lg:relative z-20 h-full transition-all duration-300 ease-in-out border-l border-border shadow-2xl lg:shadow-none bg-background ${
            rightPanelOpen ? 'translate-x-0 w-[350px]' : 'translate-x-full lg:translate-x-0 lg:w-0 lg:border-none'
          }`}
        >
          {rightPanelOpen && (
            <>
              <button className="lg:hidden absolute top-2 left-2 p-1 z-50 bg-card rounded-full border border-border" onClick={() => setRightPanelOpen(false)}>
                <X className="w-4 h-4" />
              </button>
              <ChatPanel messages={messages || []} onSendMessage={handleSendMessage} isDm={isDm} />
            </>
          )}
        </div>
      </div>
      
    </div>
  );
}
