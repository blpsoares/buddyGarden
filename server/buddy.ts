import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { SPECIES_LIST, type Species } from './sprites.ts';

// --- RNG ---
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

// --- Types ---
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface BuddyStats {
  debugging: number;
  patience: number;
  chaos: number;
  wisdom: number;
  snark: number;
}

export interface BuddyBones {
  species: Species;
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

// --- Constants ---
const RARITIES: Array<{ name: Rarity; weight: number }> = [
  { name: 'common',    weight: 0.50 },
  { name: 'uncommon',  weight: 0.25 },
  { name: 'rare',      weight: 0.15 },
  { name: 'epic',      weight: 0.08 },
  { name: 'legendary', weight: 0.02 },
];

const EYES = ['·', 'o', '•', '◉', '◎', '✦', '⊙', '◦', '◈', '◉'];
const HATS = ['none', 'wizard', 'cowboy', 'crown', 'party', 'chef', 'top', 'flower', 'halo'];

// --- generateBones ---
export function generateBones(userId: string): BuddyBones {
  const seedStr = userId + 'friend-2026-401';
  const seed = hashString(seedStr);
  const rand = mulberry32(seed);

  // Species
  const speciesIdx = Math.floor(rand() * SPECIES_LIST.length);
  const species = SPECIES_LIST[speciesIdx] as Species;

  // Rarity
  let r = rand();
  let rarity: Rarity = 'common';
  for (const entry of RARITIES) {
    if (r < entry.weight) {
      rarity = entry.name;
      break;
    }
    r -= entry.weight;
  }

  // Eye
  const eyeIdx = Math.floor(rand() * EYES.length);
  const eye = EYES[eyeIdx] ?? '·';

  // Hat
  const hatIdx = Math.floor(rand() * HATS.length);
  const hat = HATS[hatIdx] ?? 'none';

  // Stats (0-100)
  const stats: BuddyStats = {
    debugging: Math.floor(rand() * 101),
    patience:  Math.floor(rand() * 101),
    chaos:     Math.floor(rand() * 101),
    wisdom:    Math.floor(rand() * 101),
    snark:     Math.floor(rand() * 101),
  };

  // Shiny
  const isShiny = rand() < 0.01;

  return { species, rarity, eye, hat, stats, isShiny, seed };
}

// --- Detecta espécie da personality text ---
export function detectSpeciesFromPersonality(personality: string): Species | null {
  const lower = personality.toLowerCase();
  for (const s of SPECIES_LIST) {
    if (lower.includes(s)) return s as Species;
  }
  return null;
}

// --- readSoul ---
export function readSoul(): Soul | null {
  try {
    const raw = readFileSync(join(homedir(), '.claude.json'), 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    const companion = data['companion'] as Record<string, unknown> | undefined;
    if (!companion) return null;
    const name = (companion['name'] as string | undefined) ?? 'Unknown';
    const personality = (companion['personality'] as string | undefined) ?? '';
    return { name, personality };
  } catch {
    return null;
  }
}

// --- readUserId ---
export function readUserId(): string | null {
  try {
    const raw = readFileSync(join(homedir(), '.claude.json'), 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    // Try userID (uppercase) first, then oauthAccount?.id
    const userId = data['userID'] as string | undefined;
    if (userId) return userId;
    const oauth = data['oauthAccount'] as Record<string, unknown> | undefined;
    if (oauth?.['id']) return oauth['id'] as string;
    return null;
  } catch {
    return null;
  }
}
