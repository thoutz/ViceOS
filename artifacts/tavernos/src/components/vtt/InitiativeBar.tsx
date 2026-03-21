import React from 'react';
import { InitiativeCombatant } from '@workspace/api-client-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Heart, Skull } from 'lucide-react';
import { VttButton } from '../VttButton';

interface InitiativeBarProps {
  order: InitiativeCombatant[];
  currentIndex: number;
  roundNumber: number;
  isDm: boolean;
  onNextTurn: () => void;
  onPrevTurn: () => void;
}

export function InitiativeBar({ order, currentIndex, roundNumber, isDm, onNextTurn, onPrevTurn }: InitiativeBarProps) {
  if (!order || order.length === 0) {
    return (
      <div className="h-16 bg-card border-b border-border flex items-center justify-center text-muted-foreground italic font-label">
        Combat not started
      </div>
    );
  }

  return (
    <div className="h-20 bg-card border-b border-border flex items-center px-4 gap-4 shadow-md relative z-10">
      <div className="flex flex-col items-center justify-center min-w-[80px] border-r border-border pr-4">
        <span className="text-[10px] font-label text-primary uppercase tracking-widest">Round</span>
        <span className="text-2xl font-display font-bold text-foreground">{roundNumber}</span>
      </div>

      <div className="flex-1 flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
        <AnimatePresence>
          {order.map((combatant, idx) => {
            const isActive = idx === currentIndex;
            
            return (
              <motion.div
                key={combatant.characterId + idx}
                layout
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative flex items-center gap-3 p-2 rounded-md min-w-[160px] transition-colors ${
                  isActive 
                    ? 'bg-primary/20 border-2 border-primary shadow-[0_0_15px_rgba(201,168,76,0.4)]' 
                    : 'bg-background border border-border/50 opacity-80'
                }`}
              >
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner"
                  style={{ backgroundColor: combatant.tokenColor || '#3A3228' }}
                >
                  {combatant.initiative}
                </div>
                <div className="flex flex-col flex-1 truncate">
                  <span className="font-label font-bold text-sm truncate text-foreground">{combatant.name}</span>
                  {isDm && (
                    <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3 text-destructive"/> {combatant.hp}</span>
                      <span className="flex items-center gap-0.5"><Shield className="w-3 h-3 text-primary"/> {combatant.ac}</span>
                    </div>
                  )}
                </div>
                {combatant.hp <= 0 && (
                  <div className="absolute -top-2 -right-2 bg-destructive rounded-full p-1 border-2 border-card">
                    <Skull className="w-3 h-3 text-white" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {isDm && (
        <div className="flex items-center gap-2 pl-4 border-l border-border">
          <VttButton variant="outline" size="sm" onClick={onPrevTurn}>Prev</VttButton>
          <VttButton variant="default" size="sm" onClick={onNextTurn}>Next Turn</VttButton>
        </div>
      )}
    </div>
  );
}
