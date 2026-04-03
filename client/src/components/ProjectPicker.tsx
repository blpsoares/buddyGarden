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
  onAdd: (dir: string) => void;
  onRemove: (dir: string) => void;
  currentDirs: string[];
}

export function ProjectPicker({ onClose, onAdd, onRemove, currentDirs }: Props) {
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

  useEffect(() => { void browse(''); }, [browse]);

  const handleAdd = useCallback((dir: string) => {
    onAdd(dir);
    onClose();
  }, [onAdd, onClose]);

  const goUp = useCallback(() => {
    const parts = browsePath.split('/').filter(Boolean);
    if (parts.length === 0) return;
    const parent = '/' + parts.slice(0, -1).join('/') || '/';
    void browse(parent);
  }, [browsePath, browse]);

  const alreadyAdded = browsePath ? currentDirs.includes(browsePath) : false;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={titleStyle}>📁 Pastas de contexto</span>
          <button onClick={onClose} style={closeBtnStyle}>✕</button>
        </div>

        {/* Pastas já adicionadas */}
        {currentDirs.length > 0 && (
          <div style={addedSectionStyle}>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#556', marginBottom: 4, display: 'block' }}>
              pastas ativas:
            </span>
            {currentDirs.map(dir => (
              <div key={dir} style={addedChipStyle}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11, color: '#6db87a' }}>
                  {dir}
                </span>
                <button
                  onClick={() => onRemove(dir)}
                  style={{ background: 'none', border: 'none', color: '#4a6a4a', cursor: 'pointer', padding: '0 0 0 6px', fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                  title={`Remover ${dir}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

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

        {/* Adicionar pasta atual */}
        <div style={useCurrentStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>navegar:</span>
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#aac', marginLeft: 6, wordBreak: 'break-all' }}>
              {browsePath || '~'}
            </span>
          </div>
          <button
            onClick={() => browsePath && !alreadyAdded ? handleAdd(browsePath) : undefined}
            disabled={!browsePath || alreadyAdded}
            style={currentSelectBtnStyle(!browsePath || alreadyAdded)}
            title={alreadyAdded ? 'Já adicionada' : 'Adicionar esta pasta ao contexto'}
          >
            {alreadyAdded ? '✓ adicionada' : '+ adicionar'}
          </button>
        </div>

        {/* Lista de subpastas */}
        <div style={listStyle}>
          {loading ? (
            <div style={loadingStyle}>carregando...</div>
          ) : entries.length === 0 ? (
            <div style={loadingStyle}>nenhuma subpasta aqui</div>
          ) : (
            entries.map(e => {
              const isAdded = currentDirs.includes(e.path);
              return (
                <div key={e.path} style={entryRowStyle}>
                  <button
                    onClick={() => void browse(e.path)}
                    style={entryBtnStyle(isAdded)}
                    title={`Abrir ${e.name}`}
                  >
                    <span style={{ marginRight: 6, opacity: 0.7 }}>📁</span>
                    {e.name}
                    {isAdded && <span style={{ marginLeft: 6, fontSize: 10, color: '#6db87a' }}>✓</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#444', paddingLeft: 8 }}>abrir →</span>
                  </button>
                  <button
                    onClick={() => isAdded ? onRemove(e.path) : handleAdd(e.path)}
                    style={isAdded ? removeBtnStyle : selectBtnStyle}
                    title={isAdded ? `Remover ${e.name}` : `Adicionar ${e.name} ao contexto`}
                  >
                    {isAdded ? '✕' : '+'}
                  </button>
                </div>
              );
            })
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

function entryBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: active ? 'rgba(30,60,30,0.25)' : 'none',
    border: 'none',
    color: active ? '#6db87a' : '#bbb',
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
  padding: '9px 14px',
  fontFamily: 'sans-serif',
  fontSize: 14,
  fontWeight: 700,
  flexShrink: 0,
};

const removeBtnStyle: React.CSSProperties = {
  background: 'rgba(60,20,20,0.5)',
  border: 'none',
  borderLeft: '1px solid rgba(80,40,40,0.4)',
  color: '#a77',
  cursor: 'pointer',
  padding: '9px 14px',
  fontFamily: 'sans-serif',
  fontSize: 13,
  flexShrink: 0,
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

const addedSectionStyle: React.CSSProperties = {
  padding: '8px 12px',
  background: 'rgba(20,40,20,0.4)',
  borderBottom: '1px solid rgba(60,120,60,0.25)',
};

const addedChipStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  background: 'rgba(30,60,30,0.5)',
  border: '1px solid rgba(60,100,60,0.4)',
  marginTop: 4,
};
