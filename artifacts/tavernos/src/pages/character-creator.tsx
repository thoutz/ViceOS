import React, { useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useGetCampaign, useCreateCharacter } from '@workspace/api-client-react';
import { VttButton } from '@/components/VttButton';
import { VttInput } from '@/components/VttInput';
import { DiceRoll } from 'rpg-dice-roller';
import { motion, AnimatePresence } from 'framer-motion';

export default function CharacterCreator() {
  const { campaignId } = useParams();
  const [, setLocation] = useLocation();
  const { data: campaign, isLoading } = useGetCampaign(campaignId || '');
  const createMutation = useCreateCharacter();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    race: 'Human',
    class: 'Fighter',
    background: 'Soldier',
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
  });

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center text-primary font-display text-xl animate-pulse">Consulting the archives...</div>;

  const rollStats = () => {
    const newStats = { ...formData.stats };
    (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).forEach(stat => {
      const r = new DiceRoll('4d6d1'); // roll 4d6 drop lowest
      newStats[stat] = r.total;
    });
    setFormData({ ...formData, stats: newStats });
  };

  const handleComplete = () => {
    if (!campaignId) return;
    createMutation.mutate({
      campaignId,
      data: {
        ...formData,
        level: 1,
        hp: 10 + Math.floor((formData.stats.con - 10) / 2),
        maxHp: 10 + Math.floor((formData.stats.con - 10) / 2),
        ac: 10 + Math.floor((formData.stats.dex - 10) / 2),
        speed: 30,
        tokenColor: '#'+Math.floor(Math.random()*16777215).toString(16) // Random color for now
      }
    }, {
      onSuccess: () => {
        setLocation(`/session/${campaignId}/latest`);
      }
    });
  };

  const steps = [
    { title: "Identity", num: 1 },
    { title: "Origin", num: 2 },
    { title: "Attributes", num: 3 },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-parchment-texture opacity-10 mix-blend-overlay z-0" />
      
      <div className="z-10 w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-display text-primary mb-2">Create Character</h1>
          <p className="text-muted-foreground font-label tracking-widest">{campaign?.name}</p>
        </div>

        {/* Stepper */}
        <div className="flex justify-between items-center mb-8 px-12 relative">
          <div className="absolute top-1/2 left-12 right-12 h-0.5 bg-border -z-10" />
          {steps.map(s => (
            <div key={s.num} className="flex flex-col items-center bg-background px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold font-serif transition-colors ${step >= s.num ? 'bg-primary border-primary text-card' : 'bg-card border-border text-muted-foreground'}`}>
                {s.num}
              </div>
              <span className={`text-xs font-label mt-2 uppercase font-bold ${step >= s.num ? 'text-primary' : 'text-muted-foreground'}`}>{s.title}</span>
            </div>
          ))}
        </div>

        <div className="glass-panel p-8 rounded-xl min-h-[400px] flex flex-col relative overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} className="flex-1 flex flex-col justify-center space-y-6">
                <div>
                  <label className="text-sm font-label font-bold mb-2 block text-primary">Character Name</label>
                  <VttInput value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="text-xl h-14" autoFocus placeholder="E.g. Gandalf" />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} className="flex-1 flex flex-col justify-center space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-label font-bold mb-2 block text-primary">Race</label>
                    <select className="flex h-12 w-full rounded-sm border border-border bg-input/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary font-sans text-lg" value={formData.race} onChange={e => setFormData({...formData, race: e.target.value})}>
                      <option>Human</option><option>Elf</option><option>Dwarf</option><option>Halfling</option><option>Tiefling</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-label font-bold mb-2 block text-primary">Class</label>
                    <select className="flex h-12 w-full rounded-sm border border-border bg-input/50 px-3 py-2 text-foreground focus:outline-none focus:border-primary font-sans text-lg" value={formData.class} onChange={e => setFormData({...formData, class: e.target.value})}>
                      <option>Fighter</option><option>Wizard</option><option>Rogue</option><option>Cleric</option><option>Ranger</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-label font-bold mb-2 block text-primary">Background</label>
                  <VttInput value={formData.background} onChange={e => setFormData({...formData, background: e.target.value})} className="text-lg h-12" />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} className="flex-1 flex flex-col justify-center space-y-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-label font-bold text-primary">Ability Scores</label>
                  <VttButton variant="outline" size="sm" onClick={rollStats}>🎲 Roll 4d6d1</VttButton>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {(Object.keys(formData.stats) as Array<keyof typeof formData.stats>).map(stat => (
                    <div key={stat} className="bg-card p-3 border border-border rounded flex flex-col items-center">
                      <span className="font-label text-xs uppercase text-muted-foreground mb-1">{stat}</span>
                      <VttInput 
                        type="number" 
                        value={formData.stats[stat]} 
                        onChange={e => setFormData({...formData, stats: {...formData.stats, [stat]: parseInt(e.target.value)||10}})}
                        className="text-center font-serif text-2xl h-12"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 pt-4 border-t border-border/50 flex justify-between">
            <VttButton variant="ghost" disabled={step === 1} onClick={() => setStep(s => s - 1)}>Back</VttButton>
            {step < 3 ? (
              <VttButton disabled={step === 1 && !formData.name} onClick={() => setStep(s => s + 1)}>Next</VttButton>
            ) : (
              <VttButton onClick={handleComplete} disabled={createMutation.isPending}>{createMutation.isPending ? 'Forging...' : 'Complete'}</VttButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
