import { useState, useEffect } from 'react';
import { useBuddy } from '../hooks/useBuddy.ts';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { RarityBadge } from '../components/RarityBadge.tsx';
import { StatBar } from '../components/StatBar.tsx';

interface SessionData {
  today: number;
  total: number;
  streak: number;
  last7Days: number[];
}

export function Stats() {
  const { data, loading } = useBuddy();
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
      if (res.ok) {
        setSessions((await res.json()) as SessionData);
      }
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div style={centerStyle}>
        <span style={pixelText(9)}>Carregando ficha...</span>
      </div>
    );
  }

  if (!data.bones && !data.soul) {
    return (
      <div style={centerStyle}>
        <span style={pixelText(9)}>Buddy ainda não nasceu...</span>
      </div>
    );
  }

  const { bones, soul } = data;

  // Find peak and valley stats
  let peakStat = '';
  let valleyStat = '';
  let peakVal = -1;
  let valleyVal = 101;

  if (bones?.stats) {
    for (const [k, v] of Object.entries(bones.stats)) {
      if (v > peakVal) { peakVal = v; peakStat = k; }
      if (v < valleyVal) { valleyVal = v; valleyStat = k; }
    }
  }

  const statColors: Record<string, string> = {
    debugging: '#4a9edb',
    patience:  '#4caf50',
    chaos:     '#f44336',
    wisdom:    '#9c27b0',
    snark:     '#ff9800',
  };

  const xpPct = data.xpForNextLevel > data.xpForCurrentLevel
    ? Math.round(((data.xp - data.xpForCurrentLevel) / (data.xpForNextLevel - data.xpForCurrentLevel)) * 100)
    : 100;

  return (
    <div style={containerStyle}>
      <div style={scrollStyle}>
        {/* Header */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {bones && <BuddySprite bones={bones} frame={frame} size={64} />}
            <div style={{ flex: 1 }}>
              <div style={{ ...pixelText(12), marginBottom: '6px' }}>
                {soul?.name ?? bones?.species ?? 'Buddy'}
              </div>
              <div style={{ ...pixelText(8), color: '#aaa', marginBottom: '8px' }}>
                {bones?.species}
              </div>
              {bones && <RarityBadge rarity={bones.rarity} />}
              {bones?.isShiny && (
                <div style={{ ...pixelText(7), color: '#ffd700', marginTop: '6px' }}>
                  ✨ SHINY
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Level / XP */}
        <div style={cardStyle}>
          <div style={{ ...pixelText(8), marginBottom: '12px', color: '#8888cc' }}>
            NIVEL
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={pixelText(10)}>{data.level}</span>
            <span style={{ ...pixelText(8), color: '#888' }}>{xpPct}%</span>
          </div>
          {/* XP bar */}
          <div style={{ height: '12px', background: '#1a1a3a', border: '2px solid #333', boxShadow: '2px 2px 0 #000', position: 'relative', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ height: '100%', width: `${xpPct}%`, background: 'linear-gradient(to right, #4a4aaa, #8888ff)', transition: 'width 0.8s ease-out' }} />
          </div>
          <div style={{ ...pixelText(7), color: '#666' }}>
            {data.xp.toLocaleString()} / {data.xpForNextLevel.toLocaleString()} XP
          </div>
        </div>

        {/* Stats */}
        {bones && (
          <div style={cardStyle}>
            <div style={{ ...pixelText(8), marginBottom: '12px', color: '#8888cc' }}>
              ATRIBUTOS
            </div>
            {Object.entries(bones.stats).map(([key, val]) => (
              <div key={key} style={{ position: 'relative' }}>
                <StatBar
                  label={key.toUpperCase()}
                  value={val}
                  color={statColors[key] ?? '#888'}
                />
                {key === peakStat && (
                  <span style={{ ...pixelText(6), color: '#4caf50', position: 'absolute', right: 0, top: 0 }}>
                    PICO ▲
                  </span>
                )}
                {key === valleyStat && (
                  <span style={{ ...pixelText(6), color: '#f44336', position: 'absolute', right: 0, top: 0 }}>
                    VALE ▼
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Session stats */}
        {sessions && (
          <div style={cardStyle}>
            <div style={{ ...pixelText(8), marginBottom: '12px', color: '#8888cc' }}>
              SESSOES
            </div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <StatChip label="HOJE" value={sessions.today} color="#4caf50" />
              <StatChip label="TOTAL" value={sessions.total} color="#2196f3" />
              <StatChip label="STREAK" value={sessions.streak} color="#ff9800" suffix=" dias" />
            </div>

            {/* Last 7 days bar chart */}
            <div style={{ ...pixelText(7), marginBottom: '8px', color: '#666' }}>
              ULTIMOS 7 DIAS
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '60px' }}>
              {sessions.last7Days.map((count, i) => {
                const maxCount = Math.max(...sessions.last7Days, 1);
                const height = Math.max(4, (count / maxCount) * 56);
                const isToday = i === 6;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: `${height}px`,
                      background: isToday ? '#4a9edb' : '#2a3a6a',
                      border: `2px solid ${isToday ? '#6ab8e8' : '#334'}`,
                      boxShadow: isToday ? '1px 1px 0 #000' : 'none',
                      transition: 'height 0.5s ease-out',
                    }}
                    title={`${count} sessões`}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              {['D-6','D-5','D-4','D-3','D-2','D-1','HOJ'].map((l, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', ...pixelText(5), color: i === 6 ? '#4a9edb' : '#444' }}>
                  {l}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personality */}
        {soul?.personality && (
          <div style={cardStyle}>
            <div style={{ ...pixelText(8), marginBottom: '12px', color: '#8888cc' }}>
              PERSONALIDADE
            </div>
            <p style={{ fontFamily: 'sans-serif', fontSize: '13px', color: '#ccc', lineHeight: '1.6' }}>
              {soul.personality}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value, color, suffix = '' }: { label: string; value: number; color: string; suffix?: string }) {
  return (
    <div style={{
      background: '#1a1a3a',
      border: `2px solid ${color}`,
      boxShadow: '2px 2px 0 #000',
      padding: '8px 12px',
      textAlign: 'center',
    }}>
      <div style={{ ...pixelText(14), color }}>{value}{suffix}</div>
      <div style={{ ...pixelText(6), color: '#888', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  background: '#0d0d1e',
  overflow: 'hidden',
};

const scrollStyle: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const cardStyle: React.CSSProperties = {
  background: '#111',
  border: '2px solid #333',
  boxShadow: '3px 3px 0 #000',
  padding: '16px',
};

const centerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0d0d1e',
};

function pixelText(size: number): React.CSSProperties {
  return {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: `${size}px`,
    color: '#eee',
    display: 'block',
  };
}
