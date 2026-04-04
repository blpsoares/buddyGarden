import { useEffect, useState } from 'react';

interface Props {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
}

const BLOCKS = 10;
const SPEED = 100; // ms por step

export function PixelLoader({ text = 'LOADING', size = 'md', fullScreen = false }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Cicla de 0 a BLOCKS*2 para ter efeito de "fill → empty → fill"
    const t = setInterval(() => setStep(s => (s + 1) % (BLOCKS * 2)), SPEED);
    return () => clearInterval(t);
  }, []);

  const blockPx = size === 'sm' ? 6 : size === 'lg' ? 14 : 9;
  const gap = 2;

  // Quantos blocos acesos: vai de 0→BLOCKS→0 (bounce)
  const lit = step < BLOCKS ? step : BLOCKS * 2 - step;

  const inner = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Barra estilo HP de RPG */}
      <div style={{
        border: `2px solid #2a2a5a`,
        padding: 3,
        background: '#070712',
        boxShadow: '0 0 8px rgba(80,80,200,0.2)',
        imageRendering: 'pixelated',
      }}>
        <div style={{ display: 'flex', gap }}>
          {Array.from({ length: BLOCKS }, (_, i) => {
            const active = i < lit;
            return (
              <div
                key={i}
                style={{
                  width: blockPx,
                  height: Math.round(blockPx * 1.6),
                  background: active
                    ? i < lit * 0.4 ? '#3a9aff'   // azul vibrante início
                    : i < lit * 0.7 ? '#7766ff'   // roxo médio
                    : '#cc66ff'                    // violeta final
                    : '#12122a',
                  boxShadow: active ? '0 0 4px rgba(150,100,255,0.6)' : 'none',
                  transition: 'background 0.05s, box-shadow 0.05s',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Texto LOADING... com cursor piscante */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
        <span style={{
          fontFamily: 'monospace',
          fontSize: size === 'sm' ? 10 : size === 'lg' ? 15 : 12,
          color: '#4a4a8a',
          letterSpacing: '0.18em',
          userSelect: 'none',
        }}>
          {text}
        </span>
        <span style={{
          fontFamily: 'monospace',
          fontSize: size === 'sm' ? 10 : size === 'lg' ? 15 : 12,
          color: '#6666cc',
          animation: 'pixelBlink 0.8s step-start infinite',
        }}>▌</span>
      </div>

      <style>{`
        @keyframes pixelBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#06060f',
        zIndex: 9999,
      }}>
        {inner}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      {inner}
    </div>
  );
}
