# VTT: Fog of war — brush eraser and polygon tools

## Summary

Extended DM fog editing so they can **add** fog and **clear** it using:

- **Rectangle** (grid-aligned drag) — same behavior as before, grouped under Add / Clear.
- **Brush** — stamps overlapping squares along the stroke; **Add** paints dark fog, **Clear** stamps “reveals” (same `destination-out` mechanism as rectangles).
- **Polygon** — click vertices on the map; **Finish polygon** or **Enter** commits; **Esc** clears the draft; **right-click** removes the last vertex.

Fog data persisted on the map JSON now includes optional **`hiddenPolygons`** and **`revealedPolygons`**, each an array of `{ points: number[] }` (flat `[x1,y1,x2,y2,...]` in map coordinates). Existing **`hidden`** / **`revealed`** rectangle arrays are unchanged.

## Files touched

- `artifacts/tavernos/src/components/vtt/MapCanvas.tsx` — unified **Fog** tool (`activeTool === 'fog'`), `FogSubtool` modes, brush stamping (`stampsAlongSegment`), polygon draft layer, `emitFog` / `clearFog` extended for polygons, fog panel UI (no dashboard layout restyle beyond the new panel).
- `artifacts/tavernos/src/hooks/use-socket.ts` — `FogData` + exported `FogPolygon`.
- `artifacts/tavernos/src/pages/session.tsx` — `FogData` type for `handleFogUpdate`.

## Server / API

- No API schema change: `GameMap.fogData` remains a flexible object; `fog_update` socket handler unchanged.

## UX notes

- Toolbar: single **Fog** (cloud) button replaces separate Hide/Reveal toggles; sub-modes live in the panel under the toolbar.
- **Clear Fog** removes rectangles, brush stamps, and all polygons.
- Brush size: 8–80 px slider in the panel.
