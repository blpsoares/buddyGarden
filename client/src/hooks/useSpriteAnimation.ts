import { useState, useEffect } from 'react';
import type { SpriteFrame, SpriteAtlas } from '../types/sprite.ts';

export function useSpriteAnimation(atlas: SpriteAtlas | null, fps = 8): SpriteFrame | null {
  const frames = atlas ? Object.values(atlas.frames) : [];
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (frames.length === 0) return;
    setCurrentIndex(0);
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, fps]);

  if (frames.length === 0) return null;
  return frames[Math.min(currentIndex, frames.length - 1)] ?? null;
}
