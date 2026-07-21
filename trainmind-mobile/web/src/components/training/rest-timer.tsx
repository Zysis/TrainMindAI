'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Timer, Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';

interface RestTimerProps {
  /** Default rest time in seconds */
  defaultSeconds?: number;
  /** Called when timer finishes */
  onComplete?: () => void;
  /** Compact mode for inline usage */
  compact?: boolean;
}

export function RestTimer({ defaultSeconds = 90, onComplete, compact = false }: RestTimerProps) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Presets comuni per recupero
  const presets = [30, 60, 90, 120, 180];

  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    try {
      // Use Web Audio API for a simple beep
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      // Second beep
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.4);
      }, 400);
    } catch {
      // Audio not supported
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            playBeep();
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, seconds, playBeep, onComplete]);

  const start = (secs?: number) => {
    if (secs) setSeconds(secs);
    setIsRunning(true);
  };

  const pause = () => setIsRunning(false);

  const reset = (secs?: number) => {
    setIsRunning(false);
    setSeconds(secs ?? defaultSeconds);
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = defaultSeconds > 0 ? ((defaultSeconds - seconds) / defaultSeconds) * 100 : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => (isRunning ? pause() : start())}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            isRunning
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : seconds === 0
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          <Timer className="h-3.5 w-3.5" />
          {formatTime(seconds)}
        </button>
        {(isRunning || seconds !== defaultSeconds) && (
          <button
            onClick={() => reset()}
            className="rounded p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Recupero</span>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="rounded p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400"
          title={soundEnabled ? 'Disattiva suono' : 'Attiva suono'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      {/* Timer display */}
      <div className="flex flex-col items-center py-4">
        <div
          className={`text-4xl font-bold tabular-nums ${
            seconds === 0 ? 'text-green-600' : isRunning ? 'text-amber-600' : 'text-slate-900 dark:text-white'
          }`}
        >
          {formatTime(seconds)}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full max-w-48 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              seconds === 0 ? 'bg-green-500' : 'bg-teal-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-2">
        <button
          onClick={() => reset()}
          className="rounded-lg p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 hover:text-slate-600 dark:text-slate-400"
          title="Reset"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          onClick={() => (isRunning ? pause() : start())}
          className={`rounded-xl px-6 py-2.5 font-semibold text-white transition-colors ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-teal-700 hover:bg-teal-800'
          }`}
        >
          {isRunning ? (
            <span className="flex items-center gap-2"><Pause className="h-4 w-4" /> Pausa</span>
          ) : (
            <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Avvia</span>
          )}
        </button>
      </div>

      {/* Presets */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => reset(p)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              defaultSeconds === p && seconds === p && !isRunning
                ? 'bg-teal-100 text-teal-700'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700'
            }`}
          >
            {p >= 60 ? `${p / 60}'` : `${p}"`}
          </button>
        ))}
      </div>
    </div>
  );
}
