import { useState, useRef, useEffect, useCallback } from 'react';
import { useChat } from '../hooks/useChat.ts';
import { useBuddy } from '../hooks/useBuddy.ts';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { DragonBuddy } from '../components/DragonBuddy.tsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import { PermissionDialog, CommandOutput } from '../components/PermissionDialog.tsx';
import { useT } from '../hooks/useT.ts';
import { ProjectPicker } from '../components/ProjectPicker.tsx';
import gardenChatIcon from '../assets/gardenChat.png';
import claudeChatIcon from '../assets/claudeChat.png';

type Provider = 'claude-cli' | 'anthropic' | 'gemini';

const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5',  label: 'Haiku 4.5' , desc: 'rápido' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'inteligente' },
  { id: 'claude-opus-4-6',   label: 'Opus 4.6',  desc: 'poderoso' },
] as const;
type ClaudeModel = typeof CLAUDE_MODELS[number]['id'];

interface ProviderConfig {
  id: Provider;
  label: string;
  desc: string;
  keyPlaceholder?: string;
  keyLink?: string;
  free: string;
}
const PROVIDERS: ProviderConfig[] = [
  {
    id: 'claude-cli',
    label: 'Claude Code',
    desc: 'Usa sua assinatura existente',
    free: 'Gratuito — sem custo adicional',
  },
  {
    id: 'anthropic',
    label: 'Anthropic API',
    desc: 'Acesso direto via API key',
    keyPlaceholder: 'sk-ant-api03-...',
    keyLink: 'https://platform.claude.com/settings/keys',
    free: 'Pago — ~$0,001 por mensagem',
  },
  {
    id: 'gemini',
    label: 'Gemini (Google)',
    desc: 'Modelo Gemini Flash',
    keyPlaceholder: 'AIzaSy...',
    keyLink: 'https://aistudio.google.com/app/apikey',
    free: 'Gratuito — 1500 requisições/dia',
  },
];

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function Chat() {
  const {
    messages, send, isStreaming, clear, provider, setProvider, claudeModel, setClaudeModel,
    approveCommand, denyCommand,
    conversationId, isAnonymous, conversations,
    loadConversation, newConversation, removeConversation, setIsAnonymous,
    addConvProjectDir, removeConvProjectDir, activeConvMeta, activeConvProjectDirs,
    lang, setLang,
  } = useChat();
  const tl = useT();
  const { data } = useBuddy();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  // Export toast
  const [exportToast, setExportToast] = useState<{ convId: string; path: string; cmd: string } | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  // Config state
  const [showSetup, setShowSetup] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('claude-cli');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [currentProvider, setCurrentProvider] = useState<Provider>('claude-cli');
  const [selectedModel, setSelectedModel] = useState<ClaudeModel>('claude-haiku-4-5');
  const [currentModel, setCurrentModel] = useState<ClaudeModel>('claude-haiku-4-5');
  const [hasApiKey, setHasApiKey] = useState(false);

  // Project context — per-conversation (múltiplas pastas)
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json() as Promise<{ provider: Provider; claudeModel: ClaudeModel; hasApiKey: boolean }>)
      .then(d => {
        setCurrentProvider(d.provider);
        setSelectedProvider(d.provider);
        setHasApiKey(!!d.hasApiKey);
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
      // Só envia apiKey se o usuário digitou uma nova; caso contrário preserva a salva
      const body: Record<string, unknown> = {
        provider: selectedProvider,
        claudeModel: selectedModel,
      };
      if (selectedProvider !== 'claude-cli' && apiKeyInput.trim()) {
        body['apiKey'] = apiKeyInput.trim();
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCurrentProvider(selectedProvider);
        setCurrentModel(selectedModel);
        setProvider(selectedProvider);      // atualiza ChatContext para próximas mensagens
        setClaudeModel(selectedModel);
        if (apiKeyInput.trim()) {
          setHasApiKey(true);
          setApiKeyInput('');
        }
        setShowSetup(false);
      } else {
        const d = await res.json() as { error?: string };
        setSetupError(d.error ?? 'Erro ao salvar');
      }
    } catch {
      setSetupError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }, [selectedProvider, apiKeyInput, selectedModel]);

  const handleExportToClause = useCallback(async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${convId}/export-to-claude`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json() as { path: string; command: string; sessionId: string; opened: boolean };
      // Atualiza meta na lista para refletir forkedSessionId
      // (o server já salvou, mas precisamos atualizar o estado local)
      if (data.opened) {
        // Terminal aberto automaticamente — toast rápido de confirmação
        setExportToast({ convId, path: data.path, cmd: '✓ Claude aberto no terminal!' });
        setTimeout(() => setExportToast(null), 3000);
      } else {
        // Fallback: mostrar comando para copiar
        setExportToast({ convId, path: data.path, cmd: data.command });
      }
      setCopiedToast(false);
    } catch { /* ignore */ }
  }, []);

  const petName = data.soul?.name ?? data.bones?.species ?? 'Buddy';
  const isDragon = data.bones?.species === 'dragon';

  const activeModel = claudeModel || currentModel;
  const modelLabel = CLAUDE_MODELS.find(m => m.id === activeModel)?.label ?? activeModel;
  const providerLabel = PROVIDERS.find(p => p.id === (provider || currentProvider))?.label ?? provider;

  return (
    <div style={outerStyle}>
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={sidebarStyle}>
          <div style={sidebarHeaderStyle}>
            <span style={pixelText(9)}>{tl('chatSidebarHeader')}</span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                style={sidebarIconBtn(isAnonymous)}
                title={tl('chatAnonToggle')}
                onClick={() => {
                  setIsAnonymous(!isAnonymous);
                  newConversation(!isAnonymous);
                }}
              >
                {isAnonymous ? '👻' : '👁'}
              </button>
              <button
                style={sidebarIconBtn(false)}
                title={tl('chatNewConv')}
                onClick={() => newConversation(isAnonymous)}
              >
                ＋
              </button>
            </div>
          </div>

          {isAnonymous && (
            <div style={anonBannerStyle}>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {tl('chatAnonymousBadge')}
              </span>
            </div>
          )}

          <div style={convListStyle}>
            {conversations.length === 0 && !isAnonymous && (
              <div style={{ padding: '20px 12px', color: '#444', fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
                {tl('chatNoConversations')}
              </div>
            )}
            {conversations.map(conv => (
              <div
                key={conv.id}
                style={{ ...convItemStyle(conv.id === conversationId), position: 'relative' }}
                onClick={() => { setOpenMenuId(null); void loadConversation(conv.id); }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: conv.id === conversationId ? '#aabbff' : '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                    {conv.title}
                  </div>
                  <div style={{ fontSize: '11px', color: '#555' }}>
                    {formatDate(conv.updatedAt)} · {conv.messageCount} msgs
                  </div>
                </div>
                {/* Menu ··· */}
                <div style={{ flexShrink: 0, position: 'relative' }}>
                  <button
                    style={menuDotBtn}
                    title="Opções"
                    onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === conv.id ? null : conv.id); }}
                  >
                    ···
                  </button>
                  {openMenuId === conv.id && (
                    <div style={dropdownStyle} onClick={e => e.stopPropagation()}>
                      <button
                        style={dropdownItemStyle}
                        onClick={e => { setOpenMenuId(null); void handleExportToClause(conv.id, e); }}
                      >
                        ↗ Exportar para o Claude
                      </button>
                      <button
                        style={{ ...dropdownItemStyle, color: '#ff6666' }}
                        onClick={() => { setOpenMenuId(null); void removeConversation(conv.id); }}
                      >
                        🗑 Apagar sessão
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export toast */}
      {exportToast && (
        <div style={exportToastStyle}>
          <div style={{ fontSize: 11, color: '#778', marginBottom: 4 }}>{tl('exportCmd')}</div>
          <span style={{ flex: 1, wordBreak: 'break-all', fontSize: 12, color: '#aabbff' }}>
            {exportToast.cmd}
          </span>
          {exportToast.path && (
            <div style={{ fontSize: 10, color: '#556', marginTop: 3 }}>📁 {exportToast.path}</div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              style={{ ...iconBtnStyle, fontSize: '11px', color: copiedToast ? '#4caf50' : '#aabbff', border: '1px solid #4a4aaa', padding: '3px 10px' }}
              onClick={() => {
                void navigator.clipboard.writeText(exportToast.cmd);
                setCopiedToast(true);
                setTimeout(() => setCopiedToast(false), 2000);
              }}
            >
              {copiedToast ? tl('exportCopied') : tl('exportCopy')}
            </button>
            <button style={{ ...iconBtnStyle, color: '#ff6666', fontSize: '12px' }} onClick={() => setExportToast(null)}>
              {tl('exportClose')}
            </button>
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
              ? <DragonBuddy size={44} mood="happy" isMoving={false} />
              : data.bones
                ? <BuddySprite bones={data.bones} frame={frame} size={44} />
                : null
            }
          </div>
          <div style={{ marginLeft: '10px', flex: 1 }}>
            <span style={pixelText(11)}>{petName}</span>
            {isStreaming && (
              <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#4caf50', display: 'block', marginTop: 2 }}>
                {tl('chatTyping')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Ícone read-only: mostra onde o contexto está salvo (Buddy Garden ou Claude Code) */}
            <img
              src={activeConvMeta?.forkedSessionId ? claudeChatIcon : gardenChatIcon}
              alt={activeConvMeta?.forkedSessionId ? 'Claude Code' : 'Buddy Garden'}
              title={activeConvMeta?.forkedSessionId
                ? `Forked para Claude · ${activeConvMeta.forkedProjectDir ?? ''}`
                : activeConvProjectDirs.length ? `Buddy Garden · ${activeConvProjectDirs.join(', ')}` : 'Buddy Garden'}
              style={{ width: 20, height: 20, imageRendering: 'pixelated', opacity: 0.75, flexShrink: 0 }}
            />
            {/* Chips de pastas de contexto */}
            {activeConvProjectDirs.map(dir => (
              <div
                key={dir}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: '#0d1a0d', border: '1px solid #2a4a2a',
                  padding: '2px 6px', fontSize: 11, color: '#6db87a',
                }}
                title={dir}
              >
                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📁 {dir.split('/').pop()}
                </span>
                <button
                  onClick={() => void removeConvProjectDir(dir)}
                  style={{ background: 'none', border: 'none', color: '#4a7a4a', cursor: 'pointer', padding: '0 0 0 2px', fontSize: 12, lineHeight: 1 }}
                  title={`Remover ${dir}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {/* Botão para adicionar pasta */}
            <button
              onClick={() => setShowProjectPicker(true)}
              style={{
                ...iconBtnStyle,
                display: 'flex', alignItems: 'center', gap: 3,
                color: '#555', fontSize: 12,
                border: '1px solid #222', padding: '3px 7px',
              }}
              title={tl('chatProjectBtn')}
            >
              📁 <span style={{ fontSize: 11 }}>+</span>
            </button>
            <button
              onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
              style={{ ...iconBtnStyle, fontSize: 16 }}
              title={tl('chatLangToggle')}
            >
              {lang === 'pt' ? '🇧🇷' : '🇺🇸'}
            </button>
            <button
              onClick={() => setShowSetup(s => !s)}
              style={{ ...iconBtnStyle, color: showSetup ? '#aabbff' : '#aaa', fontSize: 16 }}
              title={tl('chatConfigBtn')}
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Config panel */}
        {showSetup && (
          <div style={setupPanelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={pixelText(10)}>{tl('chatConfigTitle')}</span>
              <button onClick={() => setShowSetup(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            <form onSubmit={(e) => { void handleSaveConfig(e); }}>
              {/* Provider cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {PROVIDERS.map(p => {
                  const isSelected = selectedProvider === p.id;
                  const needsKey = p.id !== 'claude-cli';
                  const keyAlreadySaved = hasApiKey && currentProvider === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProvider(p.id)}
                      style={providerCardStyle(isSelected)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                          border: `2px solid ${isSelected ? '#7a9fff' : '#333'}`,
                          background: isSelected ? '#4a6acc' : 'transparent',
                          boxShadow: isSelected ? '0 0 0 2px rgba(74,106,204,0.3)' : 'none',
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'sans-serif', fontWeight: 600, fontSize: 14, color: isSelected ? '#eee' : '#aaa' }}>
                              {p.label}
                            </span>
                            {p.id === currentProvider && (
                              <span style={{ fontSize: 10, color: '#4caf50', background: 'rgba(76,175,80,0.15)', padding: '1px 6px', border: '1px solid rgba(76,175,80,0.3)' }}>
                                ativo
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{p.desc}</div>
                          <div style={{ fontSize: 11, color: '#4caf50', marginTop: 3 }}>{p.free}</div>

                          {/* Model picker for claude-cli */}
                          {isSelected && p.id === 'claude-cli' && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>{tl('chatConfigModel')}</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {CLAUDE_MODELS.map(m => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={e => { e.stopPropagation(); setSelectedModel(m.id); }}
                                    style={{
                                      padding: '5px 10px',
                                      background: selectedModel === m.id ? 'rgba(74,106,204,0.4)' : 'rgba(20,20,50,0.6)',
                                      border: `1px solid ${selectedModel === m.id ? '#4a6acc' : '#333'}`,
                                      color: selectedModel === m.id ? '#aabbff' : '#777',
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      fontFamily: 'sans-serif',
                                    }}
                                  >
                                    <span style={{ fontWeight: 600 }}>{m.label}</span>
                                    <span style={{ color: '#555', marginLeft: 4 }}>— {m.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* API key field */}
                          {isSelected && needsKey && (
                            <div style={{ marginTop: 10 }}>
                              {keyAlreadySaved && !apiKeyInput && (
                                <div style={{ fontSize: 11, color: '#6db87a', marginBottom: 6 }}>
                                  {tl('chatConfigKeySaved')}
                                </div>
                              )}
                              <input
                                type="password"
                                value={apiKeyInput}
                                onChange={e => setApiKeyInput(e.target.value)}
                                placeholder={keyAlreadySaved ? '••••••••••••' : p.keyPlaceholder}
                                onClick={e => e.stopPropagation()}
                                style={keyInputStyle}
                                autoComplete="off"
                              />
                              {p.keyLink && (
                                <a
                                  href={p.keyLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  style={{ fontSize: 11, color: '#7a9fff', display: 'inline-block', marginTop: 4 }}
                                >
                                  {tl('chatConfigGenKey')}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {setupError && (
                <div style={{ fontSize: 12, color: '#ff6666', marginBottom: 10, padding: '6px 10px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.2)' }}>
                  {setupError}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={saveBtnStyle(saving)}
              >
                {saving ? tl('chatConfigSaving') : tl('chatConfigSave')}
              </button>
            </form>
          </div>
        )}

        {/* Info bar */}
        {!showSetup && (
          <div style={infoBarStyle}>
            <span style={{ fontSize: '12px', color: '#3a3a5a' }}>
              {modelLabel}
              <span style={{ color: '#2a2a4a' }}> · </span>
              <span style={{ color: '#444' }}>{providerLabel}</span>
            </span>
            {isAnonymous && (
              <span style={{ fontSize: '11px', color: '#666', background: '#111', border: '1px solid #333', padding: '1px 6px' }}>
                {tl('chatAnonBadge')}
              </span>
            )}

            <button
              onClick={clear}
              style={{ marginLeft: 'auto', ...iconBtnStyle, color: '#ff5555', fontSize: 12 }}
              title={tl('chatClearBtn')}
            >
              ✕ {tl('chatClearBtn')}
            </button>
          </div>
        )}

        {/* Messages */}
        <div style={messagesStyle}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#444' }}>
              <span style={{ ...pixelText(9), color: '#333' }}>{tl('chatEmptyHint')}</span>
            </div>
          )}
          {messages.filter(m => !m.hidden).map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '14px',
              }}
            >
              {msg.role === 'assistant' && data.bones && (
                <div style={{ flexShrink: 0 }}>
                  {isDragon
                    ? <DragonBuddy size={44} mood="happy" isMoving={false} />
                    : <BuddySprite bones={data.bones} frame={0} size={44} />
                  }
                </div>
              )}
              <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
                <div style={msgBubbleStyle(msg.role === 'user')}>
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} streaming={msg.streaming} style={{ fontSize: 15 }} />
                  ) : (
                    <span style={{ fontFamily: 'sans-serif', fontSize: 15, color: '#eee', lineHeight: 1.55 }}>
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
            placeholder={isStreaming ? tl('chatWaiting') : tl('chatPlaceholder')}
            disabled={isStreaming}
            style={inputStyle}
            autoFocus
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

      {/* Project picker modal */}
      {showProjectPicker && (
        <ProjectPicker
          currentDirs={activeConvProjectDirs}
          onClose={() => setShowProjectPicker(false)}
          onAdd={dir => { void addConvProjectDir(dir); }}
          onRemove={dir => { void removeConvProjectDir(dir); }}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const outerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex',
  background: '#0d0d1e',
  fontFamily: 'sans-serif',
};

const sidebarStyle: React.CSSProperties = {
  width: '300px',
  minWidth: '300px',
  background: '#080812',
  borderRight: '1px solid #1a1a30',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 12px 10px',
  borderBottom: '1px solid #1a1a30',
  background: '#0a0a18',
};

const sidebarIconBtn = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(74,74,170,0.3)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${active ? '#4a4aaa' : '#252535'}`,
  color: active ? '#aabbff' : '#666',
  cursor: 'pointer',
  padding: '5px 9px',
  fontSize: '14px',
  borderRadius: 2,
});

const anonBannerStyle: React.CSSProperties = {
  padding: '7px 12px',
  background: 'rgba(80,80,80,0.08)',
  borderBottom: '1px solid #1a1a30',
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
  padding: '10px 12px',
  cursor: 'pointer',
  background: active ? 'rgba(74,74,170,0.15)' : 'transparent',
  borderLeft: active ? '3px solid #4a4aaa' : '3px solid transparent',
  borderBottom: '1px solid #0f0f1e',
});

const menuDotBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#555',
  cursor: 'pointer',
  fontSize: '18px',
  padding: '4px 8px',
  lineHeight: 1,
  letterSpacing: '1px',
  borderRadius: 3,
};

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '100%',
  zIndex: 100,
  background: '#0f0f22',
  border: '1px solid #2a2a44',
  boxShadow: '0 4px 16px rgba(0,0,0,0.7)',
  minWidth: 200,
  display: 'flex',
  flexDirection: 'column',
};

const dropdownItemStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#ccc',
  cursor: 'pointer',
  padding: '10px 14px',
  textAlign: 'left',
  fontFamily: 'sans-serif',
  fontSize: 13,
  borderBottom: '1px solid #1a1a30',
};

const containerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: '8px 12px',
  background: '#0d0d1e',
  borderBottom: '1px solid #1a1a30',
  gap: 4,
};

const projectBadgeStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#6db87a',
  background: 'rgba(20,50,30,0.5)',
  border: '1px solid rgba(60,120,60,0.35)',
  padding: '2px 7px',
  maxWidth: 100,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const setupPanelStyle: React.CSSProperties = {
  background: '#0a0a1e',
  borderBottom: '1px solid #1a1a40',
  padding: '16px 18px',
  overflowY: 'auto',
  maxHeight: '70vh',
};

const providerCardStyle = (active: boolean): React.CSSProperties => ({
  padding: '12px 14px',
  background: active ? 'rgba(74,106,204,0.12)' : 'rgba(20,20,40,0.5)',
  border: `1px solid ${active ? 'rgba(74,106,204,0.4)' : 'rgba(40,40,70,0.6)'}`,
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const keyInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'rgba(10,10,30,0.8)',
  border: '1px solid #2a2a5a',
  color: '#eee',
  fontFamily: 'monospace',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

const saveBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '10px 16px',
  background: disabled ? '#1a1a30' : '#3a5acc',
  border: `1px solid ${disabled ? '#252535' : '#5a7aee'}`,
  color: disabled ? '#444' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 11,
  marginTop: 4,
});

const infoBarStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: '#080812',
  borderBottom: '1px solid #111',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
};

const messagesStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
  padding: '18px 16px',
  display: 'flex', flexDirection: 'column',
};

const msgBubbleStyle = (isUser: boolean): React.CSSProperties => ({
  padding: '11px 15px',
  background: isUser ? '#252560' : '#16162e',
  border: `1px solid ${isUser ? '#3a3a88' : '#252540'}`,
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
});

const formStyle: React.CSSProperties = {
  display: 'flex', gap: '8px',
  padding: '10px 12px',
  background: '#0d0d1e',
  borderTop: '1px solid #1a1a30',
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '9px 13px',
  background: '#141430',
  border: '1px solid #2a2a50',
  color: '#eee',
  fontFamily: 'sans-serif',
  fontSize: '15px',
  outline: 'none',
};

const sendBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '9px 18px',
  background: disabled ? '#1a1a30' : '#3a5acc',
  border: `1px solid ${disabled ? '#252535' : '#5a7aee'}`,
  color: disabled ? '#444' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: '"Press Start 2P", monospace',
  fontSize: '12px',
  boxShadow: disabled ? 'none' : '0 2px 8px rgba(58,90,204,0.3)',
});

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #1e1e35',
  color: '#888',
  cursor: 'pointer',
  padding: '5px 8px',
  fontSize: '14px',
  borderRadius: 2,
};

const exportToastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(8,8,24,0.97)',
  border: '1px solid rgba(80,80,180,0.5)',
  padding: '12px 16px',
  zIndex: 200,
  maxWidth: 'min(520px, calc(100vw - 32px))',
  width: '100%',
  boxShadow: '0 4px 32px rgba(0,0,0,0.7)',
  display: 'flex',
  flexDirection: 'column',
};

function pixelText(size: number): React.CSSProperties {
  return { fontFamily: '"Press Start 2P", monospace', fontSize: `${size}px`, color: '#eee' };
}
