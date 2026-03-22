import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStageType } from 'konva/lib/Stage';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Text, Group } from 'react-konva';
import useImage from 'use-image';
import { GameMap, Character, type Token } from '@workspace/api-client-react';
import type { InitiativeCombatant } from '@/components/vtt/InitiativeBar';
import {
  Eye,
  EyeOff,
  Grid3X3,
  Ruler,
  MousePointer2,
  Plus,
  Minus,
  UserPlus,
  Trash2,
  ImagePlus,
  CloudFog,
  Square,
  Paintbrush,
  Eraser,
  Pentagon,
} from 'lucide-react';

type KonvaEvent = KonvaEventObject<MouseEvent> & {
  target: KonvaEventObject<MouseEvent>['target'] & {
    getStage(): KonvaStageType;
  };
};

interface MapCanvasProps {
  map: GameMap | null;
  characters: Character[];
  onTokenMove: (mapId: string, tokenId: string, x: number, y: number) => void;
  onFogUpdate: (mapId: string, fogData: FogPayload) => void;
  onTokenPlace?: (mapId: string, token: Token) => void;
  onTokenRemove?: (mapId: string, tokenId: string) => void;
  isDm: boolean;
  /** When set, next place_token click places this combatant on the map */
  placementDraft?: InitiativeCombatant | null;
  onPlacementDraftConsumed?: () => void;
}

type Tool = 'select' | 'fog' | 'measure' | 'place_token';

/** How the DM paints or clears fog */
type FogSubtool =
  | 'add_rect'
  | 'add_brush'
  | 'add_poly'
  | 'clear_rect'
  | 'clear_brush'
  | 'clear_poly';

interface FogRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FogPolygon {
  points: number[];
}

interface FogPayload {
  revealed: FogRect[];
  hidden: FogRect[];
  hiddenPolygons: FogPolygon[];
  revealedPolygons: FogPolygon[];
}

function stampBrushRect(cx: number, cy: number, r: number): FogRect {
  return { x: cx - r, y: cy - r, w: r * 2, h: r * 2 };
}

/** Stamp circles along a segment so the brush leaves no gaps */
function stampsAlongSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  radius: number,
): FogRect[] {
  const dist = Math.hypot(bx - ax, by - ay);
  const step = Math.max(radius * 0.45, 6);
  const n = Math.max(1, Math.ceil(dist / step));
  const out: FogRect[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    out.push(stampBrushRect(x, y, radius));
  }
  return out;
}

function polygonArea(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    a += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(a / 2);
}

const DUNGEON_BG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%230a0a0a"/%3E%3C/svg%3E';

/** Max file size before base64 encoding (~750 KB raw file budget for JSON storage) */
const MAX_TOKEN_IMAGE_BYTES = 750_000;

function useResizeObserver(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return size;
}

export function MapCanvas({
  map,
  characters,
  onTokenMove,
  onFogUpdate,
  onTokenPlace,
  onTokenRemove,
  isDm,
  placementDraft,
  onPlacementDraftConsumed,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: canvasW, height: canvasH } = useResizeObserver(containerRef);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [showFog, setShowFog] = useState(true);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Token placement
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenColor, setNewTokenColor] = useState('#C9A84C');
  const [newTokenHp, setNewTokenHp] = useState('');
  const [newTokenSize, setNewTokenSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [newTokenImageData, setNewTokenImageData] = useState<string | null>(null);
  const [tokenImageError, setTokenImageError] = useState<string | null>(null);
  const tokenImageInputRef = useRef<HTMLInputElement>(null);

  const placementToolSyncRef = useRef(false);
  useEffect(() => {
    if (placementDraft) {
      placementToolSyncRef.current = true;
      setActiveTool('place_token');
    }
  }, [placementDraft?.characterId]);

  useEffect(() => {
    if (!placementDraft) return;
    if (placementToolSyncRef.current) {
      placementToolSyncRef.current = false;
      return;
    }
    if (activeTool !== 'place_token') onPlacementDraftConsumed?.();
  }, [activeTool, placementDraft, onPlacementDraftConsumed]);

  // Fog of war (rects + polygons; brush uses stamped rects / reveal rects)
  const [fogRects, setFogRects] = useState<FogRect[]>([]);
  const [hiddenRects, setHiddenRects] = useState<FogRect[]>([]);
  const [hiddenPolygons, setHiddenPolygons] = useState<FogPolygon[]>([]);
  const [revealedPolygons, setRevealedPolygons] = useState<FogPolygon[]>([]);
  const [fogSubtool, setFogSubtool] = useState<FogSubtool>('add_rect');
  const [fogBrushRadius, setFogBrushRadius] = useState(24);
  const [fogRectDrag, setFogRectDrag] = useState(false);
  const [fogBrushDrag, setFogBrushDrag] = useState(false);
  const [paintStart, setPaintStart] = useState<{ x: number; y: number } | null>(null);
  const [paintCurrent, setPaintCurrent] = useState<{ x: number; y: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[]>([]);
  const [polyCursor, setPolyCursor] = useState<{ x: number; y: number } | null>(null);
  const brushLastRef = useRef<{ x: number; y: number } | null>(null);
  const polygonPointsRef = useRef<{ x: number; y: number }[]>([]);

  const hiddenRectsRef = useRef<FogRect[]>([]);
  const fogRectsRef = useRef<FogRect[]>([]);
  const hiddenPolygonsRef = useRef<FogPolygon[]>([]);
  const revealedPolygonsRef = useRef<FogPolygon[]>([]);
  useEffect(() => {
    hiddenRectsRef.current = hiddenRects;
    fogRectsRef.current = fogRects;
    hiddenPolygonsRef.current = hiddenPolygons;
    revealedPolygonsRef.current = revealedPolygons;
  });
  useEffect(() => {
    polygonPointsRef.current = polygonPoints;
  }, [polygonPoints]);

  // Measurement
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);

  const imageUrl = map?.imageData || '';
  const [bgImage] = useImage(imageUrl);

  const gridSize = map?.gridConfig?.size || 50;
  const cellFeet = map?.gridConfig?.cellFeet || 5;
  const mapW = bgImage ? bgImage.width : Math.max(canvasW, 2000);
  const mapH = bgImage ? bgImage.height : Math.max(canvasH, 2000);
  const tokens: Token[] = (map?.tokens as Token[]) || [];

  const removeSelectedToken = useCallback(() => {
    if (!map || !selectedTokenId) return;
    onTokenRemove?.(map.id, selectedTokenId);
    setSelectedTokenId(null);
  }, [map, selectedTokenId, onTokenRemove]);

  const emitFog = useCallback(() => {
    if (!map) return;
    onFogUpdate(map.id, {
      revealed: [...fogRectsRef.current],
      hidden: [...hiddenRectsRef.current],
      hiddenPolygons: [...hiddenPolygonsRef.current],
      revealedPolygons: [...revealedPolygonsRef.current],
    });
  }, [map, onFogUpdate]);

  const readTokenImageFile = (file: File) => {
    if (file.size > MAX_TOKEN_IMAGE_BYTES) {
      setTokenImageError(`Image too large (max ${Math.round(MAX_TOKEN_IMAGE_BYTES / 1024)} KB)`);
      return;
    }
    setTokenImageError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setNewTokenImageData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // DM: Delete / Backspace removes selected token when Select tool is active (not when typing in inputs)
  useEffect(() => {
    if (!isDm || !selectedTokenId || !map || activeTool !== 'select') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)) {
        return;
      }
      e.preventDefault();
      removeSelectedToken();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDm, selectedTokenId, map, activeTool, removeSelectedToken]);

  // Load fog data from map
  useEffect(() => {
    if (map?.fogData) {
      const fd = map.fogData as {
        hidden?: FogRect[];
        revealed?: FogRect[];
        hiddenPolygons?: FogPolygon[];
        revealedPolygons?: FogPolygon[];
      };
      setHiddenRects(fd.hidden || []);
      setFogRects(fd.revealed || []);
      setHiddenPolygons(fd.hiddenPolygons || []);
      setRevealedPolygons(fd.revealedPolygons || []);
    }
  }, [map?.id]);

  useEffect(() => {
    const polyDraft = activeTool === 'fog' && (fogSubtool === 'add_poly' || fogSubtool === 'clear_poly');
    if (!polyDraft) {
      setPolygonPoints([]);
      setPolyCursor(null);
    }
  }, [activeTool, fogSubtool]);

  const finalizeFogPolygon = useCallback(() => {
    const pts = polygonPointsRef.current;
    if (pts.length < 3 || polygonArea(pts) <= 4) return;
    const flat = pts.flatMap(p => [p.x, p.y]);
    if (fogSubtool === 'add_poly') {
      setHiddenPolygons(prev => {
        const next = [...prev, { points: flat }];
        if (map) {
          onFogUpdate(map.id, {
            revealed: [...fogRectsRef.current],
            hidden: [...hiddenRectsRef.current],
            hiddenPolygons: next,
            revealedPolygons: [...revealedPolygonsRef.current],
          });
        }
        return next;
      });
    } else if (fogSubtool === 'clear_poly') {
      setRevealedPolygons(prev => {
        const next = [...prev, { points: flat }];
        if (map) {
          onFogUpdate(map.id, {
            revealed: [...fogRectsRef.current],
            hidden: [...hiddenRectsRef.current],
            hiddenPolygons: [...hiddenPolygonsRef.current],
            revealedPolygons: next,
          });
        }
        return next;
      });
    }
    setPolygonPoints([]);
    setPolyCursor(null);
  }, [fogSubtool, map, onFogUpdate]);

  // Polygon: Enter = finish, Esc = cancel
  useEffect(() => {
    if (activeTool !== 'fog' || (fogSubtool !== 'add_poly' && fogSubtool !== 'clear_poly')) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPolygonPoints([]);
        setPolyCursor(null);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        finalizeFogPolygon();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTool, fogSubtool, finalizeFogPolygon]);

  const handleWheel = (e: KonvaEventObject<WheelEvent> & { evt: WheelEvent }) => {
    e.evt.preventDefault();
    const stage = (e.target as unknown as { getStage(): KonvaStageType }).getStage();
    const scaleBy = 1.12;
    const oldScale = stage.scaleX();
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const mousePointTo = {
      x: ptr.x / oldScale - stage.x() / oldScale,
      y: ptr.y / oldScale - stage.y() / oldScale,
    };
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clamped = Math.min(5, Math.max(0.15, newScale));
    setScale(clamped);
    setPosition({
      x: -(mousePointTo.x - ptr.x / clamped) * clamped,
      y: -(mousePointTo.y - ptr.y / clamped) * clamped,
    });
  };

  const stageToCanvas = (stage: KonvaStageType) => {
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: (pos.x - position.x) / scale,
      y: (pos.y - position.y) / scale,
    };
  };

  const snapToGrid = (v: number) => Math.round(v / gridSize) * gridSize;

  const snapFogPoint = (pos: { x: number; y: number }) => {
    const snap = map?.gridConfig?.snapToGrid ?? true;
    if (snap) return { x: snapToGrid(pos.x), y: snapToGrid(pos.y) };
    return { x: pos.x, y: pos.y };
  };

  const handleStageMouseDown = (e: KonvaEvent) => {
    if (e.target !== e.target.getStage() && activeTool === 'select') return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stageToCanvas(stage);
    const snapped = snapFogPoint(pos);

    if (isDm && activeTool === 'place_token') {
      if (!map) return;
      const sx = snapToGrid(pos.x);
      const sy = snapToGrid(pos.y);
      if (placementDraft) {
        const sz = placementDraft.tokenSize ?? 'medium';
        const token: Token = {
          id: `token-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: placementDraft.name,
          x: sx,
          y: sy,
          color: placementDraft.tokenColor || '#8B1A1A',
          hp: placementDraft.hp,
          maxHp: placementDraft.maxHp,
          ac: placementDraft.ac,
          characterId: placementDraft.characterId,
          isNpc: true,
          ...(placementDraft.tokenImageData ? { imageData: placementDraft.tokenImageData } : {}),
          ...(sz !== 'medium' ? { tokenSize: sz } : {}),
        };
        onTokenPlace?.(map.id, token);
        onPlacementDraftConsumed?.();
        return;
      }
      if (!newTokenName.trim()) return;
      const hp = newTokenHp ? parseInt(newTokenHp, 10) : undefined;
      const token: Token = {
        id: `token-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: newTokenName.trim(),
        x: sx,
        y: sy,
        color: newTokenColor,
        ...(newTokenImageData ? { imageData: newTokenImageData } : {}),
        ...(newTokenSize !== 'medium' ? { tokenSize: newTokenSize } : {}),
        hp,
        maxHp: hp,
      };
      onTokenPlace?.(map.id, token);
      return;
    }

    if (isDm && activeTool === 'fog' && map) {
      if ((fogSubtool === 'add_poly' || fogSubtool === 'clear_poly') && e.evt.button === 2) {
        e.evt.preventDefault();
        setPolygonPoints(prev => prev.slice(0, -1));
        return;
      }
      if (fogSubtool === 'add_rect' || fogSubtool === 'clear_rect') {
        setFogRectDrag(true);
        setPaintStart({ x: snapped.x, y: snapped.y });
        setPaintCurrent({ x: snapped.x, y: snapped.y });
        return;
      }
      if (fogSubtool === 'add_brush' || fogSubtool === 'clear_brush') {
        setFogBrushDrag(true);
        brushLastRef.current = { x: snapped.x, y: snapped.y };
        const stamp = stampBrushRect(snapped.x, snapped.y, fogBrushRadius);
        if (fogSubtool === 'add_brush') setHiddenRects(prev => [...prev, stamp]);
        else setFogRects(prev => [...prev, stamp]);
        return;
      }
      if (fogSubtool === 'add_poly' || fogSubtool === 'clear_poly') {
        setPolygonPoints(prev => [...prev, snapped]);
        setPolyCursor(snapped);
        return;
      }
    }

    if (activeTool === 'measure') {
      setMeasureStart(pos);
      setMeasureEnd(pos);
    }
  };

  const handleStageMouseMove = (e: KonvaEvent) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stageToCanvas(stage);
    const snapped = snapFogPoint(pos);

    if (isDm && activeTool === 'fog' && (fogSubtool === 'add_poly' || fogSubtool === 'clear_poly')) {
      setPolyCursor(snapped);
    }

    if (fogRectDrag && paintStart) {
      setPaintCurrent(snapped);
    }

    if (
      fogBrushDrag &&
      brushLastRef.current &&
      (fogSubtool === 'add_brush' || fogSubtool === 'clear_brush')
    ) {
      const stamps = stampsAlongSegment(
        brushLastRef.current.x,
        brushLastRef.current.y,
        snapped.x,
        snapped.y,
        fogBrushRadius,
      );
      brushLastRef.current = { x: snapped.x, y: snapped.y };
      if (fogSubtool === 'add_brush') setHiddenRects(prev => [...prev, ...stamps]);
      else setFogRects(prev => [...prev, ...stamps]);
    }

    if (activeTool === 'measure' && measureStart) {
      setMeasureEnd(pos);
    }
  };

  const handleStageMouseUp = (_e: KonvaEvent) => {
    if (fogRectDrag && paintStart && paintCurrent && map) {
      const rect: FogRect = {
        x: Math.min(paintStart.x, paintCurrent.x),
        y: Math.min(paintStart.y, paintCurrent.y),
        w: Math.abs(paintCurrent.x - paintStart.x) + gridSize,
        h: Math.abs(paintCurrent.y - paintStart.y) + gridSize,
      };
      if (rect.w > 0 && rect.h > 0) {
        if (fogSubtool === 'add_rect') {
          setHiddenRects(prev => {
            const next = [...prev, rect];
            onFogUpdate(map.id, {
              revealed: [...fogRectsRef.current],
              hidden: next,
              hiddenPolygons: [...hiddenPolygonsRef.current],
              revealedPolygons: [...revealedPolygonsRef.current],
            });
            return next;
          });
        } else if (fogSubtool === 'clear_rect') {
          setFogRects(prev => {
            const next = [...prev, rect];
            onFogUpdate(map.id, {
              revealed: next,
              hidden: [...hiddenRectsRef.current],
              hiddenPolygons: [...hiddenPolygonsRef.current],
              revealedPolygons: [...revealedPolygonsRef.current],
            });
            return next;
          });
        }
      }
    }
    setFogRectDrag(false);
    setPaintStart(null);
    setPaintCurrent(null);

    if (fogBrushDrag) {
      setFogBrushDrag(false);
      brushLastRef.current = null;
      emitFog();
    }
  };

  const clearFog = () => {
    setHiddenRects([]);
    setFogRects([]);
    setHiddenPolygons([]);
    setRevealedPolygons([]);
    if (map) onFogUpdate(map.id, { revealed: [], hidden: [], hiddenPolygons: [], revealedPolygons: [] });
  };

  const measureDist = () => {
    if (!measureStart || !measureEnd) return null;
    const dx = (measureEnd.x - measureStart.x) / gridSize;
    const dy = (measureEnd.y - measureStart.y) / gridSize;
    const cells = Math.sqrt(dx * dx + dy * dy);
    return (cells * cellFeet).toFixed(1);
  };

  const renderGrid = () => {
    if (!showGrid) return null;
    const lines = [];
    const cols = Math.ceil(mapW / gridSize) + 1;
    const rows = Math.ceil(mapH / gridSize) + 1;
    for (let i = 0; i <= cols; i++) {
      lines.push(<Line key={`v${i}`} points={[i * gridSize, 0, i * gridSize, mapH]} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />);
    }
    for (let j = 0; j <= rows; j++) {
      lines.push(<Line key={`h${j}`} points={[0, j * gridSize, mapW, j * gridSize]} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />);
    }
    return lines;
  };

  const renderFog = () => {
    if (!showFog) return null;
    const fogOpacity = isDm ? 0.55 : 1.0;
    const hidden = hiddenRects.map((r, i) => (
      <Rect
        key={`fog-${i}`}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill={`rgba(0,0,0,${fogOpacity})`}
        listening={false}
      />
    ));
    const hiddenPoly = hiddenPolygons.map((p, i) => (
      <Line
        key={`fog-poly-${i}`}
        points={p.points}
        closed
        fill={`rgba(0,0,0,${fogOpacity})`}
        strokeWidth={0}
        listening={false}
      />
    ));
    const revealed = fogRects.map((r, i) => (
      <Rect
        key={`rev-${i}`}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill="rgba(0,0,0,1)"
        globalCompositeOperation="destination-out"
        listening={false}
      />
    ));
    const revealedPoly = revealedPolygons.map((p, i) => (
      <Line
        key={`rev-poly-${i}`}
        points={p.points}
        closed
        fill="rgba(0,0,0,1)"
        strokeWidth={0}
        globalCompositeOperation="destination-out"
        listening={false}
      />
    ));
    return [...hidden, ...hiddenPoly, ...revealed, ...revealedPoly];
  };

  const renderFogPreview = () => {
    if (!fogRectDrag || !paintStart || !paintCurrent) return null;
    const rx = Math.min(paintStart.x, paintCurrent.x);
    const ry = Math.min(paintStart.y, paintCurrent.y);
    const rw = Math.abs(paintCurrent.x - paintStart.x) + gridSize;
    const rh = Math.abs(paintCurrent.y - paintStart.y) + gridSize;
    const isAdd = fogSubtool === 'add_rect';
    return (
      <Rect
        x={rx} y={ry} width={rw} height={rh}
        fill={isAdd ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,100,0.3)'}
        stroke={isAdd ? '#333' : '#FFD700'}
        strokeWidth={2}
        dash={[8, 4]}
      />
    );
  };

  const renderPolygonDraft = () => {
    if (activeTool !== 'fog' || (fogSubtool !== 'add_poly' && fogSubtool !== 'clear_poly')) return null;
    if (polygonPoints.length === 0 && !polyCursor) return null;
    const pts: number[] = [];
    for (const p of polygonPoints) {
      pts.push(p.x, p.y);
    }
    if (polyCursor && polygonPoints.length > 0) {
      pts.push(polyCursor.x, polyCursor.y);
    }
    const isAdd = fogSubtool === 'add_poly';
    return (
      <>
        {pts.length >= 4 && (
          <Line
            points={pts}
            stroke={isAdd ? 'rgba(200,200,255,0.9)' : 'rgba(255,220,100,0.95)'}
            strokeWidth={2}
            dash={[6, 4]}
          />
        )}
        {polygonPoints.map((p, i) => (
          <Circle key={`pv-${i}`} x={p.x} y={p.y} radius={5} fill={isAdd ? '#AABBFF' : '#FFD700'} stroke="#000" strokeWidth={1} />
        ))}
      </>
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0a0a0a] overflow-hidden relative select-none">
      <Stage
        width={canvasW}
        height={canvasH}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={activeTool === 'select'}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={() => {
          if (fogBrushDrag) {
            setFogBrushDrag(false);
            brushLastRef.current = null;
            emitFog();
          }
          if (fogRectDrag) {
            setFogRectDrag(false);
            setPaintStart(null);
            setPaintCurrent(null);
          }
        }}
        onContextMenu={e => {
          if (isDm && activeTool === 'fog' && (fogSubtool === 'add_poly' || fogSubtool === 'clear_poly')) {
            e.evt.preventDefault();
          }
        }}
        onDragEnd={e => {
          if (e.target === e.target.getStage()) {
            setPosition({ x: e.target.x(), y: e.target.y() });
          }
        }}
        style={{
          cursor:
            activeTool === 'select'
              ? 'grab'
              : activeTool === 'fog'
                ? 'crosshair'
                : activeTool === 'measure'
                  ? 'crosshair'
                  : 'default',
        }}
      >
        {/* Background / Map Image */}
        <Layer>
          {bgImage ? (
            <KonvaImage image={bgImage} width={mapW} height={mapH} />
          ) : (
            <Rect width={mapW} height={mapH} fill="#0D0D0D" />
          )}
          {renderGrid()}
        </Layer>

        {/* Tokens */}
        <Layer>
          {tokens.map(token => (
            <TokenShape
              key={token.id}
              token={token}
              gridSize={gridSize}
              isSelected={selectedTokenId === token.id}
              isDraggable={isDm}
              snapToGrid={map?.gridConfig?.snapToGrid ?? true}
              onSelect={() => setSelectedTokenId(token.id)}
              onDragEnd={(x, y) => {
                if (map) onTokenMove(map.id, token.id, x, y);
              }}
            />
          ))}
        </Layer>

        {/* Fog of war overlay (DM sees it semi-transparent) */}
        <Layer>
          {renderFog()}
          {renderFogPreview()}
        </Layer>

        {/* Polygon draft (vertices + rubber-band line) */}
        {isDm && activeTool === 'fog' && (fogSubtool === 'add_poly' || fogSubtool === 'clear_poly') && (
          <Layer>{renderPolygonDraft()}</Layer>
        )}

        {/* Measurement ruler */}
        {activeTool === 'measure' && measureStart && measureEnd && (
          <Layer>
            <Line
              points={[measureStart.x, measureStart.y, measureEnd.x, measureEnd.y]}
              stroke="#FFD700"
              strokeWidth={2}
              dash={[10, 5]}
            />
            <Circle x={measureStart.x} y={measureStart.y} radius={5} fill="#FFD700" />
            <Circle x={measureEnd.x} y={measureEnd.y} radius={5} fill="#FFD700" />
            {measureDist() && (
              <Text
                x={(measureStart.x + measureEnd.x) / 2 - 30}
                y={(measureStart.y + measureEnd.y) / 2 - 20}
                text={`${measureDist()} ft`}
                fontSize={14}
                fontFamily="Cinzel"
                fill="#FFD700"
                shadowColor="#000"
                shadowBlur={4}
                shadowOpacity={1}
              />
            )}
          </Layer>
        )}
      </Stage>

      {/* Tool Palette */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/90 border border-border rounded-lg px-2 py-1.5 shadow-xl backdrop-blur-sm">
        <ToolButton icon={<MousePointer2 />} label="Select" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
        {isDm && <ToolButton icon={<UserPlus />} label="Place Token" active={activeTool === 'place_token'} onClick={() => setActiveTool('place_token')} className="text-amber-400" />}
        {isDm && (
          <ToolButton
            icon={<CloudFog />}
            label="Fog of war"
            active={activeTool === 'fog'}
            onClick={() => setActiveTool('fog')}
            className="text-slate-300"
          />
        )}
        <ToolButton icon={<Ruler />} label="Measure" active={activeTool === 'measure'} onClick={() => setActiveTool('measure')} />
        <div className="w-px h-6 bg-border mx-1" />
        <ToolButton icon={<Grid3X3 />} label="Grid" active={showGrid} onClick={() => setShowGrid(!showGrid)} />
        {isDm && (
          <ToolButton icon={showFog ? <Eye /> : <EyeOff />} label="Fog" active={showFog} onClick={() => setShowFog(!showFog)} />
        )}
        {isDm &&
          (hiddenRects.length > 0 ||
            fogRects.length > 0 ||
            hiddenPolygons.length > 0 ||
            revealedPolygons.length > 0) && (
          <button
            type="button"
            onClick={clearFog}
            className="text-[10px] font-label text-destructive hover:text-destructive/80 px-1.5 py-0.5 border border-destructive/30 rounded"
            title="Remove all fog overlays (rectangles, polygons, brush strokes)"
          >
            Clear Fog
          </button>
        )}
        {isDm && selectedTokenId && map && activeTool === 'select' && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <button
              type="button"
              onClick={removeSelectedToken}
              className="flex items-center gap-1 text-[10px] font-label text-destructive border border-destructive/40 rounded px-2 py-1 hover:bg-destructive/10 transition-colors"
              title="Remove selected token (Delete)"
            >
              <Trash2 className="w-3 h-3" /> Remove token
            </button>
          </>
        )}
      </div>

      {/* Fog subtools (DM) */}
      {isDm && activeTool === 'fog' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-card/95 border border-slate-500/50 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm flex flex-col gap-2 max-w-[min(96vw,640px)] z-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[10px] font-label font-bold text-slate-300 uppercase tracking-wide">Fog</span>
            <div className="flex items-center gap-0.5 border border-border/60 rounded px-1 py-0.5">
              <span className="text-[9px] text-muted-foreground pr-1">Add</span>
              <button
                type="button"
                title="Cover rectangle — drag on map"
                onClick={() => setFogSubtool('add_rect')}
                className={`p-1.5 rounded ${fogSubtool === 'add_rect' ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Paint fog — brush"
                onClick={() => setFogSubtool('add_brush')}
                className={`p-1.5 rounded ${fogSubtool === 'add_brush' ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <Paintbrush className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Fog polygon — click vertices, then Finish or Enter"
                onClick={() => setFogSubtool('add_poly')}
                className={`p-1.5 rounded ${fogSubtool === 'add_poly' ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <Pentagon className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-0.5 border border-border/60 rounded px-1 py-0.5">
              <span className="text-[9px] text-muted-foreground pr-1">Clear</span>
              <button
                type="button"
                title="Reveal rectangle — drag"
                onClick={() => setFogSubtool('clear_rect')}
                className={`p-1.5 rounded ${fogSubtool === 'clear_rect' ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Eraser brush — reveal"
                onClick={() => setFogSubtool('clear_brush')}
                className={`p-1.5 rounded ${fogSubtool === 'clear_brush' ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Reveal polygon — click vertices, then Finish or Enter"
                onClick={() => setFogSubtool('clear_poly')}
                className={`p-1.5 rounded ${fogSubtool === 'clear_poly' ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
              >
                <Pentagon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {(fogSubtool === 'add_brush' || fogSubtool === 'clear_brush') && (
            <label className="flex items-center gap-2 text-[10px] text-muted-foreground font-label">
              Brush size
              <input
                type="range"
                min={8}
                max={80}
                value={fogBrushRadius}
                onChange={e => setFogBrushRadius(Number(e.target.value))}
                className="w-28 accent-primary"
              />
              <span className="font-mono text-[10px] tabular-nums">{fogBrushRadius}px</span>
            </label>
          )}
          {(fogSubtool === 'add_poly' || fogSubtool === 'clear_poly') && (
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <button
                type="button"
                onClick={finalizeFogPolygon}
                disabled={polygonPoints.length < 3}
                className="font-label text-primary border border-primary/40 rounded px-2 py-1 hover:bg-primary/10 disabled:opacity-40 disabled:pointer-events-none"
              >
                Finish polygon
              </button>
              <span className="italic">
                Click the map for vertices · Enter to finish · Esc clears draft · Right-click removes last vertex
              </span>
            </div>
          )}
          {(fogSubtool === 'add_rect' || fogSubtool === 'clear_rect') && (
            <p className="text-[10px] text-muted-foreground italic">Drag on the map to draw a rectangle aligned to the grid.</p>
          )}
          {(fogSubtool === 'add_brush' || fogSubtool === 'clear_brush') && (
            <p className="text-[10px] text-muted-foreground italic">
              Click and drag to {fogSubtool === 'add_brush' ? 'paint fog' : 'erase fog and reveal the map'}.
            </p>
          )}
        </div>
      )}

      {/* Token Placement Panel (DM only, when place_token tool active) */}
      {isDm && activeTool === 'place_token' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-card/95 border border-amber-500/50 rounded-lg px-4 py-3 shadow-xl backdrop-blur-sm flex items-center gap-3 flex-wrap max-w-[min(96vw,720px)]">
          <input ref={tokenImageInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) readTokenImageFile(f); e.target.value = ''; }} />
          <span className="text-[10px] font-label font-bold text-amber-400 uppercase">Place Token</span>
          {placementDraft && (
            <span className="text-[10px] font-label text-primary border border-primary/40 rounded px-2 py-1 max-w-[200px] truncate" title={placementDraft.name}>
              Placing: {placementDraft.name} · {(placementDraft.tokenSize ?? 'medium').toString()}
            </span>
          )}
          {!placementDraft && (
            <>
              <input
                value={newTokenName}
                onChange={e => setNewTokenName(e.target.value)}
                placeholder="Token name..."
                className="bg-background border border-border rounded px-2 py-1 text-xs font-sans w-32 focus:outline-none focus:border-amber-500/50"
              />
              <label className="flex items-center gap-1 text-[10px] font-label text-muted-foreground">
                Color
                <input type="color" value={newTokenColor} onChange={e => setNewTokenColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
              </label>
              <button
                type="button"
                onClick={() => tokenImageInputRef.current?.click()}
                className="flex items-center gap-1 text-[10px] font-label text-muted-foreground border border-border rounded px-2 py-1 hover:bg-white/5"
                title="Optional portrait (PNG/JPG/WebP)"
              >
                <ImagePlus className="w-3 h-3" /> Image
              </button>
              {newTokenImageData && (
                <>
                  <img src={newTokenImageData} alt="" className="w-8 h-8 rounded-full object-cover border border-border" />
                  <button type="button" onClick={() => { setNewTokenImageData(null); setTokenImageError(null); }} className="text-[10px] text-muted-foreground hover:text-foreground">
                    Clear image
                  </button>
                </>
              )}
              {tokenImageError && <span className="text-[10px] text-destructive">{tokenImageError}</span>}
              <input
                value={newTokenHp}
                onChange={e => setNewTokenHp(e.target.value)}
                placeholder="HP (opt)"
                type="number"
                min={1}
                className="bg-background border border-border rounded px-2 py-1 text-xs font-sans w-20 focus:outline-none focus:border-amber-500/50"
              />
              <div className="flex items-center gap-1 border border-border/60 rounded px-1 py-0.5">
                <span className="text-[9px] text-muted-foreground pr-0.5">Size</span>
                {(['small', 'medium', 'large'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewTokenSize(s)}
                    className={`text-[9px] font-label px-1.5 py-0.5 rounded capitalize ${newTokenSize === s ? 'bg-primary/25 text-primary' : 'text-muted-foreground hover:bg-white/5'}`}
                  >
                    {s[0]}
                  </button>
                ))}
              </div>
            </>
          )}
          <span className="text-[10px] text-muted-foreground italic">Click map to place</span>
          {selectedTokenId && map && (
            <button
              type="button"
              onClick={removeSelectedToken}
              className="flex items-center gap-1 text-[10px] font-label text-destructive border border-destructive/40 rounded px-2 py-1 hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Remove Selected
            </button>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => setScale(s => Math.min(5, s * 1.2))}
          className="w-8 h-8 flex items-center justify-center bg-card/80 border border-border rounded-md text-primary hover:bg-card transition-colors shadow"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="w-8 h-6 flex items-center justify-center bg-card/60 rounded text-[9px] font-mono text-muted-foreground">
          {Math.round(scale * 100)}%
        </div>
        <button
          onClick={() => setScale(s => Math.max(0.15, s / 1.2))}
          className="w-8 h-8 flex items-center justify-center bg-card/80 border border-border rounded-md text-primary hover:bg-card transition-colors shadow"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }}
          className="w-8 h-6 flex items-center justify-center bg-card/80 border border-border rounded text-[9px] font-label text-muted-foreground hover:text-primary transition-colors"
        >
          FIT
        </button>
      </div>

      {/* No map placeholder */}
      {!map && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground pointer-events-none">
          <div className="text-6xl mb-4 opacity-20">🗺</div>
          <div className="font-label text-sm opacity-40">
            {isDm ? 'No map loaded — create one from DM tools' : 'Waiting for the DM to load a map...'}
          </div>
        </div>
      )}

      {/* Measurement info */}
      {activeTool === 'measure' && measureDist() && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card/90 border border-primary/30 text-primary px-3 py-1.5 rounded font-label font-bold text-sm shadow">
          {measureDist()} ft
        </div>
      )}
    </div>
  );
}

function ToolButton({
  icon, label, active, onClick, className = '',
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
        active
          ? 'bg-primary/20 text-primary border border-primary/50'
          : `text-muted-foreground hover:text-foreground hover:bg-white/5 ${className}`
      }`}
    >
      <span className="w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </span>
    </button>
  );
}

/** Clipped portrait or loading/fallback circle + initials */
function TokenFaceContent({
  imageData,
  cx,
  cy,
  radius,
  layoutSize,
  token,
  isSelected,
}: {
  imageData: string;
  cx: number;
  cy: number;
  radius: number;
  layoutSize: number;
  token: Token;
  isSelected: boolean;
}) {
  const [img, status] = useImage(imageData);
  const showImage = status === 'loaded' && img;
  const diam = radius * 2;
  const scale = showImage && img ? Math.max(diam / img.width, diam / img.height) : 0;
  const cover = showImage && img ? { w: img.width * scale, h: img.height * scale } : null;

  return (
    <>
      {!showImage && (
        <>
          <Circle x={cx} y={cy} radius={radius} fill={token.color || '#C9A84C'} listening={false} />
          <Text
            x={0}
            y={0}
            width={layoutSize}
            height={layoutSize}
            text={token.name.substring(0, 2).toUpperCase()}
            fontSize={Math.max(10, layoutSize / 3)}
            fontFamily="Cinzel"
            fontStyle="bold"
            fill={isSelected ? '#FFF' : 'rgba(255,255,255,0.9)'}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </>
      )}
      {showImage && img && cover && (
        <Group
          clipFunc={ctx => {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.closePath();
          }}
        >
          <KonvaImage image={img} x={cx - cover.w / 2} y={cy - cover.h / 2} width={cover.w} height={cover.h} listening={false} />
        </Group>
      )}
    </>
  );
}

function TokenShape({
  token, gridSize, isSelected, isDraggable, snapToGrid: snap, onSelect, onDragEnd,
}: {
  token: Token;
  gridSize: number;
  isSelected: boolean;
  isDraggable: boolean;
  snapToGrid: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const ts = token.tokenSize ?? 'medium';
  const span = ts === 'large' ? 2 : 1;
  const groupPx = span * gridSize;
  const faceDiameter =
    ts === 'large' ? 2 * gridSize - 8 : ts === 'small' ? Math.max(24, gridSize * 0.75) : gridSize - 6;
  const radius = Math.max(4, faceDiameter / 2 - 2);
  const cx = groupPx / 2;
  const cy = groupPx / 2;
  const hpPct = token.hp !== undefined && token.maxHp ? token.hp / token.maxHp : null;
  const hpColor = hpPct === null ? null : hpPct > 0.5 ? '#4CAF50' : hpPct > 0.25 ? '#FFC107' : '#F44336';

  return (
    <Group
      x={token.x}
      y={token.y}
      draggable={isDraggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={e => {
        let nx = e.target.x();
        let ny = e.target.y();
        if (snap) {
          nx = Math.round(nx / gridSize) * gridSize;
          ny = Math.round(ny / gridSize) * gridSize;
          e.target.position({ x: nx, y: ny });
        }
        onDragEnd(nx, ny);
      }}
    >
      {/* Shadow circle */}
      <Circle
        x={cx}
        y={cy + 3}
        radius={radius}
        fill="rgba(0,0,0,0.5)"
      />
      {token.imageData ? (
        <TokenFaceContent
          imageData={token.imageData}
          cx={cx}
          cy={cy}
          radius={radius}
          layoutSize={groupPx}
          token={token}
          isSelected={isSelected}
        />
      ) : (
        <>
          <Circle
            x={cx}
            y={cy}
            radius={radius}
            fill={token.color || '#C9A84C'}
            listening={false}
          />
          <Text
            x={0}
            y={0}
            width={groupPx}
            height={groupPx}
            text={token.name.substring(0, 2).toUpperCase()}
            fontSize={Math.max(10, groupPx / 3)}
            fontFamily="Cinzel"
            fontStyle="bold"
            fill={isSelected ? '#FFF' : 'rgba(255,255,255,0.9)'}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </>
      )}
      {/* Ring highlight */}
      <Circle
        x={cx}
        y={cy}
        radius={radius}
        fill="transparent"
        stroke={isSelected ? '#FFFFFF' : 'rgba(0,0,0,0.8)'}
        strokeWidth={isSelected ? 3 : 1.5}
        shadowColor={isSelected ? '#C9A84C' : 'transparent'}
        shadowBlur={isSelected ? 12 : 0}
        shadowOpacity={0.8}
        listening={false}
      />
      {/* HP bar */}
      {hpPct !== null && (
        <>
          <Rect x={2} y={groupPx - 7} width={groupPx - 4} height={5} fill="rgba(0,0,0,0.5)" cornerRadius={2} listening={false} />
          <Rect x={2} y={groupPx - 7} width={Math.max(0, (groupPx - 4) * hpPct)} height={5} fill={hpColor!} cornerRadius={2} listening={false} />
        </>
      )}
      {/* AC badge (top-left corner) */}
      {token.ac !== undefined && (
        <>
          <Circle x={9} y={9} radius={9} fill="rgba(30,60,120,0.85)" listening={false} />
          <Text
            x={0} y={2} width={18} height={14}
            text={String(token.ac)}
            fontSize={Math.max(7, groupPx / 7)}
            fontFamily="Cinzel"
            fontStyle="bold"
            fill="#FFFFFF"
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}
