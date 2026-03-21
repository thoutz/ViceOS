import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle, Text, Group } from 'react-konva';
import useImage from 'use-image';
import { useVttStore } from '@/hooks/use-vtt-state';
import { GameMap, Token } from '@workspace/api-client-react';

interface MapCanvasProps {
  map: GameMap | null;
  onTokenMove: (tokenId: string, x: number, y: number) => void;
  isDm: boolean;
}

export function MapCanvas({ map, onTokenMove, isDm }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  
  const { activeTool, selectedTokenId, setSelectedTokenId } = useVttStore();

  const placeholderUrl = `${import.meta.env.BASE_URL}images/map-placeholder.png`;
  const [bgImage] = useImage(map?.imageData || placeholderUrl);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit scale
    if (newScale < 0.2 || newScale > 5) return;
    
    setScale(newScale);
    setPosition({
      x: -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale,
      y: -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale,
    });
  };

  const gridSize = map?.gridConfig?.size || 50;
  const gridWidth = bgImage ? bgImage.width : 2000;
  const gridHeight = bgImage ? bgImage.height : 2000;

  const renderGrid = () => {
    if (!map?.gridConfig?.visible) return null;
    const lines = [];
    for (let i = 0; i <= gridWidth / gridSize; i++) {
      lines.push(
        <Line key={`v-${i}`} points={[Math.round(i * gridSize), 0, Math.round(i * gridSize), gridHeight]} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      );
    }
    for (let j = 0; j <= gridHeight / gridSize; j++) {
      lines.push(
        <Line key={`h-${j}`} points={[0, Math.round(j * gridSize), gridWidth, Math.round(j * gridSize)]} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      );
    }
    return lines;
  };

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0a0a0a] overflow-hidden relative cursor-grab active:cursor-grabbing">
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        scaleX={scale}
        scaleY={scale}
        x={position.x}
        y={position.y}
        draggable={activeTool === 'select'}
        onWheel={handleWheel}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setPosition({ x: e.target.x(), y: e.target.y() });
          }
        }}
      >
        <Layer>
          {bgImage && <KonvaImage image={bgImage} />}
          {renderGrid()}
        </Layer>
        
        <Layer>
          {map?.tokens?.map((token: Token) => (
            <Group
              key={token.id}
              x={token.x}
              y={token.y}
              draggable={isDm}
              onClick={() => setSelectedTokenId(token.id)}
              onDragEnd={(e) => {
                let newX = e.target.x();
                let newY = e.target.y();
                if (map?.gridConfig?.snapToGrid) {
                  newX = Math.round(newX / gridSize) * gridSize;
                  newY = Math.round(newY / gridSize) * gridSize;
                  e.target.position({ x: newX, y: newY });
                }
                onTokenMove(token.id, newX, newY);
              }}
            >
              <Circle
                radius={gridSize / 2 - 2}
                fill={token.color || "#C9A84C"}
                stroke={selectedTokenId === token.id ? "#FFF" : "#000"}
                strokeWidth={selectedTokenId === token.id ? 3 : 2}
                shadowColor="black"
                shadowBlur={5}
                shadowOpacity={0.5}
                offset={{ x: -(gridSize/2), y: -(gridSize/2) }}
              />
              <Text
                text={token.name.substring(0, 2).toUpperCase()}
                fontSize={gridSize / 2.5}
                fontFamily="Cinzel"
                fill="#FFF"
                align="center"
                verticalAlign="middle"
                width={gridSize}
                height={gridSize}
              />
              {/* HP Bar */}
              {token.hp !== undefined && token.maxHp !== undefined && (
                <Rect
                  x={2}
                  y={gridSize - 8}
                  width={(gridSize - 4) * (token.hp / token.maxHp)}
                  height={6}
                  fill={token.hp > (token.maxHp / 2) ? "#4CAF50" : token.hp > (token.maxHp / 4) ? "#FFC107" : "#F44336"}
                  cornerRadius={2}
                />
              )}
            </Group>
          ))}
        </Layer>
      </Stage>
      
      {/* Overlay UI */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 glass-panel p-2 rounded-md">
        <button onClick={() => setScale(s => s * 1.2)} className="w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/20 rounded font-bold">+</button>
        <button onClick={() => setScale(s => s / 1.2)} className="w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/20 rounded font-bold">-</button>
      </div>
    </div>
  );
}
