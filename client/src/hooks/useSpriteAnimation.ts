import { useState, useEffect, useRef } from 'react';
import type { SpriteFrame, SpriteAtlas } from '../types/sprite.ts';

interface Options {
  fps?: number;
  loop?: boolean;            // false = play once then stop on last frame
  onComplete?: () => void;   // called when a non-looping animation finishes
}

export function useSpriteAnimation(
  atlas: SpriteAtlas | null,
  fpsOrOptions: number | Options = 8,
): SpriteFrame | null {
  const opts: Options = typeof fpsOrOptions === 'number'
    ? { fps: fpsOrOptions }
    : fpsOrOptions;

  const fps = opts.fps ?? 8;
  const loop = opts.loop ?? true;
  const onComplete = opts.onComplete;

  const frames = atlas ? Object.values(atlas.frames) : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (frames.length === 0) return;
    setCurrentIndex(0);
    doneRef.current = false;

    const interval = setInterval(() => {
      setCurrentIndex(i => {
        const next = i + 1;
        if (next >= frames.length) {
          if (!loop) {
            clearInterval(interval);
            if (!doneRef.current) {
              doneRef.current = true;
              onComplete?.();
            }
            return i; // stay on last frame
          }
          return 0;
        }
        return next;
      });
    }, 1000 / fps);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, fps, loop]);

  if (frames.length === 0) return null;
  return frames[Math.min(currentIndex, frames.length - 1)] ?? null;
}
