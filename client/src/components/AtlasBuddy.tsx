import { useLayoutEffect, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLoadAtlas } from '../hooks/useLoadAtlas.ts';
import { useSpriteAnimation } from '../hooks/useSpriteAnimation.ts';
import { BuddySprite, type Expression } from './BuddySprite.tsx';
import type { BuddyBones } from '../hooks/useBuddy.ts';
import type { SpriteFrame } from '../types/sprite.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AtlasAnim = 'idle' | 'walkl' | 'walkr' | 'sleep' | 'special' | 'walk';

interface Props {
  bones: Pick<BuddyBones, 'species' | 'isShiny' | 'eye' | 'hat'>;
  size?: number;
  // Atlas animation props
  mood?: string;
  isMoving?: boolean;
  moveDir?: number;
  forceAnim?: AtlasAnim;
  onAnimEnd?: () => void;
  // Canvas fallback props
  frame?: number;
  expression?: Expression;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveAnim(anim: AtlasAnim, moveDir: number): Exclude<AtlasAnim, 'walk'> {
  if (anim === 'walk') return moveDir >= 0 ? 'walkr' : 'walkl';
  return anim;
}

function selectBaseAnim(isMoving: boolean, moveDir: number): Exclude<AtlasAnim, 'walk'> {
  if (isMoving) return moveDir >= 0 ? 'walkr' : 'walkl';
  return 'idle';
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  f: SpriteFrame,
  scale: number,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(
    img,
    f.frame.x, f.frame.y, f.frame.w, f.frame.h,
    f.spriteSourceSize.x * scale, f.spriteSourceSize.y * scale,
    f.frame.w * scale, f.frame.h * scale,
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Renders a pet sprite using a sprite atlas if one exists for the species,
 * falling back to the canvas-drawn BuddySprite otherwise.
 *
 * Strategy: wait for the atlas check to resolve before rendering anything.
 *   loading → empty placeholder (never shows the wrong sprite)
 *   error   → BuddySprite canvas fallback
 *   success → atlas animation
 *
 * After first load, results are cached at the module level in useLoadAtlas,
 * so subsequent mounts skip the loading phase entirely.
 *
 * To add sprites for a new species, just drop the files into:
 *   client/public/sprites/{species}/{idle,walkl,walkr,sleep,special}.{json,webp}
 * No code changes needed.
 */
export function AtlasBuddy({
  bones,
  size = 128,
  mood: _mood = 'happy',
  isMoving = false,
  moveDir = 1,
  forceAnim,
  onAnimEnd,
  frame = 0,
  expression = 'happy',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onAnimEndRef = useRef(onAnimEnd);
  useEffect(() => { onAnimEndRef.current = onAnimEnd; }, [onAnimEnd]);

  const base = `/sprites/${bones.species}`;

  // Load all atlases in parallel. Hooks always called unconditionally.
  // Module-level cache (in useLoadAtlas) means remounts skip the fetch entirely.
  const idleRes    = useLoadAtlas(`${base}/idle.json`);
  const walklRes   = useLoadAtlas(`${base}/walkl.json`);
  const walkrRes   = useLoadAtlas(`${base}/walkr.json`);
  const sleepRes   = useLoadAtlas(`${base}/sleep.json`);
  const specialRes = useLoadAtlas(`${base}/special.json`);

  const hasAtlas = idleRes.atlas !== null && idleRes.error === null;

  const baseAnim = selectBaseAnim(isMoving, moveDir);
  const animation = resolveAnim(forceAnim ?? baseAnim, moveDir);

  const isWalk = animation === 'walkl' || animation === 'walkr';
  const fps = animation === 'sleep' ? 4 : isWalk ? 10 : animation === 'special' ? 12 : 8;

  const handleSpecialEnd = useCallback(() => { onAnimEndRef.current?.(); }, []);

  const idleFrame    = useSpriteAnimation(hasAtlas && animation === 'idle'    ? idleRes.atlas    : null, fps);
  const walklFrame   = useSpriteAnimation(hasAtlas && animation === 'walkl'   ? walklRes.atlas   : null, fps);
  const walkrFrame   = useSpriteAnimation(hasAtlas && animation === 'walkr'   ? walkrRes.atlas   : null, fps);
  const sleepFrame   = useSpriteAnimation(hasAtlas && animation === 'sleep'   ? sleepRes.atlas   : null, fps);
  const specialFrame = useSpriteAnimation(
    hasAtlas && animation === 'special' ? specialRes.atlas : null,
    { fps, loop: false, onComplete: handleSpecialEnd },
  );

  const { image, currentFrame } = useMemo(() => {
    if (!hasAtlas) return { image: null, currentFrame: null };
    if (animation === 'walkl'   && walklRes.image   && walklFrame)   return { image: walklRes.image,   currentFrame: walklFrame };
    if (animation === 'walkr'   && walkrRes.image   && walkrFrame)   return { image: walkrRes.image,   currentFrame: walkrFrame };
    if (animation === 'sleep'   && sleepRes.image   && sleepFrame)   return { image: sleepRes.image,   currentFrame: sleepFrame };
    if (animation === 'special' && specialRes.image && specialFrame) return { image: specialRes.image, currentFrame: specialFrame };
    if (idleRes.image && idleFrame)                                  return { image: idleRes.image,    currentFrame: idleFrame };
    return { image: null, currentFrame: null };
  }, [hasAtlas, animation, walklRes.image, walklFrame, walkrRes.image, walkrFrame, sleepRes.image, sleepFrame, specialRes.image, specialFrame, idleRes.image, idleFrame]);

  const scale = size / (currentFrame?.sourceSize.w ?? 512);
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

  // useLayoutEffect draws before the browser paints, so the canvas is always
  // filled when it first becomes visible — no blank-canvas flash.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || !currentFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    drawFrame(ctx, image, currentFrame, scale);
  }, [image, currentFrame, scale, dpr]);

  // ── Render decision ─────────────────────────────────────────────────────────
  // Wait for the atlas check before showing anything.
  // This prevents the canvas fallback from ever appearing for species that
  // have sprite files — the user sees a brief blank, never the wrong sprite.
  if (idleRes.loading) {
    return <div style={{ width: size, height: size, display: 'inline-block' }} />;
  }

  // Atlas unavailable for this species → permanent canvas fallback.
  if (idleRes.error !== null || !idleRes.atlas) {
    return <BuddySprite bones={bones} frame={frame} size={size} expression={expression} />;
  }

  // Atlas ready → render canvas directly (already drawn by useLayoutEffect above).
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
      }}
    />
  );
}
