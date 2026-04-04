import { useState } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  petName: string;
  command: string;
  onAllow: () => void;
  onDeny: () => void;
  onAlwaysAllow: () => void;
}

export function PermissionDialog({ petName, command, onAllow, onDeny, onAlwaysAllow }: Props) {
  return (
    <div style={wrapStyle}>
      {/* Title bar */}
      <div style={titleBar}>
        <span style={toolIcon}>🔧</span>
        <span style={titleText}>
          <strong style={{ color: '#dda' }}>{petName}</strong>
          <span style={{ color: '#999' }}> quer executar um comando Bash</span>
        </span>
      </div>

      {/* Command preview */}
      <div style={cmdBox}>
        <span style={prompt}>$</span>
        <code style={cmdText}>{command}</code>
      </div>

      {/* Action buttons */}
      <div style={actionsRow}>
        <button onClick={onDeny} style={btn('deny')} title="Negar execução">
          ✕&nbsp;Negar
        </button>
        <button onClick={onAllow} style={btn('allow')} title="Permitir esta vez">
          ✓&nbsp;Permitir
        </button>
        <button onClick={onAlwaysAllow} style={btn('always')} title="Sempre permitir este comando">
          ⟳&nbsp;Permitir sempre
        </button>
      </div>
    </div>
  );
}

// ── Output exibido após execução ──────────────────────────────────────────────

interface OutputProps {
  output: string;
  exitCode?: number | null;
  denied?: boolean;
}

export function CommandOutput({ output, exitCode, denied }: OutputProps) {
  const [fullscreen, setFullscreen] = useState(false);

  if (denied) {
    return (
      <div style={{ ...outputWrap, borderColor: '#662222', background: '#1a0808' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#ff6666' }}>
          ✕ comando negado
        </span>
      </div>
    );
  }

  const header = (
    <div style={outputHeader}>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#4caf50' }}>output</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {exitCode != null && (
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: exitCode === 0 ? '#4caf50' : '#ff6666' }}>
            exit {exitCode}
          </span>
        )}
        <button
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? 'minimizar' : 'tela cheia'}
          style={fsBtn}
        >
          {fullscreen ? '⊡' : '⛶'}
        </button>
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div style={fsOverlay} onClick={e => { if (e.target === e.currentTarget) setFullscreen(false); }}>
        <div style={fsPanel}>
          {header}
          <pre style={{ ...outputPre, maxHeight: 'none', flex: 1, overflowY: 'auto' }}>
            {output || '(sem saída)'}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div style={outputWrap}>
      {header}
      <pre style={outputPre}>{output || '(sem saída)'}</pre>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  marginTop: 8,
  border: '1px solid #4a4a20',
  background: '#0f0f08',
  overflow: 'hidden',
};

const titleBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  background: '#1a1a08',
  borderBottom: '1px solid #3a3a18',
};

const toolIcon: CSSProperties = { fontSize: 14 };

const titleText: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
};

const cmdBox: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '10px 14px',
  background: '#0d0d06',
};

const prompt: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
  color: '#4caf50',
  flexShrink: 0,
  lineHeight: '20px',
};

const cmdText: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 13,
  color: '#e8e8b0',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  lineHeight: '20px',
};

const actionsRow: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '8px 12px',
  background: '#0f0f0a',
  borderTop: '1px solid #2a2a10',
  flexWrap: 'wrap',
};

function btn(type: 'deny' | 'allow' | 'always'): CSSProperties {
  const colors = {
    deny:   { bg: '#2a0808', border: '#662222', color: '#ff8888' },
    allow:  { bg: '#0a2a0a', border: '#225522', color: '#88cc88' },
    always: { bg: '#1a1a06', border: '#444420', color: '#cccc66' },
  };
  const c = colors[type];
  return {
    fontFamily: 'inherit',
    fontSize: 12,
    padding: '5px 12px',
    background: c.bg,
    border: `1px solid ${c.border}`,
    color: c.color,
    cursor: 'pointer',
    letterSpacing: 0.3,
  };
}

const outputWrap: CSSProperties = {
  marginTop: 6,
  border: '1px solid #1a2a1a',
  background: '#060e06',
  overflow: 'hidden',
};

const outputHeader: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 10px',
  background: '#0a140a',
  borderBottom: '1px solid #1a2a1a',
};

const outputPre: CSSProperties = {
  margin: 0,
  padding: '8px 12px',
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#a8d8a8',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  maxHeight: 320,
  overflowY: 'auto',
};

const fsBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid #2a3a2a',
  color: '#4caf50',
  cursor: 'pointer',
  fontSize: 14,
  padding: '1px 5px',
  lineHeight: 1,
};

const fsOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  background: 'rgba(0,0,0,0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
};

const fsPanel: CSSProperties = {
  width: '100%',
  maxWidth: '900px',
  height: '80vh',
  background: '#060e06',
  border: '1px solid #2a4a2a',
  boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};
