import React, { useState, useEffect, useRef } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStageType } from 'konva/lib/Stage';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Text, Group } from 'react-konva';
import useImage from 'use-image';
import { GameMap, Character } from '@workspace/api-client-react';
import { Eye, EyeOff, Grid3X3, Ruler, MousePointer2, Plus, Minus } from 'lucide-react';

type KonvaEvent = KonvaEventObject<MouseEvent> & {
  target: KonvaEventObject<MouseEvent>['target'] & {
    getStage(): KonvaStageType;
  };
};

interface Token {
  id: string;
  name: string;
  x: number;
  y: number;
  color?: string;
  hp?: number;
  maxHp?: number;
  characterId?: string;
}

interface MapCanvasProps {
  map: GameMap | null;
  characters: Character[];
  onTokenMove: (mapId: string, tokenId: string, x: number, y: number) => void;
  onFogUpdate: (mapId: string, fogData: { revealed: FogRect[]; hidden: FogRect[] }) => void;
  isDm: boolean;
}

type Tool = 'select' | 'fog_add' | 'fog_erase' | 'measure';

interface FogRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const DUNGEON_BG = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%230a0a0a"/%3E%3C/svg%3E';

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

export function MapCanvas({ map, characters, onTokenMove, onFogUpdate, isDm }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { width: canvasW, height: canvasH } = useResizeObserver(containerRef);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [showGrid, setShowGrid] = useState(true);
  const [showFog, setShowFog] = useState(true);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Fog painting
  const [fogRects, setFogRects] = useState<FogRect[]>([]);
  const [hiddenRects, setHiddenRects] = useState<FogRect[]>([]);
  const [isPainting, setIsPainting] = useState(false);
  const [paintStart, setPaintStart] = useState<{ x: number; y: number } | null>(null);
  const [paintCurrent, setPaintCurrent] = useState<{ x: number; y: number } | null>(null);

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

  // Load fog data from map
  useEffect(() => {
    if (map?.fogData) {
      const fd = map.fogData as { hidden?: FogRect[]; revealed?: FogRect[] };
      setHiddenRects(fd.hidden || []);
      setFogRects(fd.revealed || []);
    }
  }, [map?.id]);

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

  const handleStageMouseDown = (e: KonvaEvent) => {
    if (e.target !== e.target.getStage() && activeTool === 'select') return;
    const pos = stageToCanvas(e.target.getStage());

    if (isDm && (activeTool === 'fog_add' || activeTool === 'fog_erase')) {
      setIsPainting(true);
      setPaintStart({ x: snapToGrid(pos.x), y: snapToGrid(pos.y) });
      setPaintCurrent({ x: snapToGrid(pos.x), y: snapToGrid(pos.y) });
    } else if (activeTool === 'measure') {
      setMeasureStart(pos);
      setMeasureEnd(pos);
    }
  };

  const handleStageMouseMove = (e: KonvaEvent) => {
    const pos = stageToCanvas(e.target.getStage());
    if (isPainting && paintStart) {
      setPaintCurrent({ x: snapToGrid(pos.x), y: snapToGrid(pos.y) });
    }
    if (activeTool === 'measure' && measureStart) {
      setMeasureEnd(pos);
    }
  };

  const handleStageMouseUp = (_e: KonvaEvent) => {
    if (isPainting && paintStart && paintCurrent) {
      const rect: FogRect = {
        x: Math.min(paintStart.x, paintCurrent.x),
        y: Math.min(paintStart.y, paintCurrent.y),
        w: Math.abs(paintCurrent.x - paintStart.x) + gridSize,
        h: Math.abs(paintCurrent.y - paintStart.y) + gridSize,
      };
      if (rect.w > 0 && rect.h > 0) {
        if (activeTool === 'fog_add') {
          const newHidden = [...hiddenRects, rect];
          setHiddenRects(newHidden);
          if (map) onFogUpdate(map.id, { revealed: fogRects, hidden: newHidden });
        } else {
          const newRevealed = [...fogRects, rect];
          setFogRects(newRevealed);
          if (map) onFogUpdate(map.id, { revealed: newRevealed, hidden: hiddenRects });
        }
      }
    }
    setIsPainting(false);
    setPaintStart(null);
    setPaintCurrent(null);
  };

  const clearFog = () => {
    setHiddenRects([]);
    setFogRects([]);
    if (map) onFogUpdate(map.id, { revealed: [], hidden: [] });
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
    // DM sees fog semi-transparent (can see beneath it); players see it fully opaque
    const fogOpacity = isDm ? 0.55 : 1.0;
    return hiddenRects.map((r, i) => (
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
  };

  const renderFogPreview = () => {
    if (!isPainting || !paintStart || !paintCurrent) return null;
    const rx = Math.min(paintStart.x, paintCurrent.x);
    const ry = Math.min(paintStart.y, paintCurrent.y);
    const rw = Math.abs(paintCurrent.x - paintStart.x) + gridSize;
    const rh = Math.abs(paintCurrent.y - paintStart.y) + gridSize;
    return (
      <Rect
        x={rx} y={ry} width={rw} height={rh}
        fill={activeTool === 'fog_add' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,100,0.3)'}
        stroke={activeTool === 'fog_add' ? '#333' : '#FFD700'}
        strokeWidth={2}
        dash={[8, 4]}
      />
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
        onDragEnd={e => {
          if (e.target === e.target.getStage()) {
            setPosition({ x: e.target.x(), y: e.target.y() });
          }
        }}
        style={{ cursor: activeTool === 'select' ? 'grab' : activeTool === 'fog_add' ? 'crosshair' : activeTool === 'fog_erase' ? 'cell' : activeTool === 'measure' ? 'crosshair' : 'default' }}
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
        {isDm && <ToolButton icon={<EyeOff />} label="Hide Fog" active={activeTool === 'fog_add'} onClick={() => setActiveTool('fog_add')} className="text-slate-400" />}
        {isDm && <ToolButton icon={<Eye />} label="Reveal Fog" active={activeTool === 'fog_erase'} onClick={() => setActiveTool('fog_erase')} className="text-yellow-400" />}
        <ToolButton icon={<Ruler />} label="Measure" active={activeTool === 'measure'} onClick={() => setActiveTool('measure')} />
        <div className="w-px h-6 bg-border mx-1" />
        <ToolButton icon={<Grid3X3 />} label="Grid" active={showGrid} onClick={() => setShowGrid(!showGrid)} />
        {isDm && (
          <ToolButton icon={showFog ? <Eye /> : <EyeOff />} label="Fog" active={showFog} onClick={() => setShowFog(!showFog)} />
        )}
        {isDm && hiddenRects.length > 0 && (
          <button
            onClick={clearFog}
            className="text-[10px] font-label text-destructive hover:text-destructive/80 px-1.5 py-0.5 border border-destructive/30 rounded"
            title="Clear all fog"
          >
            Clear Fog
          </button>
        )}
      </div>

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
      {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
    </button>
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
  const radius = gridSize / 2 - 3;
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
        x={gridSize / 2}
        y={gridSize / 2 + 3}
        radius={radius}
        fill="rgba(0,0,0,0.5)"
      />
      {/* Main token */}
      <Circle
        x={gridSize / 2}
        y={gridSize / 2}
        radius={radius}
        fill={token.color || '#C9A84C'}
        stroke={isSelected ? '#FFFFFF' : 'rgba(0,0,0,0.8)'}
        strokeWidth={isSelected ? 3 : 1.5}
        shadowColor={isSelected ? '#C9A84C' : 'transparent'}
        shadowBlur={isSelected ? 12 : 0}
        shadowOpacity={0.8}
      />
      {/* Initials */}
      <Text
        x={0}
        y={0}
        width={gridSize}
        height={gridSize}
        text={token.name.substring(0, 2).toUpperCase()}
        fontSize={Math.max(10, gridSize / 3)}
        fontFamily="Cinzel"
        fontStyle="bold"
        fill={isSelected ? '#FFF' : 'rgba(255,255,255,0.9)'}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
      {/* HP bar */}
      {hpPct !== null && (
        <>
          <Rect x={2} y={gridSize - 7} width={gridSize - 4} height={5} fill="rgba(0,0,0,0.5)" cornerRadius={2} listening={false} />
          <Rect x={2} y={gridSize - 7} width={Math.max(0, (gridSize - 4) * hpPct)} height={5} fill={hpColor!} cornerRadius={2} listening={false} />
        </>
      )}
    </Group>
  );
}
