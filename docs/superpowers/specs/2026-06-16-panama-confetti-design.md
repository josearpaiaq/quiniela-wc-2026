# Panama Confetti Easter Egg — Design Spec

**Date:** 2026-06-16  
**Status:** Approved

## Overview

An Easter egg animation that shows falling Panama flags and colored confetti when:
1. The user opens the app on a day when Panama has a match.
2. The user taps/clicks the 🇵🇦 flag on any MatchCard where Panama is playing.

The animation is non-blocking: a `pointer-events: none` overlay lets the user interact with the app normally while the confetti plays.

---

## Architecture

Four files are affected:

| File | Change |
|---|---|
| `src/components/panama-confetti.tsx` | **New** — Provider, overlay component, and hook |
| `src/components/team-label.tsx` | Add `onClick` when `code === "PAN"` via the hook |
| `src/app/(app)/quiniela/quiniela-client.tsx` | Wrap JSX in Provider, auto-trigger on mount |
| `src/app/globals.css` | Add `@keyframes confetti-fall` |

---

## Component: `PanamaConfettiProvider` + `PanamaConfetti`

**`src/components/panama-confetti.tsx`** exports three things:

### `PanamaConfettiContext`
```ts
const PanamaConfettiContext = createContext<{ trigger: () => void }>({ trigger: () => {} })
```
Default is a no-op so `usePanamaConfetti()` is safe to call from `TeamLabel` even on pages that don't include the Provider.

### `PanamaConfettiProvider`
- Holds `active: boolean` state.
- Exposes `trigger()` → sets `active = true`.
- After `4500ms`, resets `active = false` (auto-cleanup).
- Renders `{active && <PanamaConfetti />}` alongside `{children}`.

### `PanamaConfetti` (internal)
- Fixed overlay: `position: fixed; inset: 0; z-index: 9999; pointer-events: none`.
- Rendered into `document.body` via `ReactDOM.createPortal`.
- On mount, generates 35 particle descriptors once (random values).
- Each particle is a `<span>` absolutely positioned with inline styles.

### `usePanamaConfetti()`
```ts
export function usePanamaConfetti() {
  return useContext(PanamaConfettiContext)
}
```

---

## Particles

**Total:** 35 particles per trigger.

**Types (randomized per particle):**
- 🇵🇦 emoji (~30% of particles, text size `1.2rem`–`2rem`)
- Colored rectangles (~70%), in Panama flag colors:
  - Red `#D21034`
  - Blue `#003893`
  - White `#FFFFFF`
  - Rectangles are `6px × 14px` to `10px × 20px`, rotated randomly

**Per-particle random values (generated once on mount, stored in `useRef`):**
- `left`: 0–100% (horizontal start position)
- `animationDuration`: 2500–4000ms
- `animationDelay`: 0–600ms
- `rotate`: -45deg to 45deg initial rotation
- `drift`: -30px to 30px horizontal drift (applied via `translateX` in keyframe)

---

## Animation

**`@keyframes confetti-fall`** in `globals.css`:
```css
@keyframes confetti-fall {
  0%   { transform: translateY(-10%) rotate(0deg); opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateY(110vh) rotate(var(--drift-rotate)); opacity: 0; }
}
```

Each particle uses `animation: confetti-fall <duration> <delay> ease-in forwards`.

Horizontal drift is achieved by each particle having a random starting `left` value — the `translateX` component in the keyframe applies a small per-particle drift using a CSS custom property `--drift` set inline.

---

## Auto-trigger (Panama match day detection)

In `QuinielaClient`, inside a `useEffect(() => { ... }, [])`:

```ts
const PAN_MATCH_DAYS = new Set(
  MATCHES
    .filter(m => m.home === "PAN" || m.away === "PAN")
    .map(m => localDateKey(new Date(m.kickoffAt)))
)

const todayKey = localDateKey(new Date())
if (PAN_MATCH_DAYS.has(todayKey)) {
  trigger()
}
```

- `localDateKey` already exists in `quiniela-client.tsx` — reuse it.
- `trigger` comes from `usePanamaConfetti()` called inside `QuinielaClient`, which must be a child of the Provider.
- Fires every page load, no persistence.

---

## Click trigger (TeamLabel)

In `team-label.tsx`, when `code === "PAN"`:
- The flag `<span aria-hidden>` gets an `onClick` handler → calls `trigger()`.
- Add `cursor-pointer` and a subtle `active:scale-95` transition so the tap feels responsive.
- The rest of the component is unchanged.

---

## Panama Match Days (reference)

Derived at runtime from `MATCHES`, not hardcoded. For reference, Panama's group stage matches are:
- Match 21: 2026-06-17 (GHA vs PAN)
- Match 46: 2026-06-23 (PAN vs CRO)
- Match 67: 2026-06-27 (PAN vs ENG)

If Panama advances to knockout rounds, those matches will also be in `MATCHES` with a PAN team code and will be automatically detected.

---

## Constraints

- Zero new npm dependencies.
- The overlay must never block UI interaction (`pointer-events: none`).
- Safe to call `trigger()` multiple times — each call resets the timer and re-renders the overlay.
- `usePanamaConfetti()` returns a no-op when called outside a Provider (no crash on other pages).
