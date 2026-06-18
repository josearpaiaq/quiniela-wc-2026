"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type ConfettiCtx = { trigger: (flag: string) => void };
const PanamaConfettiContext = createContext<ConfettiCtx>({ trigger: () => {} });

export function usePanamaConfetti() {
  return useContext(PanamaConfettiContext);
}

const CONFETTI_COLORS = ["#D21034", "#003893", "#FFFFFF", "#D21034", "#003893"];
const PARTICLE_COUNT = 150;

type Particle = {
  id: number;
  left: number;
  duration: number;
  delay: number;
  drift: number;
  spin: number;
  isEmoji: boolean;
  emoji: string;
  color: string;
  width: number;
  height: number;
  fontSize: number;
};

function generateParticles(flags: string[]): Particle[] {
  const emojis = flags.length > 0 ? flags : ["🎉"];
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    duration: 4800 + Math.random() * 2200,
    delay: Math.random() * 300,
    drift: (Math.random() - 0.5) * 80,
    spin: (Math.random() - 0.5) * 720,
    isEmoji: Math.random() < 0.3,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    width: 6 + Math.random() * 4,
    height: 14 + Math.random() * 6,
    fontSize: 1.2 + Math.random() * 0.8,
  }));
}

function particleStyle(p: Particle): React.CSSProperties {
  const base: Record<string, string | number> = {
    position: "absolute",
    top: 0,
    left: `${p.left}%`,
    animation: `confetti-fall ${p.duration}ms ${p.delay}ms ease-in both`,
    "--confetti-drift": `${p.drift}px`,
    "--confetti-spin": `${p.spin}deg`,
  };
  if (p.isEmoji) {
    base.fontSize = `${p.fontSize}rem`;
    base.lineHeight = 1;
  } else {
    base.width = `${p.width}px`;
    base.height = `${p.height}px`;
    base.backgroundColor = p.color;
    base.borderRadius = "2px";
  }
  return base as React.CSSProperties;
}

function MatchConfetti({ flag }: { flag: string }) {
  const [particles] = useState<Particle[]>(() => generateParticles([flag]));

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none", overflow: "hidden" }}
      aria-hidden
    >
      {particles.map((p) => (
        <span key={p.id} style={particleStyle(p)}>
          {p.isEmoji ? p.emoji : ""}
        </span>
      ))}
    </div>,
    document.body,
  );
}

const MAX_CONCURRENT = 12;

export function PanamaConfettiProvider({ children }: { children: React.ReactNode }) {
  const [instances, setInstances] = useState<{ id: number; flag: string }[]>([]);
  const counterRef = useRef(0);
  const activeCountRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const trigger = useCallback((flag: string) => {
    if (activeCountRef.current >= MAX_CONCURRENT) return;
    const id = ++counterRef.current;
    activeCountRef.current++;
    setInstances((prev) => [...prev, { id, flag }]);
    const t = setTimeout(() => {
      activeCountRef.current--;
      setInstances((prev) => prev.filter((i) => i.id !== id));
      timersRef.current.delete(id);
    }, 8500);
    timersRef.current.set(id, t);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    },
    [],
  );

  return (
    <PanamaConfettiContext.Provider value={{ trigger }}>
      {children}
      {instances.map(({ id, flag }) => (
        <MatchConfetti key={id} flag={flag} />
      ))}
    </PanamaConfettiContext.Provider>
  );
}
