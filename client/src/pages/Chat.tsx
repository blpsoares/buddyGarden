import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat.ts';
import { useBuddy } from '../hooks/useBuddy.ts';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { DragonBuddy } from '../components/DragonBuddy.tsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import { PermissionDialog, CommandOutput } from '../components/PermissionDialog.tsx';

type Provider = 'claude-cli' | 'anthropic' | 'gemini';

const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5',  label: 'Haiku 4.5 — rápido' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 — inteligente' },
  { id: 'claude-opus-4-6',   label: 'Opus 4.6 — poderoso' },
] as const;
type ClaudeModel = typeof CLAUDE_MODELS[number]['id'];

const PROVIDER_INFO: Record<Provider, { label: string; placeholder: string; link?: string; free?: string }> = {
  'claude-cli': {
    label: 'Claude Code (sua assinatura)',
    placeholder: '',
    free: 'Gratuito — usa sua assinatura do Claude Code',
  },
  'anthropic': {
    label: 'Claude API (Anthropic)',
    placeholder: 'sk-ant-api03-...',
    link: 'https://platform.claude.com/settings/keys',
    free: 'Pago — ~$0.001 por mensagem (Haiku)',
  },
  'gemini': {
    label: 'Gemini (Google)',
    placeholder: 'AIzaSy...',
    link: 'https://aistudio.google.com/app/apikey',
    free: 'Grátis — 1500 req/dia no plano gratuito',
  },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function Chat() {
  const {
    messages, send, isStreaming, clear, provider,
    approveCommand, denyCommand,
    conversationId, isAnonymous, conversations,
    loadConversation, newConversation, removeConversation, setIsAnonymous,
    lang, setLang,
  } = useChat();
  const { data } = useBuddy();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Setup state
  const [showSetup, setShowSetup] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('claude-cli');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [currentProvider, setCurrentProvider] = useState<Provider>('claude-cli');
  const [selectedModel, setSelectedModel] = useState<ClaudeModel>('claude-haiku-4-5');
  const [currentModel, setCurrentModel] = useState<ClaudeModel>('claude-haiku-4-5');

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json() as Promise<{ provider: Provider; claudeModel: ClaudeModel }>)
      .then(d => {
        setCurrentProvider(d.provider);
        setSelectedProvider(d.provider);
        if (d.claudeModel) { setCurrentModel(d.claudeModel); setSelectedModel(d.claudeModel); }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    void send(text);
  }, [input, isStreaming, send]);

  const handleSaveConfig = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSetupError('');
    try {
      const body = selectedProvider === 'claude-cli'
        ? { provider: selectedProvider, claudeModel: selectedModel }
        : { provider: selectedProvider, apiKey: apiKeyInput.trim() };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCurrentProvider(selectedProvider);
        setCurrentModel(selectedModel);
        setShowSetup(false);
        setApiKeyInput('');
      } else {
        const d = await res.json() as { error?: string };
        setSetupError(d.error ?? 'Erro ao salvar');
      }
    } catch {
      setSetupError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }, [selectedProvider, apiKeyInput]);

  const info = PROVIDER_INFO[selectedProvider];
  const petName = data.soul?.name ?? data.bones?.species ?? 'Buddy';
  const isDragon = data.bones?.species === 'dragon';

  return (
    <div style={outerStyle}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={sidebarStyle}>
          <div style={sidebarHeaderStyle}>
            <span style={pixelText(7)}>conversas</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                style={sidebarBtnStyle(isAnonymous)}
                title={isAnonymous ? 'modo anônimo ativo' : 'modo anônimo'}
                onClick={() => {
                  setIsAnonymous(!isAnonymous);
                  newConversation(!isAnonymous);
                }}
              >
                {isAnonymous ? '👻' : '👁'}
              </button>
              <button
                style={sidebarBtnStyle(false)}
                title="nova conversa"
                onClick={() => newConversation(isAnonymous)}
              >
                ＋
              </button>
            </div>
          </div>

          {isAnonymous && (
            <div style={anonBadgeStyle}>
              <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#888' }}>
                👻 modo anônimo — sem histórico
              </span>
            </div>
          )}

          <div style={convListStyle}>
            {conversations.length === 0 && !isAnonymous && (
              <div style={{ padding: '12px 8px', color: '#444', fontFamily: 'sans-serif', fontSize: '11px', textAlign: 'center' }}>
                nenhuma conversa ainda
              </div>
            )}
            {conversations.map(conv => (
              <div
                key={conv.id}
                style={convItemStyle(conv.id === conversationId)}
                onClick={() => { void loadConversation(conv.id); }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'sans-serif', fontSize: '11px', color: conv.id === conversationId ? '#aabbff' : '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title}
                  </div>
                  <div style={{ fontFamily: 'sans-serif', fontSize: '9px', color: '#555', marginTop: '2px' }}>
                    {formatDate(conv.updatedAt)} · {conv.messageCount} msgs
                  </div>
                </div>
                <button
                  style={deleteConvBtnStyle}
                  onClick={e => { e.stopPropagation(); void removeConversation(conv.id); }}
                  title="apagar"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <button onClick={() => setSidebarOpen(s => !s)} style={iconBtnStyle} title="histórico">
            ☰
          </button>
          <div style={{ marginLeft: '8px', flexShrink: 0 }}>
            {isDragon
              ? <DragonBuddy size={48} mood="happy" isMoving={false} />
              : data.bones
                ? <BuddySprite bones={data.bones} frame={frame} size={48} />
                : null
            }
          </div>
          <div style={{ marginLeft: '8px', flex: 1 }}>
            <span style={pixelText(10)}>{petName}</span>
            {isStreaming && (
              <span style={{ ...pixelText(7), color: '#4caf50', display: 'block' }}>digitando...</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
              style={iconBtnStyle}
              title="trocar idioma"
            >
              {lang === 'pt' ? '🇧🇷' : '🇺🇸'}
            </button>
            <button onClick={() => setShowSetup(s => !s)} style={iconBtnStyle} title="Configurar LLM">
              ⚙
            </button>
            <button onClick={clear} style={{ ...iconBtnStyle, color: '#ff6666' }} title="Limpar chat">
              ✕
            </button>
          </div>
        </div>

        {/* Setup panel */}
        {showSetup && (
          <div style={setupPanelStyle}>
            <span style={{ ...pixelText(8), display: 'block', marginBottom: '10px' }}>
              🔧 configurar LLM
            </span>
            <form onSubmit={(e) => { void handleSaveConfig(e); }} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(Object.keys(PROVIDER_INFO) as Provider[]).map(p => (
                  <label key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="provider"
                      value={p}
                      checked={selectedProvider === p}
                      onChange={() => setSelectedProvider(p)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <span style={{ fontFamily: 'sans-serif', fontSize: '13px', color: '#ddd' }}>
                        {PROVIDER_INFO[p].label}
                      </span>
                      <br />
                      <span style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#4caf50' }}>
                        {PROVIDER_INFO[p].free}
                      </span>
                      {PROVIDER_INFO[p].link && (
                        <>
                          {' · '}
                          <a
                            href={PROVIDER_INFO[p].link}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#7a9fff' }}
                          >
                            gerar key
                          </a>
                        </>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {selectedProvider === 'claude-cli' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#666' }}>modelo</span>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value as ClaudeModel)}
                    style={{ ...inputStyle, fontFamily: 'sans-serif', fontSize: '13px', cursor: 'pointer' }}
                  >
                    {CLAUDE_MODELS.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedProvider !== 'claude-cli' && (
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder={info.placeholder}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '12px' }}
                  autoFocus
                />
              )}

              {setupError && (
                <span style={{ fontFamily: 'sans-serif', fontSize: '12px', color: '#ff6666' }}>
                  {setupError}
                </span>
              )}

              <button
                type="submit"
                disabled={saving || (selectedProvider !== 'claude-cli' && !apiKeyInput.trim())}
                style={sendBtnStyle(saving || (selectedProvider !== 'claude-cli' && !apiKeyInput.trim()))}
              >
                {saving ? 'salvando...' : 'salvar'}
              </button>
            </form>
          </div>
        )}

        {/* Provider badge */}
        {!showSetup && (
          <div style={{ padding: '4px 12px', background: '#0a0a1a', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#444' }}>
              via {PROVIDER_INFO[currentProvider]?.label ?? currentProvider}
              {currentProvider === 'claude-cli' && (
                <span style={{ color: '#333', marginLeft: '6px' }}>
                  · {CLAUDE_MODELS.find(m => m.id === currentModel)?.label ?? currentModel}
                </span>
              )}
            </span>
            {isAnonymous && (
              <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#666', background: '#1a1a1a', border: '1px solid #333', padding: '1px 6px' }}>
                👻 anônimo
              </span>
            )}
            {conversationId && !isAnonymous && (
              <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: '#4caf50' }}>● salvo</span>
            )}
          </div>
        )}

        {/* Messages */}
        <div style={messagesStyle}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#555' }}>
              <span style={pixelText(8)}>diz algo pro teu buddy...</span>
            </div>
          )}
          {messages.filter(m => !m.hidden).map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: '8px',
                marginBottom: '12px',
              }}
            >
              {msg.role === 'assistant' && data.bones && (
                <div style={{ flexShrink: 0 }}>
                  {isDragon
                    ? <DragonBuddy size={42} mood="happy" isMoving={false} />
                    : <BuddySprite bones={data.bones} frame={0} size={42} />
                  }
                </div>
              )}
              <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    background: msg.role === 'user' ? '#2a2a6a' : '#1e1e3a',
                    border: `2px solid ${msg.role === 'user' ? '#4a4aaa' : '#333'}`,
                    boxShadow: '2px 2px 0 #000',
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} streaming={msg.streaming} />
                  ) : (
                    <span style={{ fontFamily: 'sans-serif', fontSize: 14, color: '#eee', lineHeight: 1.5 }}>
                      {msg.content}
                    </span>
                  )}
                </div>

                {msg.role === 'assistant' && msg.pendingCommand && provider === 'claude-cli' && (
                  <>
                    {msg.pendingCommand.status === 'pending' && (
                      <PermissionDialog
                        petName={petName}
                        command={msg.pendingCommand.command}
                        onAllow={() => { void approveCommand(i, false); }}
                        onDeny={() => denyCommand(i)}
                        onAlwaysAllow={() => { void approveCommand(i, true); }}
                      />
                    )}
                    {(msg.pendingCommand.status === 'allowed' || msg.pendingCommand.status === 'done') && (
                      <CommandOutput output={msg.pendingCommand.output ?? ''} exitCode={msg.pendingCommand.exitCode} />
                    )}
                    {msg.pendingCommand.status === 'denied' && (
                      <CommandOutput output="" denied />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={formStyle}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isStreaming ? 'aguardando resposta...' : 'mensagem...'}
            disabled={isStreaming}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            style={sendBtnStyle(isStreaming || !input.trim())}
          >
            ▶
          </button>
        </form>

        <style>{`
          @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        `}</style>
      </div>
    </div>
  );
}

const outerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex',
  background: '#0d0d1e',
};

const sidebarStyle: React.CSSProperties = {
  width: '200px',
  minWidth: '200px',
  background: '#080810',
  borderRight: '2px solid #1a1a3a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 10px 8px',
  borderBottom: '1px solid #1a1a3a',
};

const anonBadgeStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: '#0d0d18',
  borderBottom: '1px solid #1a1a3a',
};

const convListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const convItemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 10px',
  cursor: 'pointer',
  background: active ? '#1a1a3a' : 'transparent',
  borderLeft: active ? '2px solid #4a4aaa' : '2px solid transparent',
  borderBottom: '1px solid #0f0f1e',
});

const deleteConvBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#444',
  cursor: 'pointer',
  fontSize: '14px',
  padding: '0 2px',
  flexShrink: 0,
  lineHeight: 1,
};

const sidebarBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#1a1a3a' : 'transparent',
  border: `1px solid ${active ? '#4a4aaa' : '#222'}`,
  color: active ? '#aabbff' : '#666',
  cursor: 'pointer',
  padding: '3px 6px',
  fontSize: '12px',
});

const containerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: '8px 12px',
  background: '#111',
  borderBottom: '2px solid #333',
};

const setupPanelStyle: React.CSSProperties = {
  background: '#0d1a2e',
  border: '2px solid #2255aa',
  padding: '16px',
  margin: '8px',
  boxShadow: '3px 3px 0 #000',
};

const messagesStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
  padding: '16px',
  display: 'flex', flexDirection: 'column',
};

const formStyle: React.CSSProperties = {
  display: 'flex', gap: '8px',
  padding: '10px 12px',
  background: '#111',
  borderTop: '2px solid #333',
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px',
  background: '#1a1a3a',
  border: '2px solid #333',
  boxShadow: '2px 2px 0 #000',
  color: '#eee',
  fontFamily: 'sans-serif',
  fontSize: '14px',
  outline: 'none',
};

const sendBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  background: disabled ? '#333' : '#4a4aaa',
  border: '2px solid',
  borderColor: disabled ? '#444' : '#6a6acc',
  color: disabled ? '#666' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: '"Press Start 2P", monospace',
  fontSize: '12px',
  boxShadow: disabled ? 'none' : '2px 2px 0 #000',
});

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #333',
  color: '#aaa',
  cursor: 'pointer',
  padding: '4px 8px',
  fontSize: '14px',
};

function pixelText(size: number): React.CSSProperties {
  return { fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color: '#eee' };
}
