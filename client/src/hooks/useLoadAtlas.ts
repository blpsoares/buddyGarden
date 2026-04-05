import { useState, useEffect } from 'react';
import type { SpriteAtlas } from '../types/sprite.ts';

interface AtlasResult {
  atlas: SpriteAtlas | null;
  image: HTMLImageElement | null;
  loading: boolean;
  error: string | null;
}

// ── Module-level cache ────────────────────────────────────────────────────────
// Persists loaded atlases and images across component remounts.
// After the first fetch, subsequent mounts return data synchronously,
// so AtlasBuddy never needs to show the canvas fallback on revisits.

interface CacheEntry {
  atlas: SpriteAtlas;
  image: HTMLImageElement;
}

const _cache = new Map<string, CacheEntry>();
const _errors = new Map<string, string>();
const _pending = new Map<string, Promise<void>>();

function _load(atlasPath: string, notify: () => void): void {
  if (_cache.has(atlasPath) || _errors.has(atlasPath)) {
    notify();
    return;
  }
  if (_pending.has(atlasPath)) {
    // Already in-flight — attach notification to existing promise
    _pending.get(atlasPath)!.then(notify);
    return;
  }

  const promise = fetch(atlasPath)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<SpriteAtlas>;
    })
    .then(data => new Promise<void>((resolve, reject) => {
      const img = new Image();
      const dir = atlasPath.substring(0, atlasPath.lastIndexOf('/') + 1);
      const imgSrc = data.meta.image.startsWith('http')
        ? data.meta.image
        : dir + data.meta.image.replace(/^\.\//, '');
      img.src = imgSrc;
      img.onload = () => {
        _cache.set(atlasPath, { atlas: data, image: img });
        _pending.delete(atlasPath);
        notify();
        resolve();
      };
      img.onerror = () => {
        const msg = `Failed to load sprite image: ${imgSrc}`;
        _errors.set(atlasPath, msg);
        _pending.delete(atlasPath);
        notify();
        reject(new Error(msg));
      };
    }))
    .catch(e => {
      _errors.set(atlasPath, String(e));
      _pending.delete(atlasPath);
      notify();
    });

  _pending.set(atlasPath, promise);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useLoadAtlas(atlasPath: string | null): AtlasResult {
  const cached = atlasPath ? _cache.get(atlasPath) ?? null : null;
  const cachedError = atlasPath ? (_errors.get(atlasPath) ?? null) : null;

  const [result, setResult] = useState<AtlasResult>({
    atlas: cached?.atlas ?? null,
    image: cached?.image ?? null,
    loading: !cached && !cachedError,
    error: cachedError,
  });

  useEffect(() => {
    if (!atlasPath) return;

    // Already cached — nothing to do
    if (_cache.has(atlasPath) || _errors.has(atlasPath)) return;

    // Kick off load; notify callback triggers a re-render with fresh data
    _load(atlasPath, () => {
      const entry = _cache.get(atlasPath) ?? null;
      const err = _errors.get(atlasPath) ?? null;
      setResult({
        atlas: entry?.atlas ?? null,
        image: entry?.image ?? null,
        loading: false,
        error: err,
      });
    });
  }, [atlasPath]);

  // If path changes, sync result from cache immediately
  useEffect(() => {
    if (!atlasPath) {
      setResult({ atlas: null, image: null, loading: false, error: null });
      return;
    }
    const entry = _cache.get(atlasPath) ?? null;
    const err = _errors.get(atlasPath) ?? null;
    setResult({
      atlas: entry?.atlas ?? null,
      image: entry?.image ?? null,
      loading: !entry && !err,
      error: err,
    });
  }, [atlasPath]);

  return result;
}
