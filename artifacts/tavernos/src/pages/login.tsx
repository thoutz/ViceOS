import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
import { VttButton } from '@/components/VttButton';
import { VttInput } from '@/components/VttInput';
import { Dices } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
  const [username, setUsername] = useState('');
  const [, setLocation] = useLocation();
  const loginMutation = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    loginMutation.mutate(
      { data: { username } },
      {
        onSuccess: () => {
          setLocation('/dashboard');
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#0a0a0a]">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}images/tavern-bg.png)` }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-background via-background/80 to-transparent" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 glass-panel p-10 max-w-md w-full rounded-xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-card border border-primary/50 shadow-[0_0_20px_rgba(201,168,76,0.3)] mb-4">
            <Dices className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl font-display text-primary gold-text-glow mb-2">TavernOS</h1>
          <p className="text-muted-foreground font-label tracking-widest uppercase text-sm">Virtual Tabletop</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-label font-bold text-foreground/80 block">Wanderer, what is your name?</label>
            <VttInput
              placeholder="Enter username..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 text-lg"
              autoFocus
            />
          </div>
          <VttButton 
            type="submit" 
            className="w-full h-12 text-lg" 
            disabled={loginMutation.isPending || !username.trim()}
          >
            {loginMutation.isPending ? "Entering..." : "Enter Tavern"}
          </VttButton>
          
          {loginMutation.isError && (
            <div className="text-destructive text-sm text-center font-bold">
              Failed to enter. Try another name.
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
