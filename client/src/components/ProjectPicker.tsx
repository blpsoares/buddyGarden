/**
 * ProjectPicker — selector de diretório de projeto para o chat.
 * Navega pelo filesystem a partir do home do usuário, só mostra dirs.
 */

import { useState, useEffect, useCallback } from 'react';

interface DirEntry {
  name: string;
  path: string;
  isDir: boolean;
}

interface Props {
  onClose: () => void;
  onSelect: (dir: string | null) => void;
  currentDir: string | null;
}

export function ProjectPicker({ onClose, onSelect, currentDir }: Props) {
  const [browsePath, setBrowsePath] = useState<string>('');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const browse = useCallback(async (path: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/project/browse?path=${encodeURIComponent(path)}`);
      const data = await res.json() as { path?: string; entries?: DirEntry[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setBrowsePath(data.path ?? path);
      setEntries((data.entries ?? []).filter(e => e.isDir));
    } catch {
      setError('Erro ao listar diretório');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carrega home na abertura
  useEffect(() => {
    void browse('');
  }, [browse]);

  const handleSelect = useCallback(async (dir: string) => {
    try {
      const res = await fetch('/api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.error) { setError(data.error); return; }
      onSelect(dir);
      onClose();
    } catch {
      setError('Erro ao salvar projeto');
    }
  }, [onSelect, onClose]);

  const handleClear = useCallback(async () => {
    await fetch('/api/project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir: null }),
    }).catch(() => {});
    onSelect(null);
    onClose();
  }, [onSelect, onClose]);

  const goUp = useCallback(() => {
    const parts = browsePath.split('/').filter(Boolean);
    if (parts.length === 0) return;
    const parent = '/' + parts.slice(0, -1).join('/') || '/';
    void browse(parent);
  }, [browsePath, browse]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={titleStyle}>📁 Escolher projeto</span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Breadcrumb / caminho atual */}
        <div style={pathBarStyle}>
          <button onClick={goUp} style={upBtnStyle} disabled={!browsePath || browsePath === '/'}>↑</button>
          <span style={pathTextStyle}>{browsePath || '~'}</span>
        </div>

        {error && (
          <div style={{ padding: '6px 12px', color: '#f88', fontSize: 12, fontFamily: 'sans-serif' }}>
            {error}
          </div>
        )}

        {/* Usar pasta atual */}
        <div style={useCurrentStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>
              pasta atual:
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aac', marginLeft: 6, wordBreak: 'break-all' }}>
              {browsePath || '~'}
            </span>
          </div>
          <button
            onClick={() => browsePath ? void handleSelect(browsePath) : undefined}
            disabled={!browsePath}
            style={currentSelectBtnStyle(!browsePath)}
            title="Usar esta pasta como contexto do projeto"
          >
            ✓ usar esta pasta
          </button>
        </div>

        {/* Lista de subpastas */}
        <div style={listStyle}>
          {loading ? (
            <div style={loadingStyle}>carregando...</div>
          ) : entries.length === 0 ? (
            <div style={loadingStyle}>nenhuma subpasta aqui</div>
          ) : (
            entries.map(e => (
              <div key={e.path} style={entryRowStyle}>
                <button
                  onClick={() => void browse(e.path)}
                  style={entryBtnStyle(false)}
                  title={`Abrir ${e.name}`}
                >
                  <span style={{ marginRight: 6, opacity: 0.7 }}>📁</span>
                  {e.name}
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#444', paddingLeft: 8 }}>abrir →</span>
                </button>
                <button
                  onClick={() => void handleSelect(e.path)}
                  style={selectBtnStyle}
                  title={`Usar ${e.name} como contexto`}
                >
                  ✓
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          {currentDir && (
            <div style={{ width: '100%', fontSize: 11, color: '#666', marginBottom: 8, fontFamily: 'monospace' }}>
              atual: {currentDir}
            </div>
          )}
          {currentDir && (
            <button onClick={handleClear} style={clearBtnStyle}>
              ✕ remover projeto
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const modalStyle: React.CSSProperties = {
  background: '#0d0d20',
  border: '1px solid rgba(80,80,200,0.4)',
  width: 'min(480px, 92vw)',
  maxHeight: '70vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: '1px solid rgba(60,60,120,0.4)',
  background: 'rgba(20,20,50,0.6)',
};

const titleStyle: React.CSSProperties = {
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 10,
  color: '#aaa',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#666',
  cursor: 'pointer',
  fontSize: 16,
  padding: '0 4px',
};

const pathBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  background: 'rgba(10,10,30,0.8)',
  borderBottom: '1px solid rgba(40,40,80,0.4)',
};

const upBtnStyle: React.CSSProperties = {
  background: 'rgba(30,30,70,0.8)',
  border: '1px solid rgba(80,80,160,0.4)',
  color: '#aaa',
  cursor: 'pointer',
  padding: '3px 8px',
  fontSize: 13,
  flexShrink: 0,
};

const pathTextStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#666',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '4px 0',
};

const loadingStyle: React.CSSProperties = {
  padding: '20px',
  textAlign: 'center',
  fontFamily: 'sans-serif',
  fontSize: 12,
  color: '#555',
};

const useCurrentStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  background: 'rgba(40,80,40,0.12)',
  borderBottom: '1px solid rgba(60,120,60,0.25)',
};

const entryRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  borderBottom: '1px solid rgba(30,30,60,0.4)',
};

function entryBtnStyle(_active: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#bbb',
    cursor: 'pointer',
    padding: '9px 14px',
    textAlign: 'left',
    fontFamily: 'sans-serif',
    fontSize: 13,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
  };
}

const selectBtnStyle: React.CSSProperties = {
  background: 'rgba(30,60,30,0.6)',
  border: 'none',
  borderLeft: '1px solid rgba(40,80,40,0.4)',
  color: '#7a7',
  cursor: 'pointer',
  padding: '9px 12px',
  fontFamily: 'sans-serif',
  fontSize: 11,
  flexShrink: 0,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '10px 12px',
  borderTop: '1px solid rgba(40,40,80,0.4)',
  background: 'rgba(10,10,30,0.6)',
  flexWrap: 'wrap',
};

const currentSelectBtnStyle = (disabled: boolean): React.CSSProperties => ({
  flexShrink: 0,
  padding: '7px 14px',
  background: disabled ? 'rgba(20,20,40,0.5)' : 'rgba(40,100,50,0.8)',
  border: `1px solid ${disabled ? 'rgba(40,40,60,0.4)' : 'rgba(80,160,80,0.6)'}`,
  color: disabled ? '#444' : '#cfeecf',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'sans-serif',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
});

const clearBtnStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(60,20,20,0.6)',
  border: '1px solid rgba(100,40,40,0.4)',
  color: '#a77',
  cursor: 'pointer',
  fontFamily: 'sans-serif',
  fontSize: 12,
};
