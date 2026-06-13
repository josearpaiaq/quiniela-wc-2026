# Propuesta: puntuar partidos de eliminatorias como en fase de grupos

Análisis de costo para extender la regla de puntos por partido (exacto 3 / resultado 1)
a las eliminatorias, que hoy solo puntúan por avance de equipos.

Buena noticia: el costo en código es pequeño — la arquitectura ya lo deja casi listo.
El costo real está en 3 o 4 decisiones de reglas de negocio que hay que tomar primero.

## Costo en código: bajo (~6 archivos, sin tocar la DB)

**DB: cero cambios.** `predictions` y `results` ya guardan marcador para los 104
partidos, incluidas eliminatorias (con `winnerSide` para empates). No hay migración ni
captura nueva.

**Motor (`scoring.ts`): el cambio central, ~15 líneas.** Hoy el loop de puntos por
partido solo itera `GROUP_MATCHES`; habría que extenderlo a todos los partidos (o un
segundo loop para eliminatorias). La función `groupMatchPoints` funciona tal cual para
el marcador a 90' — el empate es un resultado válido a los 90, así que la comparación
de signo (1X2) no necesita cambios. Renombrar `groupPoints`/`groupPointsByMatch` en
`UserScore` (`types.ts`) a algo como `matchPoints`.

**UI: principalmente quitar restricciones, no agregar lógica.** Dato curioso: el
cliente **ya calcula** los puntos por partido para eliminatorias —
`quiniela-client.tsx:150` pasa `groupMatchPoints(prediction, real)` para *cualquier*
fase; es `match-card.tsx:133` quien lo oculta con la condición `phase === "group"`.
Lo mismo en `/partido/[matchId]/page.tsx:89` (`scoresPoints = match.phase === "group"
&& real`). Quitar ambas condiciones y ajustar etiquetas del desglose en `/tabla` y
`/tabla/[userId]`.

**Tests y docs:** actualizar `scoring.test.ts` con casos de eliminatorias, y
`docs/list-of-rules.md` + la sección §6.3 de `docs/arquitectura-tecnica.md`.

## Costo en lógica de negocio: aquí está lo caro

Decisiones que el código no puede tomar solo:

1. **¿Puntúa aunque los equipos no coincidan?** Es LA pregunta. Tu pronóstico del
   partido 89 es para *tu* cruce (ej. BRA–GER), pero el real puede ser ARG–FRA. En fase
   de grupos este problema no existe (equipos fijos). La regla clásica de quiniela es
   "predices el marcador del partido 89, juegue quien juegue" — y es lo que la vista
   `/partido` ya asume al comparar a todos contra el slot real. Recomendación: esa.
   La alternativa ("solo puntúa si acertaste el cruce") es más código y castiga doble,
   porque acertar equipos ya lo premian los puntos de avance.

2. **¿El `winnerSide` cuenta para el "exacto"?** Si dos usuarios predicen 1-1 pero
   distinto ganador en penales, ¿ambos llevan 3? Sugerencia: exacto = marcador a 90'
   solamente; quién avanza ya se premia vía puntos de avance. Así no se toca nada más.

3. **¿El tercer puesto ahora puntúa?** Hoy está excluido de todo. Si la regla es "como
   grupos", lo natural es que sí gane puntos por partido (seguiría sin dar puntos de
   avance, que ahí no aplican).

4. **Inflación de puntos.** Hoy el máximo es ~216 de grupos + 124 de avance. Agregar
   3 pts × 32-33 partidos de eliminatorias mete hasta ~99 puntos más, concentrados al
   final del torneo — las remontadas en la tabla se vuelven más probables. Puede ser
   justo lo que se busca, pero conviene decidir conscientemente si se rebalancea
   `ROUND_VALUES` o se deja.

5. **Si el torneo ya empezó cuando se cambie**: el recálculo es retroactivo automático
   (nada se persiste), lo cual es técnicamente gratis pero socialmente delicado —
   cambiar reglas de puntuación a mitad de quiniela hay que anunciarlo a los jugadores.

## Resumen

Una tarde de trabajo en código incluyendo tests; lo que merece discusión son los puntos
1, 2 y 4. Decididas esas reglas, la implementación es directa.
