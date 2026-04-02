import type { Rarity } from '../hooks/useBuddy.ts';

const RARITY_COLORS: Record<Rarity, string> = {
  common:    '#9e9e9e',
  uncommon:  '#4caf50',
  rare:      '#2196f3',
  epic:      '#9c27b0',
  legendary: '#ff9800',
};

interface Props {
  rarity: Rarity;
  style?: React.CSSProperties;
}

export function RarityBadge({ rarity, style }: Props) {
  const color = RARITY_COLORS[rarity];
  return (
    <span
      style={{
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '7px',
        color,
        border: `2px solid ${color}`,
        padding: '2px 4px',
        boxShadow: `1px 1px 0 #000`,
        background: '#0d0d1a',
        textTransform: 'uppercase',
        ...style,
      }}
    >
      {rarity}
    </span>
  );
}
