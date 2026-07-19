"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playChampionCelebration } from "@/lib/sound/celebration";

type ChampionFireworksCtx = { fire: () => void };
const ChampionFireworksContext = createContext<ChampionFireworksCtx>({ fire: () => {} });

export function useChampionFireworks() {
  return useContext(ChampionFireworksContext);
}

const COLORS = ["#ffc63f", "#c6f53f", "#f2f7ee", "#e3a82a", "#dcff70"];
const BURST_ORIGINS = [
  { left: 25, top: 35, delay: 0 },
  { left: 55, top: 25, delay: 0 },
  { left: 75, top: 45, delay: 150 },
  { left: 40, top: 55, delay: 300 },
];
const PARTICLES_PER_BURST = 24;

type Particle = {
  id: number;
  left: number;
  top: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
  delay: number;
};

function generateParticles(): Particle[] {
  const particles: Particle[] = [];
  let id = 0;
  for (const origin of BURST_ORIGINS) {
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const angle = (Math.PI * 2 * i) / PARTICLES_PER_BURST + (Math.random() * 0.3 - 0.15);
      const dist = 90 + Math.random() * 40;
      particles.push({
        id: id++,
        left: origin.left,
        top: origin.top,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        size: 3 + Math.random() * 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: origin.delay,
      });
    }
  }
  return particles;
}

function particleStyle(p: Particle): React.CSSProperties {
  const style: Record<string, string> = {
    position: "absolute",
    left: `${p.left}%`,
    top: `${p.top}%`,
    width: `${p.size}px`,
    height: `${p.size}px`,
    borderRadius: "50%",
    background: p.color,
    boxShadow: `0 0 6px 1px ${p.color}`,
    animation: `firework-burst 1.4s cubic-bezier(0.15, 0.6, 0.4, 1) ${p.delay}ms forwards`,
    "--fw-dx": `${p.dx}px`,
    "--fw-dy": `${p.dy}px`,
  };
  return style as React.CSSProperties;
}

function FireworksBurst() {
  const [particles] = useState<Particle[]>(() => generateParticles());

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none", overflow: "hidden" }}
      aria-hidden
    >
      {particles.map((p) => (
        <span key={p.id} style={particleStyle(p)} />
      ))}
    </div>,
    document.body,
  );
}

/** Waves of bursts, spread out to keep the sky lit for the length of the sound. */
const WAVE_COUNT = 5;
const WAVE_INTERVAL_MS = 1400;
/** Caps how many past bursts stay mounted (invisible once their animation ends) across repeated replays. */
const MAX_MOUNTED_BURSTS = 15;

export function ChampionFireworksProvider({ children }: { children: React.ReactNode }) {
  const [burstIds, setBurstIds] = useState<number[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const fire = useCallback(() => {
    playChampionCelebration();
    for (let wave = 0; wave < WAVE_COUNT; wave++) {
      const timer = setTimeout(() => {
        const id = ++counterRef.current;
        setBurstIds((prev) => [...prev.slice(-(MAX_MOUNTED_BURSTS - 1)), id]);
      }, wave * WAVE_INTERVAL_MS);
      timersRef.current.push(timer);
    }
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach(clearTimeout);
    },
    [],
  );

  return (
    <ChampionFireworksContext.Provider value={{ fire }}>
      {children}
      {burstIds.map((id) => (
        <FireworksBurst key={id} />
      ))}
    </ChampionFireworksContext.Provider>
  );
}

/** Fires once per user per group, the first time the champion is revealed. */
export function ChampionAutoReveal({ groupId }: { groupId: string }) {
  const { fire } = useChampionFireworks();

  useEffect(() => {
    const key = `qm26:champion-seen:${groupId}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
    fire();
    // fire is stable (useCallback with no deps) — this must only run once per groupId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  return null;
}

/**
 * Replays the celebration on demand. Wraps the row's rank icon (rather than
 * adding a new element) so it doesn't compete for space with the ribbon and
 * score breakdown in the top-right corner. Lives inside the row's <Link> —
 * must not navigate.
 */
export function ChampionReplayButton({ children }: { children: React.ReactNode }) {
  const { fire } = useChampionFireworks();
  return (
    <button
      type="button"
      aria-label="Repetir celebración"
      className="transition-transform hover:scale-125 active:scale-95"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        fire();
      }}
    >
      {children}
    </button>
  );
}
