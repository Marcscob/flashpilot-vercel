import { useEffect, useRef, useState, useCallback } from "react";
import { useT } from "@/lib/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Play, Pause, RotateCcw, Coffee, BookOpen } from "lucide-react";
import { toast } from "sonner";

type Phase = "work" | "break";

const STORAGE_KEY = "pomodoro-settings-v1";

function loadSettings() {
  if (typeof window === "undefined") return { work: 25, break: 5 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { work: 25, break: 5 };
    const p = JSON.parse(raw);
    return { work: Number(p.work) || 25, break: Number(p.break) || 5 };
  } catch {
    return { work: 25, break: 5 };
  }
}

function playChime() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const start = now + i * 0.18;
      const end = start + 0.35;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.2, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, end);
      o.connect(g).connect(ctx.destination);
      o.start(start);
      o.stop(end + 0.05);
    });
    setTimeout(() => ctx.close(), 2000);
  } catch {
    /* ignore */
  }
}

function TomatoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M12 6c0-2.2-1.2-3.7-3.2-4.5M12 6c.2-2.1 1.5-3.5 3.4-4.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 5.8C7.1 5.8 3.8 9.1 3.8 14c0 4.7 3.1 7.5 8.2 7.5s8.2-2.8 8.2-7.5c0-4.9-3.3-8.2-8.2-8.2Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.1 13.3h15.8M8.3 11v2.3M12 10.2v3.1M15.7 11v2.3M9.6 17.2l2.4-2.1 2.4 2.1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PomodoroTimer() {
  const [settings, setSettings] = useState(loadSettings);
  const [phase, setPhase] = useState<Phase>("work");
  const [remaining, setRemaining] = useState(settings.work * 60);
  const [running, setRunning] = useState(false);
  const [open, setOpen] = useState(false);
  const phaseRef = useRef(phase);
  const settingsRef = useRef(settings);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Persist settings
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  const t = useT();
  const transition = useCallback(() => {
    playChime();
    const nextPhase: Phase = phaseRef.current === "work" ? "break" : "work";
    const nextSecs = (nextPhase === "work" ? settingsRef.current.work : settingsRef.current.break) * 60;
    setPhase(nextPhase);
    setRemaining(nextSecs);
    if (nextPhase === "break") {
      toast.success(t.pomodoro.toastBreakTitle, {
        description: t.pomodoro.toastBreakDesc(settingsRef.current.break),
        duration: 6000,
      });
    } else {
      toast.success(t.pomodoro.toastWorkTitle, {
        description: t.pomodoro.toastWorkDesc(settingsRef.current.work),
        duration: 6000,
      });
    }
  }, [t]);

  // Countdown
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // Fire transition exactly once when remaining hits 0
  useEffect(() => {
    if (!running) return;
    if (remaining > 0) return;
    transition();
  }, [remaining, running, transition]);

  function start() {
    // "Unlock" audio on user gesture (mobile browsers)
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (AC) { const c = new AC(); c.resume?.().finally(() => c.close()); }
    } catch { /* ignore */ }
    setRunning(true);
  }
  function pause() { setRunning(false); }
  function reset() {
    setRunning(false);
    setPhase("work");
    setRemaining(settings.work * 60);
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                className="relative p-2 rounded-lg hover:bg-secondary text-foreground/70 hover:text-foreground inline-flex items-center gap-1.5"
                aria-label={t.pomodoro.label}
              >
                <TomatoIcon className="h-6 w-6" />
                {running && (
                  <span className={`text-xs font-mono tabular-nums ${phase === "work" ? "text-primary" : "text-success"}`}>
                    {mm}:{ss}
                  </span>
                )}
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>{t.pomodoro.label}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {phase === "work" ? <BookOpen className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
              <span>{phase === "work" ? t.pomodoro.work : t.pomodoro.break}</span>
            </div>
            <div className="mt-1 text-5xl font-mono tabular-nums font-semibold">
              {mm}:{ss}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            {!running ? (
              <Button onClick={start} size="sm" className="gap-1">
                <Play className="h-4 w-4" /> {t.pomodoro.start}
              </Button>
            ) : (
              <Button onClick={pause} size="sm" variant="secondary" className="gap-1">
                <Pause className="h-4 w-4" /> {t.pomodoro.pause}
              </Button>
            )}
            <Button onClick={reset} size="sm" variant="ghost" className="gap-1">
              <RotateCcw className="h-4 w-4" /> {t.pomodoro.reset}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <div>
              <Label htmlFor="pomo-work" className="text-xs">{t.pomodoro.studyMin}</Label>
              <Input
                id="pomo-work"
                type="number"
                min={1}
                max={180}
                value={settings.work}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(180, Number(e.target.value) || 1));
                  setSettings((s) => ({ ...s, work: v }));
                  if (!running && phase === "work") setRemaining(v * 60);
                }}
              />
            </div>
            <div>
              <Label htmlFor="pomo-break" className="text-xs">{t.pomodoro.breakMin}</Label>
              <Input
                id="pomo-break"
                type="number"
                min={1}
                max={60}
                value={settings.break}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(60, Number(e.target.value) || 1));
                  setSettings((s) => ({ ...s, break: v }));
                  if (!running && phase === "break") setRemaining(v * 60);
                }}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
