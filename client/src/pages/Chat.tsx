import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat.ts';
import { useBuddy } from '../hooks/useBuddy.ts';
import { BuddySprite } from '../components/BuddySprite.tsx';

type Provider = 'claude-cli' | 'anthropic' | 'gemini';

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

export function Chat() {
  const { messages, send, isStreaming, clear } = useChat();
  const { data } = useBuddy();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);

  // Setup state
  const [showSetup, setShowSetup] = useState(false);
  const [provider, setProvider] = useState<Provider>('claude-cli');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [currentProvider, setCurrentProvider] = useState<Provider>('claude-cli');

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Carrega provider atual
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json() as Promise<{ provider: Provider }>)
      .then(d => { setCurrentProvider(d.provider); setProvider(d.provider); })
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
      const body = provider === 'claude-cli'
        ? { provider }
        : { provider, apiKey: apiKeyInput.trim() };

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCurrentProvider(provider);
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
  }, [provider, apiKeyInput]);

  const info = PROVIDER_INFO[provider];

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        {data.bones && <BuddySprite bones={data.bones} frame={frame} size={32} />}
        <div style={{ marginLeft: '8px', flex: 1 }}>
          <span style={pixelText(10)}>{data.soul?.name ?? data.bones?.species ?? 'Buddy'}</span>
          {isStreaming && (
            <span style={{ ...pixelText(7), color: '#4caf50', display: 'block' }}>digitando...</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
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
            {/* Provider selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(Object.keys(PROVIDER_INFO) as Provider[]).map(p => (
                <label key={p} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="provider"
                    value={p}
                    checked={provider === p}
                    onChange={() => setProvider(p)}
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

            {/* API key input (when needed) */}
            {provider !== 'claude-cli' && (
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
              disabled={saving || (provider !== 'claude-cli' && !apiKeyInput.trim())}
              style={sendBtnStyle(saving || (provider !== 'claude-cli' && !apiKeyInput.trim()))}
            >
              {saving ? 'salvando...' : 'salvar'}
            </button>
          </form>
        </div>
      )}

      {/* Provider badge */}
      {!showSetup && (
        <div style={{ padding: '4px 12px', background: '#0a0a1a', borderBottom: '1px solid #222' }}>
          <span style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#444' }}>
            via {PROVIDER_INFO[currentProvider].label}
          </span>
        </div>
      )}

      {/* Messages */}
      <div style={messagesStyle}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#555' }}>
            <span style={pixelText(8)}>diz algo pro teu buddy...</span>
          </div>
        )}
        {messages.map((msg, i) => (
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
                <BuddySprite bones={data.bones} frame={0} size={32} />
              </div>
            )}
            <div
              style={{
                maxWidth: '70%',
                padding: '10px 14px',
                background: msg.role === 'user' ? '#2a2a6a' : '#1e1e3a',
                border: `2px solid ${msg.role === 'user' ? '#4a4aaa' : '#333'}`,
                boxShadow: '2px 2px 0 #000',
                color: '#eee',
                fontFamily: 'sans-serif',
                fontSize: '14px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {msg.content}
              {msg.streaming && (
                <span style={{ display: 'inline-block', animation: 'blink 1s infinite', marginLeft: '4px' }}>▌</span>
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
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', flexDirection: 'column',
  background: '#0d0d1e',
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
