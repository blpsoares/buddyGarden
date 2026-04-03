import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useLoadAtlas } from '../hooks/useLoadAtlas.ts';
import { useSpriteAnimation } from '../hooks/useSpriteAnimation.ts';
import type { AnimationType } from '../types/sprite.ts';

export type DragonAnim = AnimationType | 'special' | 'walkl' | 'walkr';

interface Props {
  size?: number;
  mood?: string;
  isMoving?: boolean;
  /** Direção do movimento: 1 = direita, -1 = esquerda */
  moveDir?: number;
  /** Override: força uma animação específica */
  forceAnim?: DragonAnim;
  /** Chamado quando uma animação "once" (special) termina */
  onAnimEnd?: () => void;
}

function selectAnimation(isMoving: boolean, moveDir: number): AnimationType | 'walkl' | 'walkr' {
  if (isMoving) return moveDir >= 0 ? 'walkr' : 'walkl';
  return 'idle'; // entre targets: idle neutro; sleep só via forceAnim explícito
}

function drawAtlasFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frameKey: NonNullable<ReturnType<typeof useSpriteAnimation>>,
  scale: number,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const { frame, spriteSourceSize } = frameKey;
  ctx.drawImage(
    img,
    frame.x, frame.y, frame.w, frame.h,
    spriteSourceSize.x * scale, spriteSourceSize.y * scale,
    frame.w * scale, frame.h * scale,
  );
}

export function DragonBuddy({
  size = 200,
  mood = 'happy',
  isMoving = false,
  moveDir = 1,
  forceAnim,
  onAnimEnd,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onAnimEndRef = useRef(onAnimEnd);
  useEffect(() => { onAnimEndRef.current = onAnimEnd; }, [onAnimEnd]);

  const baseAnim = selectAnimation(isMoving, moveDir);
  const animation: DragonAnim = forceAnim ?? baseAnim;

  const idle    = useLoadAtlas('/sprites/dragon/idle.json');
  const walkl   = useLoadAtlas('/sprites/dragon/walkl.json');
  const walkr   = useLoadAtlas('/sprites/dragon/walkr.json');
  const sleep   = useLoadAtlas('/sprites/dragon/sleep.json');
  const special = useLoadAtlas('/sprites/dragon/special.json');

  const handleSpecialEnd = useCallback(() => {
    onAnimEndRef.current?.();
  }, []);

  const { atlas: idleAtlas,    image: idleImg }    = idle;
  const { atlas: walklAtlas,   image: walklImg }   = walkl;
  const { atlas: walkrAtlas,   image: walkrImg }   = walkr;
  const { atlas: sleepAtlas,   image: sleepImg }   = sleep;
  const { atlas: specialAtlas, image: specialImg } = special;

  // FPS por animação
  const isWalk = animation === 'walkl' || animation === 'walkr';
  const fps = animation === 'sleep' ? 4 : isWalk ? 10 : animation === 'special' ? 12 : 8;

  const idleFrame    = useSpriteAnimation(animation === 'idle'    ? idleAtlas    : null, fps);
  const walklFrame   = useSpriteAnimation(animation === 'walkl'   ? walklAtlas   : null, fps);
  const walkrFrame   = useSpriteAnimation(animation === 'walkr'   ? walkrAtlas   : null, fps);
  const sleepFrame   = useSpriteAnimation(animation === 'sleep'   ? sleepAtlas   : null, fps);
  const specialFrame = useSpriteAnimation(
    animation === 'special' ? specialAtlas : null,
    { fps, loop: false, onComplete: handleSpecialEnd },
  );

  const { image, frame: currentFrame } = useMemo(() => {
    if (animation === 'walkl'   && walklImg   && walklFrame)   return { image: walklImg,   frame: walklFrame };
    if (animation === 'walkr'   && walkrImg   && walkrFrame)   return { image: walkrImg,   frame: walkrFrame };
    if (animation === 'sleep'   && sleepImg   && sleepFrame)   return { image: sleepImg,   frame: sleepFrame };
    if (animation === 'special' && specialImg && specialFrame) return { image: specialImg, frame: specialFrame };
    if (idleImg && idleFrame)                                  return { image: idleImg,    frame: idleFrame };
    return { image: null, frame: null };
  }, [animation, walklImg, walklFrame, walkrImg, walkrFrame, sleepImg, sleepFrame, specialImg, specialFrame, idleImg, idleFrame]);

  const sourceSize = currentFrame?.sourceSize.w ?? 512;
  const scale = size / sourceSize;
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !currentFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawAtlasFrame(ctx, image, currentFrame, scale);
  }, [image, currentFrame, scale, dpr]);

  const isReady = !!image && !!currentFrame;

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
        transition: 'opacity 0.3s',
      }}
    />
  );
}
