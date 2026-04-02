import { useState, useEffect } from 'react';
import type { SpriteAtlas } from '../types/sprite.ts';

interface AtlasResult {
  atlas: SpriteAtlas | null;
  image: HTMLImageElement | null;
  loading: boolean;
  error: string | null;
}

export function useLoadAtlas(atlasPath: string | null): AtlasResult {
  const [atlas, setAtlas] = useState<SpriteAtlas | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!atlasPath) return;

    setLoading(true);
    setAtlas(null);
    setImage(null);
    setError(null);

    fetch(atlasPath)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SpriteAtlas>;
      })
      .then(data => {
        setAtlas(data);

        const img = new Image();
        // Resolve image path relative to the atlas JSON
        const dir = atlasPath.substring(0, atlasPath.lastIndexOf('/') + 1);
        const imgSrc = data.meta.image.startsWith('http')
          ? data.meta.image
          : dir + data.meta.image.replace(/^\.\//, '');
        img.src = imgSrc;
        img.onload = () => {
          setImage(img);
          setLoading(false);
        };
        img.onerror = () => {
          setError(`Failed to load sprite image: ${imgSrc}`);
          setLoading(false);
        };
      })
      .catch(e => {
        setError(String(e));
        setLoading(false);
      });
  }, [atlasPath]);

  return { atlas, image, loading, error };
}
