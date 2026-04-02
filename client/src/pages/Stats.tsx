import { useState, useEffect } from 'react';
import { useBuddy } from '../hooks/useBuddy.ts';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { DragonBuddy } from '../components/DragonBuddy.tsx';
import { RarityBadge } from '../components/RarityBadge.tsx';
import { useT } from '../hooks/useT.ts';
import type { BuddyBones } from '../hooks/useBuddy.ts';

interface SessionData {
  today: number;
  total: number;
  streak: number;
  last7Days: number[];
}

interface BuddyStats {
  debugging: number;
  patience: number;
  chaos: number;
  wisdom: number;
  snark: number;
}

const TIER_LABELS: Record<string, string> = {
  Hatchling: '🥚 Hatchling',
  Juvenile:  '🐣 Juvenile',
  Adult:     '🐾 Adult',
  Elder:     '✨ Elder',
  Ancient:   '🌟 Ancient',
};

const STAT_META: Array<{ key: keyof BuddyStats; label: string; icon: string; color: string }> = [
  { key: 'debugging', label: 'Debugging', icon: '🔍', color: '#4a9edb' },
  { key: 'patience',  label: 'Paciência',  icon: '🌿', color: '#4caf50' },
  { key: 'chaos',     label: 'Caos',       icon: '🌀', color: '#f44336' },
  { key: 'wisdom',    label: 'Sabedoria',  icon: '🦉', color: '#9c27b0' },
  { key: 'snark',     label: 'Sarcasmo',   icon: '🌶', color: '#ff9800' },
];

const HAT_LABELS: Record<string, string> = {
  none: '—', wizard: '🧙 Mago', cowboy: '🤠 Cowboy',
  crown: '👑 Coroa', party: '🎉 Festa', chef: '👨‍🍳 Chef',
  top: '🎩 Cartola', flower: '🌸 Flor', halo: '😇 Halo',
};

const PEAK_ARCHETYPE: Record<string, { name: string; desc: string }> = {
  debugging: { name: 'O Detetive',  desc: 'Metódico, preciso, não descansa até encontrar a causa raiz.' },
  patience:  { name: 'O Sábio',     desc: 'Calmo sob pressão, sempre disposto a explicar pela décima vez.' },
  chaos:     { name: 'O Trickster', desc: 'Imprevisível e criativo — quebra padrões por princípio.' },
  wisdom:    { name: 'O Oráculo',   desc: 'Pensa antes de falar, mas quando fala, vale muito ouvir.' },
  snark:     { name: 'O Crítico',   desc: 'Honesto até doer — mas no fundo só quer que o código fique bom.' },
};

// ── Spider Chart ───────────────────────────────────────────────────────────────

function SpiderChart({ stats, size = 160 }: { stats: BuddyStats; size?: number }) {
  const labels = ['Debug', 'Pax', 'Caos', 'Wisdom', 'Snark'];
  const values = [stats.debugging, stats.patience, stats.chaos, stats.wisdom, stats.snark];
  const N = 5;
  const R = size * 0.36;
  const cx = size / 2;
  const cy = size / 2;

  const pts = (scale: number) =>
    Array.from({ length: N }, (_, i) => {
      const a = (2 * Math.PI * i / N) - Math.PI / 2;
      return { x: cx + R * scale * Math.cos(a), y: cy + R * scale * Math.sin(a) };
    });

  const outerPts = pts(1);
  const valuePts = Array.from({ length: N }, (_, i) => {
    const a = (2 * Math.PI * i / N) - Math.PI / 2;
    const r = ((values[i] ?? 0) / 100) * R;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });

  const polyStr = (arr: Array<{ x: number; y: number }>) =>
    arr.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const labelPts = pts(1.32);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map(s => (
        <polygon key={s} points={polyStr(pts(s))}
          fill="none" stroke={s === 1 ? '#2a2a4a' : '#1a1a2e'} strokeWidth={s === 1 ? 1.5 : 1} />
      ))}
      {/* Axes */}
      {outerPts.map((p, i) => (
        <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1e1e3a" strokeWidth={1} />
      ))}
      {/* Value fill */}
      <polygon points={polyStr(valuePts)}
        fill="rgba(74,74,170,0.28)" stroke="#6a6aff" strokeWidth={2} strokeLinejoin="round" />
      {/* Value dots */}
      {valuePts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5}
          fill={STAT_META[i]?.color ?? '#8888ff'} stroke="#000" strokeWidth={1} />
      ))}
      {/* Labels */}
      {labelPts.map((p, i) => (
        <text key={i} x={p.x} y={p.y}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.065} fill="#666" fontFamily="sans-serif">
          {labels[i]}
        </text>
      ))}
    </svg>
  );
}

// ── Animated Bar ───────────────────────────────────────────────────────────────

function AnimatedBar({ value, color, label, icon }: { value: number; color: string; label: string; icon: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 150);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#666', width: 64, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 10, background: '#1a1a2e', border: '1px solid #2a2a4a', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, background: color, transition: 'width 0.7s ease-out' }} />
      </div>
      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555', width: 28, textAlign: 'right', flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}

// ── Activity Sparkline ─────────────────────────────────────────────────────────

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function ActivityChart({ last7Days }: { last7Days: number[] }) {
  const today = new Date();
  const max = Math.max(...last7Days, 1);
  const days = last7Days.map((count, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return { count, label: DAY_LABELS[d.getDay()] ?? '?', isToday: i === 6 };
  });

  // SVG sparkline (área)
  const W = 280, H = 48;
  const pad = 4;
  const barW = (W - pad * 2) / 7;
  const maxH = H - 8;

  return (
    <div>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        {days.map((d, i) => {
          const h = Math.max(3, (d.count / max) * maxH);
          const x = pad + i * barW + barW * 0.1;
          const w = barW * 0.8;
          const y = H - h;
          return (
            <rect key={i} x={x} y={y} width={w} height={h}
              fill={d.isToday ? '#4a9edb' : '#1e2a4a'}
              stroke={d.isToday ? '#6ab8e8' : '#2a3a6a'}
              strokeWidth={1}
            >
              <title>{d.count} sessão{d.count !== 1 ? 'ões' : ''}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: 'flex', width: W }}>
        {days.map((d, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'sans-serif', fontSize: 9,
            color: d.isToday ? '#4a9edb' : '#333',
          }}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function Stats() {
  const { data, loading } = useBuddy();
  const tl = useT();
  const [sessions, setSessions] = useState<SessionData | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void fetchSessions();
    const interval = setInterval(() => { void fetchSessions(); }, 10_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) setSessions((await res.json()) as SessionData);
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div style={centerStyle}>
      <span style={mono(11)}>{tl('statsLoadingBuddy')}</span>
    </div>
  );

  if (!data.bones && !data.soul) return (
    <div style={centerStyle}>
      <span style={mono(11)}>{tl('statsNoBuddy')}</span>
    </div>
  );

  const { bones, soul } = data;
  const isDragon = bones?.species === 'dragon';

  let peakStat = '';
  let valleyStat = '';
  if (bones?.stats) {
    let peakVal = -1, valleyVal = 101;
    for (const [k, v] of Object.entries(bones.stats)) {
      if (v > peakVal) { peakVal = v; peakStat = k; }
      if (v < valleyVal) { valleyVal = v; valleyStat = k; }
    }
  }

  const archetype = PEAK_ARCHETYPE[peakStat];
  const xpPct = data.xpForNextLevel > data.xpForCurrentLevel
    ? Math.round(((data.xp - data.xpForCurrentLevel) / (data.xpForNextLevel - data.xpForCurrentLevel)) * 100)
    : 100;

  const tierLabel = TIER_LABELS[data.level] ?? data.level;

  return (
    <div style={containerStyle}>
      <div style={scrollStyle}>

        {/* ── ROW 1: Identidade + Spider ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

          {/* Coluna esquerda: identidade */}
          <div style={{ ...cardStyle, flex: '0 0 220px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div style={{ flexShrink: 0 }}>
                {bones && (isDragon
                  ? <DragonBuddy size={80} mood="happy" isMoving={false} />
                  : <BuddySprite bones={bones} frame={frame} size={80} />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 13, color: '#eee', marginBottom: 6, wordBreak: 'break-word' }}>
                  {soul?.name ?? bones?.species ?? 'Buddy'}
                </div>
                {bones && <RarityBadge rarity={bones.rarity} />}
                {bones?.isShiny && (
                  <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 7, color: '#ffd700', marginTop: 4, animation: 'shimmer 2s infinite' }}>
                    ✨ SHINY
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Row label={tl('statsSpecies')} value={bones?.species ?? '—'} />
              <Row label={tl('statsRarity')} value={bones?.rarity ?? '—'} />
              <Row label="chapéu" value={HAT_LABELS[bones?.hat ?? 'none'] ?? '—'} />
            </div>

            {archetype && (
              <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 10 }}>
                <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>arquétipo</div>
                <div style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#c0c8ff', fontWeight: 'bold', marginBottom: 3 }}>{archetype.name}</div>
                <div style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#555', lineHeight: 1.5 }}>{archetype.desc}</div>
              </div>
            )}
          </div>

          {/* Coluna direita: spider chart + barras compactas */}
          <div style={{ ...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>atributos</div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              {bones?.stats && <SpiderChart stats={bones.stats as BuddyStats} size={160} />}

              <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {bones?.stats && STAT_META.map(m => (
                  <div key={m.key}>
                    <AnimatedBar
                      value={bones.stats[m.key] ?? 0}
                      color={m.color}
                      label={m.label}
                      icon={m.icon}
                    />
                    {m.key === peakStat && (
                      <div style={{ fontFamily: 'sans-serif', fontSize: 9, color: '#4caf50', marginTop: 2, marginLeft: 88 }}>▲ pico</div>
                    )}
                    {m.key === valleyStat && (
                      <div style={{ fontFamily: 'sans-serif', fontSize: 9, color: '#f44336', marginTop: 2, marginLeft: 88 }}>▼ vale</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 2: Evolução + Atividade ───────────────────────────── */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

          {/* Evolução */}
          <div style={{ ...cardStyle, flex: '0 0 220px' }}>
            <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>evolução</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#aabbff' }}>{tierLabel}</span>
              <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 9, color: '#4a4a8a' }}>{xpPct}%</span>
            </div>

            <div style={{ height: 14, background: '#1a1a2e', border: '2px solid #2a2a4a', boxShadow: '2px 2px 0 #000', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', width: `${xpPct}%`, background: 'linear-gradient(to right, #4a4aaa, #8888ff)', transition: 'width 0.8s ease-out' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#666' }}>{data.xp.toLocaleString('pt-BR')} XP</span>
              <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#444' }}>/{data.xpForNextLevel.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Atividade */}
          {sessions && (
            <div style={{ ...cardStyle, flex: 1 }}>
              <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>atividade</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                <StatChip value={sessions.today}  label={tl('statsSessionsToday')}   color="#4caf50" />
                <StatChip value={sessions.total}  label={tl('statsSessionsTotal')}  color="#2196f3" />
                <StatChip value={sessions.streak} label={tl('statsStreak')} color="#ff9800" unit={tl('statsDays')} />
              </div>

              <ActivityChart last7Days={sessions.last7Days} />
            </div>
          )}
        </div>

        {/* ── ROW 3: Personalidade ──────────────────────────────────── */}
        {soul?.personality && (
          <div style={cardStyle}>
            <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>personalidade</div>
            <p style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#bbb', lineHeight: 1.7, margin: 0 }}>
              {soul.personality}
            </p>
          </div>
        )}

      </div>

      <style>{`
        @keyframes shimmer { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#555', textTransform: 'capitalize' }}>{label}</span>
      <span style={{ fontFamily: 'sans-serif', fontSize: 11, color: '#888', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StatChip({ value, label, color, unit = 'sessões' }: { value: number; label: string; color: string; unit?: string }) {
  return (
    <div style={{
      background: '#0a0a18',
      border: `2px solid ${color}33`,
      padding: '12px 8px',
      textAlign: 'center',
      boxShadow: `0 0 12px ${color}0d`,
    }}>
      <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 18, color, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'sans-serif', fontSize: 10, color: '#555', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  background: '#0d0d1e',
  overflow: 'hidden',
};

const scrollStyle: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  padding: '14px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const cardStyle: React.CSSProperties = {
  background: '#111',
  border: '2px solid #1e1e3a',
  boxShadow: '3px 3px 0 #000',
  padding: '16px',
};

const centerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#0d0d1e',
};

function mono(size: number): React.CSSProperties {
  return { fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color: '#eee' };
}
