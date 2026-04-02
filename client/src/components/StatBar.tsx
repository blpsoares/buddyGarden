import { useEffect, useState } from 'react';

interface Props {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

export function StatBar({ label, value, max = 100, color = '#4a9edb' }: Props) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 100);
    return () => clearTimeout(t);
  }, [value]);

  const pct = Math.round((animated / max) * 100);

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color: '#ccc' }}>
          {label}
        </span>
        <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px', color }}>
          {value}
        </span>
      </div>
      <div
        style={{
          height: '8px',
          background: '#1a1a3a',
          border: '2px solid #333',
          boxShadow: '2px 2px 0 #000',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            transition: 'width 0.6s ease-out',
            boxShadow: `inset 0 0 4px rgba(255,255,255,0.3)`,
          }}
        />
      </div>
    </div>
  );
}
