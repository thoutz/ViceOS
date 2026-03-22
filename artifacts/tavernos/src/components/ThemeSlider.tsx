import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeSlider({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <label
      className={`flex items-center gap-2 cursor-pointer select-none ${className}`}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label="Toggle theme"
    >
      <Sun className={`w-3.5 h-3.5 shrink-0 transition-colors ${isDark ? 'text-muted-foreground' : 'text-amber-500'}`} />

      <div className="relative w-10 h-5 shrink-0">
        <input
          type="range"
          min={0}
          max={1}
          step={1}
          value={isDark ? 1 : 0}
          onChange={e => setTheme(Number(e.target.value) === 1 ? 'dark' : 'light')}
          className="sr-only"
        />
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={`w-10 h-5 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-1 focus:ring-offset-background ${
            isDark
              ? 'bg-primary/80 border-primary/50'
              : 'bg-border border-border'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all duration-300 shadow-sm ${
              isDark
                ? 'translate-x-5 bg-primary-foreground'
                : 'translate-x-0 bg-white'
            }`}
          />
        </button>
      </div>

      <Moon className={`w-3.5 h-3.5 shrink-0 transition-colors ${isDark ? 'text-primary' : 'text-muted-foreground'}`} />
    </label>
  );
}
