import { useState, useEffect } from 'react';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type LevelTier = 'Hatchling' | 'Juvenile' | 'Adult' | 'Elder' | 'Ancient';

export interface BuddyStats {
  debugging: number;
  patience: number;
  chaos: number;
  wisdom: number;
  snark: number;
}

export interface BuddyBones {
  species: string;
  rarity: Rarity;
  eye: string;
  hat: string;
  stats: BuddyStats;
  isShiny: boolean;
  seed: number;
}

export interface Soul {
  name: string;
  personality: string;
}

export interface BuddyData {
  bones: BuddyBones | null;
  soul: Soul | null;
  xp: number;
  level: LevelTier;
  levelProgress: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  sessionCount: number;
}

const DEFAULT_DATA: BuddyData = {
  bones: null,
  soul: null,
  xp: 0,
  level: 'Hatchling',
  levelProgress: 0,
  xpForCurrentLevel: 0,
  xpForNextLevel: 100_000,
  sessionCount: 0,
};

// ── Module-level singleton cache ───────────────────────────────────────────────
// Persiste entre remounts de componentes para evitar flash ao trocar de aba.

let _cache: BuddyData = DEFAULT_DATA;
let _loading = true;
let _intervalId: ReturnType<typeof setInterval> | null = null;
const _listeners = new Set<() => void>();

async function _doFetch() {
  try {
    const res = await fetch('/api/buddy');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _cache = (await res.json()) as BuddyData;
  } catch {
    // mantém cache anterior em caso de erro
  } finally {
    _loading = false;
    _listeners.forEach(fn => fn());
  }
}

function _ensurePolling() {
  if (_intervalId !== null) return;
  void _doFetch();
  _intervalId = setInterval(() => { void _doFetch(); }, 10_000);
}

export function useBuddy() {
  const [data, setData] = useState<BuddyData>(_cache);
  const [loading, setLoading] = useState(_loading);

  useEffect(() => {
    const update = () => {
      setData(_cache);
      setLoading(_loading);
    };
    _listeners.add(update);
    _ensurePolling();
    // Aplica cache atual imediatamente caso já tenha sido carregado
    update();
    return () => { _listeners.delete(update); };
  }, []);

  return { data, loading, error: null, refetch: _doFetch };
}
