import type { FC } from 'react';
import type { Expression } from '../components/BuddySprite.tsx';
import { DragonBody, DragonEyes, type DragonBodyProps, type DragonEyesProps } from './Dragon.tsx';

// ── Sprite registry ───────────────────────────────────────────────────────────
// For species that have dedicated high-quality sprites.
// BuddySprite will use these when available, falling back to generic SVGs.

export interface BodyRegistryProps {
  primary: string;
  belly: string;
  accent: string;
  dark: string;
  light: string;
  outline: string;
  frame: number;
  size: number;
}

export interface EyesRegistryProps {
  eyeColor: string;
  expression: Expression;
  frame: number;
  size: number;
  bodyY: number;
}

export interface SpriteEntry {
  Body: FC<BodyRegistryProps>;
  Eyes: FC<EyesRegistryProps>;
}

export const SPECIES_SPRITES: Record<string, SpriteEntry> = {
  dragon: {
    Body: DragonBody as FC<BodyRegistryProps>,
    Eyes: DragonEyes as FC<EyesRegistryProps>,
  },
};
