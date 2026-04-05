import { useState, useEffect } from 'react';
import { useBuddy, type BuddyBones } from '../hooks/useBuddy.ts';
import { useSessions, type SessionData } from '../hooks/useSessions.ts';
import { AtlasBuddy } from '../components/AtlasBuddy.tsx';
import { RarityBadge } from '../components/RarityBadge.tsx';
import { useT } from '../hooks/useT.ts';
import { useBreakpoint } from '../hooks/useBreakpoint.ts';
import type { TKey } from '../i18n.ts';


interface BuddyStats {
  debugging: number;
  patience: number;
  chaos: number;
  wisdom: number;
  snark: number;
}

const TIER_KEYS: Record<string, TKey> = {
  Hatchling: 'tierHatchling',
  Juvenile:  'tierJuvenile',
  Adult:     'tierAdult',
  Elder:     'tierElder',
  Ancient:   'tierAncient',
};

const STAT_META: Array<{ key: keyof BuddyStats; i18nKey: TKey; icon: string; color: string }> = [
  { key: 'debugging', i18nKey: 'statsDebugging', icon: '🔍', color: '#4a9edb' },
  { key: 'patience',  i18nKey: 'statsPatience',  icon: '🌿', color: '#4caf50' },
  { key: 'chaos',     i18nKey: 'statsChaos',     icon: '🌀', color: '#f44336' },
  { key: 'wisdom',    i18nKey: 'statsWisdom',    icon: '🦉', color: '#9c27b0' },
  { key: 'snark',     i18nKey: 'statsSnark',     icon: '🌶', color: '#ff9800' },
];

const HAT_LABELS: Record<string, string> = {
  none: '—', wizard: '🧙 Mago', cowboy: '🤠 Cowboy',
  crown: '👑 Coroa', party: '🎉 Festa', chef: '👨‍🍳 Chef',
  top: '🎩 Cartola', flower: '🌸 Flor', halo: '😇 Halo',
};

const PEAK_ARCHETYPE: Record<string, { nameKey: TKey; descKey: TKey }> = {
  debugging: { nameKey: 'archetypeDetective', descKey: 'archetypeDetectiveDesc' },
  patience:  { nameKey: 'archetypeWise',      descKey: 'archetypeWiseDesc' },
  chaos:     { nameKey: 'archetypeTrickster', descKey: 'archetypeTricksterDesc' },
  wisdom:    { nameKey: 'archetypeOracle',    descKey: 'archetypeOracleDesc' },
  snark:     { nameKey: 'archetypeCritic',    descKey: 'archetypeCriticDesc' },
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
      <span style={{ fontFamily: 'inherit', fontSize: 12, color: '#666', flexShrink: 0, whiteSpace: 'nowrap' }}>{label}</span>
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

  const rowH = 18;
  const gap = 4;
  const labelW = 28;
  const valueW = 24;
  const totalH = days.length * rowH + (days.length - 1) * gap;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {days.map((d, i) => {
        const pct = max > 0 ? (d.count / max) * 100 : 0;
        const barColor = d.isToday ? '#4a9edb' : d.count > 0 ? '#3a4a8a' : '#1a1a2e';
        const strokeColor = d.isToday ? '#7fd4ff' : d.count > 0 ? '#5a6ab0' : '#2a2a4a';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, height: rowH }}>
            {/* Label do dia */}
            <div style={{
              width: labelW, flexShrink: 0, textAlign: 'right',
              fontFamily: 'inherit', fontSize: 9,
              color: d.isToday ? '#4a9edb' : '#556',
              fontWeight: d.isToday ? 'bold' : 'normal',
            }}>
              {d.label}
            </div>
            {/* Trilha da barra */}
            <div style={{ flex: 1, height: 12, background: '#1a1a2e', border: '1px solid #2a2a4a', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: barColor,
                borderRight: pct > 0 ? `1px solid ${strokeColor}` : 'none',
                transition: 'width 0.5s ease-out',
                minWidth: d.count > 0 ? 3 : 0,
              }} />
            </div>
            {/* Valor */}
            <div style={{
              width: valueW, flexShrink: 0,
              fontFamily: 'monospace', fontSize: 9,
              color: d.isToday ? '#7fd4ff' : d.count > 0 ? '#4a5a8a' : '#2a2a4a',
              textAlign: 'left',
            }}>
              {d.count > 0 ? d.count : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type StatsView = 'all' | 'claude' | 'buddy';

export function Stats() {
  const { data, loading } = useBuddy();
  const { data: sessions } = useSessions();
  const tl = useT();
  const { isMobile } = useBreakpoint();
  const [frame, setFrame] = useState(0);
  const [view, setView] = useState<StatsView>('all');

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

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

  const tierLabel = tl(TIER_KEYS[data.level] ?? 'tierHatchling');

  return (
    <div style={containerStyle}>
      <div style={scrollStyle}>

        {isMobile ? (
          /* ── MOBILE: coluna única ─────────────────────────────────── */
          <>
            {/* Identidade */}
            <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ flexShrink: 0 }}>
                  {bones && <AtlasBuddy bones={bones} size={80} frame={frame} />}
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
                <Row label={tl('statsHat')} value={HAT_LABELS[bones?.hat ?? 'none'] ?? '—'} />
              </div>
              {archetype && (
                <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 10 }}>
                  <div style={{ fontFamily: 'inherit', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{tl('statsArchetype')}</div>
                  <div style={{ fontFamily: 'inherit', fontSize: 14, color: '#c0c8ff', fontWeight: 'bold', marginBottom: 3 }}>{tl(archetype.nameKey)}</div>
                  <div style={{ fontFamily: 'inherit', fontSize: 11, color: '#555', lineHeight: 1.5 }}>{tl(archetype.descKey)}</div>
                </div>
              )}
            </div>
            {/* Atributos */}
            <MobileAttributes bones={bones} peakStat={peakStat} valleyStat={valleyStat} tl={tl} />
            {/* Evolução */}
            <EvolutionCard tierLabel={tierLabel} xpPct={xpPct} data={data} tl={tl} />
            {/* Atividade */}
            {sessions && <ActivityCard sessions={sessions} view={view} setView={setView} isMobile={true} tl={tl} />}
            {/* Personalidade */}
            {soul && (
              <div style={cardStyle}>
                <div style={{ fontFamily: 'inherit', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{tl('statsPersonality')}</div>
                <p style={{ fontFamily: 'inherit', fontSize: 14, color: '#bbb', lineHeight: 1.7, margin: 0 }}>{soul.personality || '—'}</p>
              </div>
            )}
          </>
        ) : (
          /* ── DESKTOP: duas colunas alinhadas ─────────────────────── */
          <div style={{ display: 'flex', gap: 14, alignItems: 'stretch', minHeight: 0 }}>

            {/* Coluna esquerda: Identidade + Evolução */}
            <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Identidade */}
              <div style={{ ...cardStyle, flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div style={{ flexShrink: 0 }}>
                    {bones && <AtlasBuddy bones={bones} size={80} frame={frame} />}
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
                  <Row label={tl('statsHat')} value={HAT_LABELS[bones?.hat ?? 'none'] ?? '—'} />
                </div>

                {archetype && (
                  <div style={{ borderTop: '1px solid #1e1e3a', paddingTop: 10 }}>
                    <div style={{ fontFamily: 'inherit', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{tl('statsArchetype')}</div>
                    <div style={{ fontFamily: 'inherit', fontSize: 14, color: '#c0c8ff', fontWeight: 'bold', marginBottom: 3 }}>{tl(archetype.nameKey)}</div>
                    <div style={{ fontFamily: 'inherit', fontSize: 11, color: '#555', lineHeight: 1.5 }}>{tl(archetype.descKey)}</div>
                  </div>
                )}
              </div>

              {/* Evolução */}
              <EvolutionCard tierLabel={tierLabel} xpPct={xpPct} data={data} tl={tl} />
            </div>

            {/* Coluna direita: Atributos + Atividade + Personalidade */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Atributos */}
              <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontFamily: 'inherit', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tl('statsAttributes')}</div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {bones?.stats && <SpiderChart stats={bones.stats as BuddyStats} size={160} />}
                  <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {bones?.stats && STAT_META.map(m => (
                      <div key={m.key}>
                        <AnimatedBar value={bones.stats[m.key] ?? 0} color={m.color} label={tl(m.i18nKey)} icon={m.icon} />
                        {m.key === peakStat && (
                          <div style={{ fontFamily: 'inherit', fontSize: 9, color: '#4caf50', marginTop: 2, paddingLeft: 26 }}>{tl('statsPico')}</div>
                        )}
                        {m.key === valleyStat && (
                          <div style={{ fontFamily: 'inherit', fontSize: 9, color: '#f44336', marginTop: 2, paddingLeft: 26 }}>{tl('statsVale')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Atividade */}
              {sessions && <ActivityCard sessions={sessions} view={view} setView={setView} isMobile={false} tl={tl} />}

              {/* Personalidade */}
              {soul && (
                <div style={cardStyle}>
                  <div style={{ fontFamily: 'inherit', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{tl('statsPersonality')}</div>
                  <p style={{ fontFamily: 'inherit', fontSize: 14, color: '#bbb', lineHeight: 1.7, margin: 0 }}>{soul.personality || '—'}</p>
                </div>
              )}
            </div>
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
      <span style={{ fontFamily: 'inherit', fontSize: 11, color: '#555', textTransform: 'capitalize' }}>{label}</span>
      <span style={{ fontFamily: 'inherit', fontSize: 11, color: '#888', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function StatChip({ value, label, color, unit = 'sessões', isMobile = false }: { value: number; label: string; color: string; unit?: string; isMobile?: boolean }) {
  return (
    <div style={{
      background: '#0a0a18',
      border: `2px solid ${color}33`,
      padding: isMobile ? '8px 4px' : '12px 8px',
      textAlign: 'center',
      boxShadow: `0 0 12px ${color}0d`,
    }}>
      <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: isMobile ? 14 : 18, color, lineHeight: 1, marginBottom: isMobile ? 4 : 6 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'inherit', fontSize: isMobile ? 8 : 10, color: '#555', textTransform: 'uppercase', lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

// ── Extracted sub-components ───────────────────────────────────────────────────

function EvolutionCard({ tierLabel, xpPct, data, tl }: {
  tierLabel: string; xpPct: number;
  data: { xp: number; xpForNextLevel: number };
  tl: (k: TKey) => string;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontFamily: 'inherit', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>{tl('statsEvolution')}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: 'inherit', fontSize: 13, color: '#aabbff' }}>{tierLabel}</span>
        <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 9, color: '#4a4a8a' }}>{xpPct}%</span>
      </div>
      <div style={{ height: 14, background: '#1a1a2e', border: '2px solid #2a2a4a', boxShadow: '2px 2px 0 #000', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${xpPct}%`, background: 'linear-gradient(to right, #4a4aaa, #8888ff)', transition: 'width 0.8s ease-out' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'inherit', fontSize: 12, color: '#666' }}>{data.xp.toLocaleString('pt-BR')} XP</span>
        <span style={{ fontFamily: 'inherit', fontSize: 12, color: '#444' }}>/{data.xpForNextLevel.toLocaleString('pt-BR')}</span>
      </div>
    </div>
  );
}

function ActivityCard({ sessions, view, setView, isMobile, tl }: {
  sessions: SessionData; view: StatsView; setView: (v: StatsView) => void;
  isMobile: boolean; tl: (k: TKey) => string;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ fontFamily: 'inherit', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>{tl('statsActivity')}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {([
          { v: 'all'    as StatsView, label: tl('statsActivityAll'), activeColor: '#4a4aaa', activeBg: '#1a1a3a' },
          { v: 'claude' as StatsView, label: 'Claude',              activeColor: '#4a9edb', activeBg: '#0a1a2a' },
          { v: 'buddy'  as StatsView, label: 'Buddy',               activeColor: '#e91e63', activeBg: '#2a0a1a' },
        ]).map(({ v, label, activeColor, activeBg }) => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? activeBg : 'transparent',
            border: `1px solid ${view === v ? activeColor : '#2a2a3a'}`,
            color: view === v ? activeColor : '#3a3a5a',
            fontFamily: 'inherit', fontSize: 10, fontWeight: view === v ? 'bold' : 'normal',
            padding: '4px 12px', cursor: 'pointer',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            transition: 'all 0.15s',
          }}>{label}</button>
        ))}
      </div>

      {view === 'all' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 6 : 10, marginBottom: 20 }}>
            <StatChip value={sessions.today}  label={tl('statsSessionsToday')} color="#4caf50" isMobile={isMobile} />
            <StatChip value={sessions.total}  label={tl('statsSessionsTotal')} color="#2196f3" isMobile={isMobile} />
            <StatChip value={sessions.streak} label={tl('statsStreak')} color="#ff9800" unit={tl('statsDays')} isMobile={isMobile} />
          </div>
          <ActivityChart last7Days={sessions.last7Days} />
        </>
      )}
      {view === 'claude' && (
        sessions.claude
          ? <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 6 : 10, marginBottom: 20 }}>
                <StatChip value={sessions.claude.sessionsToday} label={`${tl('statsSessionsLabel')} ${tl('statsSessionsToday')}`} color="#4a9edb" isMobile={isMobile} />
                <StatChip value={sessions.claude.sessionsTotal} label={`${tl('statsSessionsLabel')} ${tl('statsSessionsTotal')}`} color="#2196f3" isMobile={isMobile} />
                <StatChip value={sessions.claude.messagesTotal} label={tl('statsMsgsLabel')} color="#9c27b0" unit="" isMobile={isMobile} />
              </div>
              <ActivityChart last7Days={sessions.claude.last7Days} />
            </>
          : <div style={{ color: '#444', fontFamily: 'inherit', fontSize: 12, padding: '20px 0' }}>{tl('statsNoClaudeData')}</div>
      )}
      {view === 'buddy' && (
        sessions.buddy
          ? <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 6 : 10, marginBottom: 20 }}>
                <StatChip value={sessions.buddy.sessionsToday} label={`${tl('statsByBuddy')} ${tl('statsSessionsToday')}`} color="#e91e63" isMobile={isMobile} />
                <StatChip value={sessions.buddy.sessionsTotal} label={`${tl('statsByBuddy')} ${tl('statsSessionsTotal')}`} color="#c2185b" isMobile={isMobile} />
                <StatChip value={sessions.buddy.messagesTotal} label={tl('statsMsgsLabel')} color="#9c27b0" unit="" isMobile={isMobile} />
              </div>
              <ActivityChart last7Days={sessions.buddy.last7Days} />
            </>
          : <div style={{ color: '#444', fontFamily: 'inherit', fontSize: 12, padding: '20px 0' }}>{tl('statsNoBuddyData')}</div>
      )}
    </div>
  );
}

function MobileAttributes({ bones, peakStat, valleyStat, tl }: {
  bones: BuddyBones | null;
  peakStat: string; valleyStat: string; tl: (k: TKey) => string;
}) {
  if (!bones?.stats) return null;
  return (
    <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: 'inherit', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tl('statsAttributes')}</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
        <SpiderChart stats={bones.stats as BuddyStats} size={130} />
        <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STAT_META.map(m => (
            <div key={m.key}>
              <AnimatedBar value={bones.stats[m.key] ?? 0} color={m.color} label={tl(m.i18nKey)} icon={m.icon} />
              {m.key === peakStat && <div style={{ fontFamily: 'inherit', fontSize: 9, color: '#4caf50', marginTop: 2, paddingLeft: 26 }}>{tl('statsPico')}</div>}
              {m.key === valleyStat && <div style={{ fontFamily: 'inherit', fontSize: 9, color: '#f44336', marginTop: 2, paddingLeft: 26 }}>{tl('statsVale')}</div>}
            </div>
          ))}
        </div>
      </div>
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
