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

export function useBuddy() {
  const [data, setData] = useState<BuddyData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchBuddy() {
    try {
      const res = await fetch('/api/buddy');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BuddyData;
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchBuddy();
    const interval = setInterval(() => { void fetchBuddy(); }, 10_000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error, refetch: fetchBuddy };
}
