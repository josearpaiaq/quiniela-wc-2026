let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) sharedContext = new Ctor();
  return sharedContext;
}

const WHISTLE_URL = "/sounds/referee-whistle.mp3";
const CROWD_URL = "/sounds/stadium-crowd.mp3";
const CROWD_GAIN = 0.35;
/** The source crowd clip runs 17s — trimmed to a longer sting with a fade-out. */
const CROWD_DURATION = 7.5;
const CROWD_FADE = 1.5;

const bufferCache = new Map<string, Promise<AudioBuffer>>();

function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let cached = bufferCache.get(url);
  if (!cached) {
    cached = fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data));
    bufferCache.set(url, cached);
  }
  return cached;
}

/**
 * Referee whistle layered over a stadium crowd bed for the champion reveal.
 * Buffers are cached after the first successful load, so replays are instant.
 * Fails silently if Web Audio is unavailable, autoplay is blocked, or the
 * files can't be fetched/decoded — the confetti it accompanies doesn't
 * depend on it.
 */
export function playChampionCelebration(): void {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    Promise.all([loadBuffer(ctx, WHISTLE_URL), loadBuffer(ctx, CROWD_URL)])
      .then(([whistleBuffer, crowdBuffer]) => {
        const now = ctx.currentTime;

        const whistle = ctx.createBufferSource();
        whistle.buffer = whistleBuffer;
        whistle.connect(ctx.destination);
        whistle.start(now);

        const crowdGain = ctx.createGain();
        crowdGain.gain.setValueAtTime(CROWD_GAIN, now);
        crowdGain.gain.setValueAtTime(CROWD_GAIN, now + CROWD_DURATION - CROWD_FADE);
        crowdGain.gain.linearRampToValueAtTime(0, now + CROWD_DURATION);

        const crowd = ctx.createBufferSource();
        crowd.buffer = crowdBuffer;
        crowd.connect(crowdGain).connect(ctx.destination);
        crowd.start(now);
        crowd.stop(now + CROWD_DURATION);
      })
      .catch(() => {
        // fetch/decode failed — no-op
      });
  } catch {
    // Web Audio unavailable or blocked — no-op
  }
}
