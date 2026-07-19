# Celebración del ganador de la quiniela + día de la final

**Fecha:** 2026-07-18
**Estado:** Aprobado

## Problema

Mañana (2026-07-19) se juega la final del Mundial y se cierra la quiniela. La app no
tiene ningún momento de celebración cuando se conoce al ganador del grupo, y no hay
ninguna señal de que hoy/mañana es el día decisivo.

## Alcance

1. Card animado permanente para el/los ganador(es) de cada grupo en `/tabla`.
2. Fuegos artificiales en pantalla completa + sonido, una vez por usuario y grupo,
   al entrar a `/tabla` después de cerrado el torneo. Repetible con un botón de replay.
3. Ticker "HOY ES LA FINAL" arriba del header, visible el día del partido 104.

Fuera de alcance: sonidos en otras acciones (guardar pronóstico, acertar resultado,
etc.), botón de mute, re-disparar el confetti si un resultado se corrige después del
cierre y cambia quién es campeón.

## Torneo cerrado

`/tabla` ya calcula `results.size` sobre 104. `tournamentComplete = results.size === 104`.
Mismo criterio que ya se muestra en pantalla ("104 de 104 resultados oficiales"), sin
lógica nueva.

## Empates

Los criterios de orden hoy son `score.total`, luego `exactos`, luego alfabético
(`displayName`). Un empate "real" es cuando **todos los criterios numéricos** coinciden
— solo el alfabético los separó al ordenar. En ese caso el tratamiento de campeón no
debe caerle solo al primero por orden alfabético.

`championIds`: el conjunto de `user.id` en `standings` cuyo `score.total` y `exactos`
son iguales a los de `standings[0]`. Se computa en `tabla/page.tsx` junto a `standings`.

- La numeración de posiciones (`index + 1`) no cambia — sigue siendo secuencial como hoy.
- El tratamiento visual de campeón (borde, corona, ribbon, confetti interno, botón de
  replay) se aplica a **cada** `<li>` cuyo `user.id` esté en `championIds`, no solo al
  índice 0. Esto solo ocurre cuando `tournamentComplete` es `true` — con el torneo en
  curso, `championIds` no se usa para ningún tratamiento visual.
- El ícono `Medal` (hoy exclusivo del índice 0) se muestra en **todos** los índices
  cuyo `user.id` esté en `championIds` cuando `tournamentComplete`; el resto conserva
  el número de posición como hoy.

## Card de campeón (permanente)

Se aplica cuando `tournamentComplete && championIds.has(user.id)`, sobre el mismo
`<Link href="/tabla/[userId]">` que ya existe — sin duplicar el layout, solo clases
condicionales:

- Borde con gradiente animado dorado↔volt (`champion-border-shift`, en `globals.css`).
- 👑 corona pulsante junto al nombre (`champion-crown-pulse`).
- Ribbon diagonal "CAMPEÓN".
- 10 partículas de confetti cayendo dentro del card, con posiciones/colores/delays
  **fijos** (hardcoded, no `Math.random()`) — el card se renderiza en el servidor y un
  valor aleatorio en cada request rompería la hidratación.
- Barrido de brillo cruzando el card cada ~4s (`champion-shine`).

Todo esto es CSS puro. No requiere componente cliente.

## Fuegos artificiales + sonido

### `src/components/champion-fireworks.tsx` (nuevo)

Provider ligero, scopeado a la página (no global como `ConfettiProvider` — solo se usa
en `/tabla`, no hace falta montarlo en `layout.tsx`):

```ts
const ChampionFireworksContext = createContext<{ fire: () => void }>({ fire: () => {} });
export function useChampionFireworks() { return useContext(ChampionFireworksContext); }

export function ChampionFireworksProvider({ children }: { children: React.ReactNode }) {
  const [burstId, setBurstId] = useState<number | null>(null);
  const fire = useCallback(() => {
    playChampionFanfare();
    setBurstId((n) => (n ?? 0) + 1);
  }, []);
  return (
    <ChampionFireworksContext.Provider value={{ fire }}>
      {children}
      {burstId !== null && <FireworksBurst key={burstId} onDone={() => setBurstId(null)} />}
    </ChampionFireworksContext.Provider>
  );
}
```

- `FireworksBurst`: portal a `document.body`, overlay fijo `pointer-events: none`,
  genera 4 explosiones simultáneas (estilo "show grande" validado en mockup) con
  `Math.cos`/`Math.sin` para las posiciones de cada partícula — 24-26 partículas por
  explosión, colores `#ffc63f` / `#c6f53f` / `#f2f7ee` / `#e3a82a` / `#dcff70`, animadas
  con `firework-burst` (translate + scale + opacity). Se desmonta solo (~1.8s) via
  `onDone`.

**`ChampionAutoReveal`** (se monta una vez en `tabla/page.tsx` cuando
`tournamentComplete && championIds.size > 0`):
- En un `useEffect`, revisa `localStorage["qm26:champion-seen:<groupId>"]`.
- Si no existe: llama a `fire()` y guarda la key.
- El audio puede quedar bloqueado por la política de autoplay del navegador si no hubo
  gesto del usuario justo antes — falla en silencio (`fanfare.ts` atrapa el error), el
  confetti visual no depende del audio.

**`ChampionReplayButton`** (un ícono 🏆 dentro de cada card en `championIds`):
```tsx
<button
  type="button"
  aria-label="Repetir celebración"
  onClick={(e) => { e.preventDefault(); e.stopPropagation(); fire(); }}
  ...
/>
```
`preventDefault`/`stopPropagation` porque vive dentro del `<Link>` de la fila — el resto
del card sigue navegando a `/tabla/[userId]` normalmente, igual que cualquier otra fila
de la tabla. Mismo patrón que la bandera clickeable de `TeamLabel`. Al ser un click
directo del usuario, el audio nunca queda bloqueado por autoplay en este camino.

### `src/lib/sound/fanfare.ts` (nuevo)

`playChampionFanfare()`: arpegio ascendente corto (~1.2s) sintetizado con
`AudioContext` + osciladores y una envolvente de ganancia por nota. Sin archivos de
audio, sin dependencias nuevas. Reutiliza un único `AudioContext` de módulo (creado de
forma perezosa en el primer uso, no en cada llamada) para no exceder el límite de
contextos del navegador. Guardado con `typeof window` (no-op en el servidor) y
`try/catch` (no-op si el navegador bloquea el audio).

## Ticker "HOY ES LA FINAL"

### `src/components/final-day-ticker.tsx` (nuevo)

- Se monta en `layout.tsx`, arriba del `<header>`.
- Mismo patrón de detección por fecha que el Easter egg de Panamá (`localDateKey`): se
  muestra solo cuando la fecha de hoy coincide con la fecha del `kickoffAt` del
  partido 104.
- Texto usa los equipos reales de la final cuando ya están resueltos (reutiliza
  `buildBracket`/`winnerOf`, igual que `bracket-view.tsx`); si aún no están resueltos,
  cae a un texto genérico "🏆 HOY ES LA FINAL DEL MUNDIAL 🏆".
- Franja angosta con texto en marquee (`@keyframes` ya existente en el proyecto no
  cubre esto — se agrega un keyframe de traslación horizontal en `globals.css`).

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `src/app/globals.css` | Nuevos keyframes: `champion-border-shift`, `champion-crown-pulse`, `champion-shine`, `firework-burst`, `final-day-ticker-scroll` |
| `src/app/(app)/tabla/page.tsx` | Calcula `tournamentComplete` y `championIds`; envuelve `<ol>` en `<ChampionFireworksProvider>`; monta `<ChampionAutoReveal>`; aplica clases de campeón + `<ChampionReplayButton>` a cada card en `championIds` |
| `src/components/champion-fireworks.tsx` | **Nuevo** — Provider + hook + `ChampionAutoReveal` + `ChampionReplayButton` + `FireworksBurst` |
| `src/lib/sound/fanfare.ts` | **Nuevo** — fanfarria sintetizada |
| `src/components/final-day-ticker.tsx` | **Nuevo** — ticker de día de la final |
| `src/app/(app)/layout.tsx` | Monta `<FinalDayTicker />` arriba del header |

`src/components/confetti.tsx` no se toca — sigue siendo exclusivo del Easter egg de
banderas por equipo en `TeamLabel`.

## Pruebas

- Unit test para el cálculo de `championIds` en `tabla/page.tsx` (o donde quede la
  lógica de standings): sin empate → solo `standings[0].id`; empate en total y exactos
  → todos los empatados; empate solo en total pero no en exactos → no es empate real.
- Verificación manual: build; abrir `/tabla` con 104/104 resultados cargados (seed o
  datos de prueba) y confirmar fuegos + sonido al entrar la primera vez, silencio en la
  segunda visita, y replay funcional desde el ícono sin navegar a `/tabla/[userId]`.
- Verificación manual del ticker: cambiar la fecha del sistema (o mockear `Date`) al
  2026-07-19 y confirmar que aparece con los nombres de los finalistas.

## Fuera de alcance

- Sonidos en otras acciones del día a día (guardar pronóstico, acertar resultado, etc.).
- Botón de mute.
- Re-disparar el confetti automático si un resultado se corrige después del cierre y
  cambia quién es campeón (el replay manual sigue disponible para cualquiera).
- Renumeración de posiciones cuando hay empate en el #1 — la numeración sigue siendo
  secuencial como hoy.
