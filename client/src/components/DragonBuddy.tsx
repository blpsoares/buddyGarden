import { useEffect, useRef, useMemo } from 'react';
import { useLoadAtlas } from '../hooks/useLoadAtlas.ts';
import { useSpriteAnimation } from '../hooks/useSpriteAnimation.ts';
import type { AnimationType } from '../types/sprite.ts';

interface Props {
  size?: number;
  mood?: string;
  isMoving?: boolean;
}

// Seleciona animação baseado no estado atual
function selectAnimation(mood: string, isMoving: boolean): AnimationType {
  if (mood === 'tired') return 'sleep';
  if (isMoving) return 'walk';
  return 'idle';
}

// Renderiza um frame do atlas SEELE no canvas via ctx.drawImage
// O atlas é "packed" (frames trimados com posições variáveis), então
// usamos spriteSourceSize para restaurar o offset correto dentro do sourceSize
function drawAtlasFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frameKey: ReturnType<typeof useSpriteAnimation>,
  scale: number,
  canvasW: number,
  canvasH: number,
) {
  if (!frameKey) return;

  ctx.clearRect(0, 0, canvasW, canvasH);

  const { frame, spriteSourceSize } = frameKey;

  ctx.drawImage(
    img,
    frame.x, frame.y,           // posição do frame no atlas
    frame.w, frame.h,            // tamanho do frame no atlas
    spriteSourceSize.x * scale,  // posição destino (com offset de trim)
    spriteSourceSize.y * scale,
    frame.w * scale,             // tamanho destino escalado
    frame.h * scale,
  );
}

export function DragonBuddy({ size = 200, mood = 'happy', isMoving = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const animation = selectAnimation(mood, isMoving);

  // Pré-carrega os 3 atlas — sem reload quando a animação muda
  const idle  = useLoadAtlas('/sprites/dragon/idle.json');
  const walk  = useLoadAtlas('/sprites/dragon/walk.json');
  const sleep = useLoadAtlas('/sprites/dragon/sleep.json');

  const current = useMemo(() => {
    if (animation === 'walk')  return walk;
    if (animation === 'sleep') return sleep;
    return idle;
  }, [animation, idle, walk, sleep]);

  // FPS por animação: sleep é mais devagar
  const fps = animation === 'sleep' ? 4 : animation === 'walk' ? 10 : 8;
  const currentFrame = useSpriteAnimation(current.atlas, fps);

  // sourceSize é sempre 512x512 nos sprites SEELE
  const sourceSize = currentFrame?.sourceSize.w ?? 512;
  const scale = size / sourceSize;
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !current.image || !currentFrame) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Aplica DPR: canvas físico é maior, scale corrige para CSS pixels
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawAtlasFrame(ctx, current.image, currentFrame, scale, size, size);
  }, [current.image, currentFrame, scale, size, dpr]);

  // Enquanto carrega, mostra placeholder transparente
  const isReady = !!current.image && !!currentFrame;

  return (
    <canvas
      ref={canvasRef}
      width={size * dpr}
      height={size * dpr}
      style={{
        width: size,
        height: size,
        imageRendering: 'pixelated',
        display: 'block',
        opacity: isReady ? 1 : 0,
        transition: 'opacity 0.2s',
      }}
    />
  );
}
