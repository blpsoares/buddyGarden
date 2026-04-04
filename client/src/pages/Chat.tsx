import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Trash2, GitBranch, Settings, X, FolderPlus, Send, Ghost, Eye, CheckSquare, Square, ArrowRightFromLine, ArrowLeftFromLine, Copy, Folder, ChevronRight, Lock, Search } from 'lucide-react';
import { useBreakpoint } from '../hooks/useBreakpoint.ts';
import { useChat } from '../hooks/useChat.ts';
import type { ClaudeSessionMeta } from '../context/ChatContext.tsx';
import { useBuddy } from '../hooks/useBuddy.ts';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { DragonBuddy } from '../components/DragonBuddy.tsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import { PermissionDialog, CommandOutput } from '../components/PermissionDialog.tsx';
import { PixelLoader } from '../components/PixelLoader.tsx';
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
    messages, send, isStreaming, provider, setProvider, claudeModel, setClaudeModel,
    approveCommand, denyCommand,
    conversationId, isAnonymous, conversations,
    loadConversation, newConversation, removeConversation, removeConversations, setIsAnonymous,
    refreshConversations, conversationsLoaded,
    addConvProjectDir, removeConvProjectDir, activeConvMeta, activeConvProjectDirs,
    lang, chatFont,
    showClaudeSessions, setShowClaudeSessions,
    claudeSessions, refreshClaudeSessions, loadClaudeSession, lockedProjectDir,
  } = useChat();
  const tl = useT();
  const { data } = useBuddy();
  const { isMobile } = useBreakpoint();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 640);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(300);
  const SIDEBAR_SNAP_CLOSE = 160;
  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 540;
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [forkModal, setForkModal] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showBuddySessions, setShowBuddySessions] = useState(true);
  const [claudeProjectsOpen, setClaudeProjectsOpen] = useState(false);
  const [buddyProjectsOpen, setBuddyProjectsOpen] = useState(false);
  const [claudeChatsOpen, setClaudeChatsOpen] = useState(false);
  const [buddyChatsOpen, setBuddyChatsOpen] = useState(false);
  const [infoTooltip, setInfoTooltip] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-select e modal de confirmação de deleção
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[] } | null>(null);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setExpandedProjects(new Set()); // fecha acordeons que foram auto-abertos
  }, []);

  const triggerDelete = useCallback((id: string) => {
    setDeleteConfirm({ ids: [id] });
  }, []);

  const triggerDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteConfirm({ ids: Array.from(selectedIds) });
  }, [selectedIds]);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const { ids } = deleteConfirm;
    setDeleteConfirm(null);
    if (ids.length === 1) {
      await removeConversation(ids[0]!);
    } else {
      await removeConversations(ids);
    }
    exitSelectMode();
  }, [deleteConfirm, removeConversation, removeConversations, exitSelectMode]);

  // Export toast
  const [exportToast, setExportToast] = useState<{ convId: string; path: string; cmd: string } | null>(null);

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

  useEffect(() => {
    if (!infoTooltip) return;
    const handler = (e: MouseEvent) => {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoTooltip(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [infoTooltip]);

  // Resize da sidebar via drag na borda direita
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = e.clientX - dragStartXRef.current;
      const newWidth = dragStartWidthRef.current + delta;
      if (newWidth < SIDEBAR_SNAP_CLOSE) {
        setSidebarOpen(false);
        isDraggingRef.current = false;
      } else {
        setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, newWidth)));
      }
    };
    const onUp = () => { isDraggingRef.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  // Quando Claude sessions são ativadas, auto-expande todos os projetos com sessões Claude
  useEffect(() => {
    if (!showClaudeSessions) return;
    setExpandedProjects(prev => {
      const next = new Set(prev);
      for (const s of claudeSessions) { if (s.projectDir) next.add(s.projectDir); }
      return next;
    });
  }, [showClaudeSessions, claudeSessions]);

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

  const handleFork = useCallback(async (convId: string, direction: 'to-claude' | 'to-buddy', keepSource: boolean) => {
    setForkModal(null);
    try {
      const res = await fetch(`/api/conversations/${convId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction, keepSource }),
      });
      if (!res.ok) return;

      if (direction === 'to-claude') {
        const data = await res.json() as { path: string; command: string; sessionId: string };
        if (!keepSource) {
          await removeConversation(convId);
        } else {
          void refreshConversations();
        }
        void refreshClaudeSessions();
        setExportToast({ convId, path: data.path, cmd: keepSource ? '✓ Copiado para o Claude!' : '✓ Exportado para o Claude!' });
        setTimeout(() => setExportToast(null), 3000);
      } else {
        // Importado para Buddy
        void refreshConversations();
        if (conversationId === convId) void loadConversation(convId);
        setExportToast({ convId, path: '', cmd: '✓ Importado para o Buddy!' });
        setTimeout(() => setExportToast(null), 3000);
      }
    } catch { /* ignore */ }
  }, [removeConversation, refreshConversations, refreshClaudeSessions, conversationId, loadConversation]);

  const petName = data.soul?.name ?? data.bones?.species ?? 'Buddy';
  const isDragon = data.bones?.species === 'dragon';
  const bothActive = showBuddySessions && showClaudeSessions;
  const sourceLabel = !bothActive && (showBuddySessions || showClaudeSessions)
    ? (showClaudeSessions ? 'Claude' : 'Buddy')
    : null;

  const activeModel = claudeModel || currentModel;
  const modelLabel = CLAUDE_MODELS.find(m => m.id === activeModel)?.label ?? activeModel;
  const providerLabel = PROVIDERS.find(p => p.id === (provider || currentProvider))?.label ?? provider;

  return (
    <div style={outerStyle}>
      {/* Overlay escuro no mobile quando sidebar aberta */}
      {sidebarOpen && isMobile && (
        <div
          style={{ position: 'absolute', inset: 0, zIndex: 19, background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      {sidebarOpen && (
        <div style={isMobile
          ? { ...sidebarStyle, position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 20, width: 'min(300px, 88vw)', minWidth: 0 }
          : { ...sidebarStyle, width: sidebarWidth, minWidth: sidebarWidth, position: 'relative' }
        }>
          {/* Handle de resize — borda direita */}
          {!isMobile && (
            <div
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 10, background: 'transparent', transition: 'background 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(100,100,200,0.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              onMouseDown={e => {
                e.preventDefault();
                isDraggingRef.current = true;
                dragStartXRef.current = e.clientX;
                dragStartWidthRef.current = sidebarWidth;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
              }}
            />
          )}
          <div style={sidebarHeaderStyle}>
            {selectMode ? (
              <>
                <span style={{ ...pixelText(8), color: '#aabbff' }}>
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    style={{ ...sidebarIconBtn(false), fontSize: 11, padding: '4px 8px', color: selectedIds.size > 0 ? '#ff6666' : '#444', borderColor: selectedIds.size > 0 ? '#552222' : '#1e1e35' }}
                    title="Apagar selecionados"
                    disabled={selectedIds.size === 0}
                    onClick={triggerDeleteSelected}
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    style={sidebarIconBtn(false)}
                    title="Cancelar seleção"
                    onClick={exitSelectMode}
                  >
                    <X size={13} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {sourceLabel && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#445', fontFamily: 'inherit' }}>
                    <img src={sourceLabel === 'Claude' ? claudeChatIcon : gardenChatIcon} style={{ width: 12, height: 12, imageRendering: 'pixelated' as const }} />
                    {sourceLabel}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'center', marginLeft: 'auto' }}>
                  {/* Novo chat — ação principal */}
                  <button
                    style={{ ...sidebarIconBtn(false), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', background: 'rgba(74,74,170,0.18)', border: '1px solid #3a3a88', color: '#8899ff' }}
                    title={tl('chatNewConv')}
                    onClick={() => newConversation(isAnonymous)}
                  >
                    <Plus size={15} />
                  </button>
                  {/* Anon toggle */}
                  <button
                    style={{ ...sidebarIconBtn(isAnonymous), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px' }}
                    title={tl('chatAnonToggle')}
                    onClick={() => {
                      setIsAnonymous(!isAnonymous);
                      newConversation(!isAnonymous);
                    }}
                  >
                    {isAnonymous ? <Ghost size={15} /> : <Eye size={15} />}
                  </button>

                  {/* Separador */}
                  <div style={{ width: 1, height: 16, background: '#1e1e35', margin: '0 2px' }} />

                  {/* Toggle Buddy sessions */}
                  <button
                    style={{ ...sidebarIconBtn(showBuddySessions), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px' }}
                    title={showBuddySessions ? 'Ocultar sessões Buddy' : 'Mostrar sessões Buddy'}
                    onClick={() => setShowBuddySessions(v => !v)}
                  >
                    <img src={gardenChatIcon} style={{ width: 16, height: 16, imageRendering: 'pixelated' as const }} />
                  </button>
                  {/* Toggle Claude sessions */}
                  <button
                    style={{ ...sidebarIconBtn(showClaudeSessions), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px' }}
                    title={showClaudeSessions ? 'Ocultar sessões Claude' : 'Mostrar sessões Claude'}
                    onClick={() => setShowClaudeSessions(v => !v)}
                  >
                    <img src={claudeChatIcon} style={{ width: 16, height: 16, imageRendering: 'pixelated' as const }} />
                  </button>

                  {/* Separador */}
                  <div style={{ width: 1, height: 16, background: '#1e1e35', margin: '0 2px' }} />

                  {/* Selecionar para deletar */}
                  <button
                    style={{ ...sidebarIconBtn(false), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px' }}
                    title="Selecionar para deletar"
                    onClick={() => {
                      setSelectMode(true);
                      const allDirs = new Set<string>();
                      for (const conv of conversations) {
                        for (const dir of conv.projectDirs ?? (conv.projectDir ? [conv.projectDir] : [])) allDirs.add(dir);
                      }
                      for (const s of claudeSessions) { if (s.projectDir) allDirs.add(s.projectDir); }
                      setExpandedProjects(allDirs);
                      setProjectsOpen(true);
                      setChatsOpen(true);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>

                  {/* Separador */}
                  <div style={{ width: 1, height: 16, background: '#1e1e35', margin: '0 2px' }} />

                  {/* ⓘ Info — hover, último pois é o menos usado */}
                  <div ref={infoRef} style={{ position: 'relative' }} onMouseEnter={() => setInfoTooltip(true)} onMouseLeave={() => setInfoTooltip(false)}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #2a2a44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#445', cursor: 'default', userSelect: 'none', fontFamily: 'serif', fontStyle: 'italic' }}>i</div>
                    {infoTooltip && (
                      <div style={{ position: 'fixed', top: 48, left: 8, right: 8, maxWidth: 284, background: '#0f0f22', border: '1px solid #2a2a44', boxShadow: '0 6px 32px rgba(0,0,0,0.85)', zIndex: 500, padding: '14px 16px', fontSize: 13, color: '#888', lineHeight: 1.7, fontFamily: 'inherit' }}>
                        <div style={{ marginBottom: 12, color: '#aabbff', fontWeight: 700, fontSize: 13 }}>Legenda da sidebar</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <img src={gardenChatIcon} style={{ width: 16, height: 16, imageRendering: 'pixelated', flexShrink: 0 }} />
                          <span><strong style={{ color: '#ccc' }}>Buddy Garden</strong> — conversa salva localmente pelo buddy.land</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <img src={claudeChatIcon} style={{ width: 16, height: 16, imageRendering: 'pixelated', flexShrink: 0 }} />
                          <span><strong style={{ color: '#ccc' }}>Claude Code</strong> — sessão do Claude CLI em <code style={{ fontSize: 10, color: '#7a9fff' }}>~/.claude/projects/</code></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Folder size={14} style={{ color: '#445', flexShrink: 0 }} />
                          <span><strong style={{ color: '#ccc' }}>Projetos</strong> — agrupa conversas pela pasta de contexto associada</span>
                        </div>
                        <div style={{ borderTop: '1px solid #1a1a30', paddingTop: 8, marginTop: 4 }}>
                          <span style={{ color: '#555' }}>Conversas sem pasta ficam em <strong style={{ color: '#777' }}>CONVERSAS</strong> diretamente.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {isAnonymous && (
            <div style={anonBannerStyle}>
              <span style={{ fontSize: '11px', color: '#888' }}>
                {tl('chatAnonymousBadge')}
              </span>
            </div>
          )}

          {/* Busca por título */}
          <div style={{ padding: '6px 8px', borderBottom: '1px solid #141428' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0a0a18', border: '1px solid #1e1e35', borderRadius: 4, padding: '4px 8px' }}>
              <Search size={12} style={{ color: '#445', flexShrink: 0 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar chats..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: '#aaa', fontFamily: 'inherit' }}
              />
              {searchQuery && (
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#445', display: 'flex' }}
                  onClick={() => setSearchQuery('')}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          <div style={convListStyle}>
            {/* ── PROJETOS (accordion) ─────────────────────────────────────── */}
            {(() => {
              type UnifiedItem =
                | { kind: 'buddy'; conv: typeof conversations[number]; ts: number }
                | { kind: 'claude'; session: ClaudeSessionMeta; ts: number };

              const getConvDirs = (conv: typeof conversations[number]) =>
                conv.projectDirs ?? (conv.projectDir ? [conv.projectDir] : []);

              // Filtro de busca
              const sq = searchQuery.trim().toLowerCase();
              const matchesBuddy = (c: typeof conversations[number]) =>
                !sq || (c.title ?? '').toLowerCase().includes(sq);
              const matchesClaude = (s: ClaudeSessionMeta) =>
                !sq || (s.title ?? '').toLowerCase().includes(sq);

              // Monta mapa de projetos → itens
              const dirMap = new Map<string, UnifiedItem[]>();
              if (showBuddySessions) {
                for (const conv of conversations) {
                  for (const dir of getConvDirs(conv)) {
                    const arr = dirMap.get(dir) ?? []; arr.push({ kind: 'buddy', conv, ts: conv.updatedAt }); dirMap.set(dir, arr);
                  }
                }
              }
              if (showClaudeSessions) {
                for (const session of claudeSessions) {
                  if (session.projectDir) {
                    const arr = dirMap.get(session.projectDir) ?? []; arr.push({ kind: 'claude', session, ts: session.lastActivity }); dirMap.set(session.projectDir, arr);
                  }
                }
              }

              // Filtra dirMap pelo searchQuery
              if (sq) {
                for (const [dir, items] of dirMap.entries()) {
                  const filtered = items.filter(i =>
                    i.kind === 'buddy' ? matchesBuddy(i.conv) : matchesClaude(i.session)
                  );
                  if (filtered.length === 0) dirMap.delete(dir);
                  else dirMap.set(dir, filtered);
                }
              }

              // Itens sem projeto
              const orphanItems: UnifiedItem[] = [
                ...(showBuddySessions
                  ? conversations
                      .filter(conv => getConvDirs(conv).length === 0 && matchesBuddy(conv))
                      .map(conv => ({ kind: 'buddy' as const, conv, ts: conv.updatedAt }))
                  : []),
                ...(showClaudeSessions
                  ? claudeSessions.filter(s => !s.projectDir && matchesClaude(s)).map(session => ({ kind: 'claude' as const, session, ts: session.lastActivity }))
                  : []),
              ].sort((a, b) => b.ts - a.ts);

              const renderConvItem = (item: UnifiedItem, _indent = false, paddingLeft = 12) => {
                if (item.kind === 'buddy') {
                  const conv = item.conv;
                  const isSelected = selectedIds.has(conv.id);
                  return (
                    <div
                      key={`buddy-${conv.id}`}
                      style={{
                        ...convItemStyle(conv.id === conversationId),
                        paddingLeft,
                        position: 'relative',
                        background: selectMode && isSelected ? 'rgba(74,74,170,0.22)' : undefined,
                        borderLeft: selectMode && isSelected ? '3px solid #6666cc' : undefined,
                      }}
                      onClick={() => {
                        if (selectMode) { toggleSelect(conv.id); return; }
                        void loadConversation(conv.id);
                        if (isMobile) setSidebarOpen(false);
                      }}
                    >
                      {selectMode && (
                        <div style={{ flexShrink: 0, color: isSelected ? '#aabbff' : '#444', marginRight: 2 }}>
                          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <img
                            src={conv.forkedSessionId ? claudeChatIcon : gardenChatIcon}
                            alt={conv.forkedSessionId ? 'Claude' : 'Buddy'}
                            title={conv.forkedSessionId ? `Forked para Claude · ${conv.forkedProjectDir ?? ''}` : (conv.projectDirs?.length ? `Buddy Garden · ${conv.projectDirs.join(', ')}` : 'Buddy Garden')}
                            style={{ width: 16, height: 16, imageRendering: 'pixelated', opacity: 0.7, flexShrink: 0 }}
                          />
                          <div style={{ fontSize: '14px', color: conv.id === conversationId ? '#aabbff' : '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conv.title}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#555' }}>
                          {formatDate(conv.updatedAt)} · {conv.messageCount} msgs
                        </div>
                      </div>
                      {!selectMode && (
                        <div style={{ flexShrink: 0, display: 'flex', gap: 2 }}>
                          <button style={convActionBtn} title={conv.forkedSessionId ? 'Mover / copiar conversa' : 'Exportar para Claude'} onClick={e => { e.stopPropagation(); setForkModal(conv.id); }}>
                            <GitBranch size={13} />
                          </button>
                          <button style={{ ...convActionBtn, color: '#884444' }} title="Apagar sessão" onClick={e => { e.stopPropagation(); triggerDelete(conv.id); }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  const session = item.session;
                  const claudeId = `claude:${session.sessionId}`;
                  const isSelected = selectedIds.has(claudeId);
                  return (
                    <div
                      key={`claude-${session.sessionId}`}
                      style={{
                        ...convItemStyle(false),
                        paddingLeft,
                        background: selectMode && isSelected ? 'rgba(74,74,170,0.22)' : undefined,
                        borderLeft: selectMode && isSelected ? '3px solid #6666cc' : undefined,
                      }}
                      onClick={() => {
                        if (selectMode) { toggleSelect(claudeId); return; }
                        void loadClaudeSession(session); if (isMobile) setSidebarOpen(false);
                      }}
                    >
                      {selectMode && (
                        <div style={{ flexShrink: 0, color: isSelected ? '#aabbff' : '#444', marginRight: 2 }}>
                          {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                          <img src={claudeChatIcon} alt="Claude" title={`Claude Code · ${session.projectDir}`} style={{ width: 16, height: 16, imageRendering: 'pixelated', opacity: 0.7, flexShrink: 0 }} />
                          <div style={{ fontSize: '14px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {session.title}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#555' }}>
                          {formatDate(session.lastActivity)} · {session.messageCount} msgs
                        </div>
                      </div>
                    </div>
                  );
                }
              };

              // Projetos por fonte
              const claudeDirMap = new Map<string, UnifiedItem[]>();
              const buddyDirMap = new Map<string, UnifiedItem[]>();
              for (const [dir, items] of dirMap.entries()) {
                const ci = items.filter(i => i.kind === 'claude');
                const bi = items.filter(i => i.kind === 'buddy');
                if (ci.length) claudeDirMap.set(dir, ci);
                if (bi.length) buddyDirMap.set(dir, bi);
              }

              // Chats por fonte
              const claudeChats: UnifiedItem[] = showClaudeSessions
                ? claudeSessions.filter(matchesClaude).map(s => ({ kind: 'claude' as const, session: s, ts: s.lastActivity })).sort((a, b) => b.ts - a.ts)
                : [];
              const buddyChats: UnifiedItem[] = showBuddySessions
                ? conversations.filter(matchesBuddy).map(c => ({ kind: 'buddy' as const, conv: c, ts: c.updatedAt })).sort((a, b) => b.ts - a.ts)
                : [];

              const hasProjects = dirMap.size > 0;
              const hasChats = claudeChats.length > 0 || buddyChats.length > 0;

              // Sub-seção (Claude ou Buddy) dentro de PROJETOS ou CONVERSAS
              const renderSubSection = (
                label: string, icon: string, open: boolean, setOpen: (v: boolean) => void,
                count: number, children: React.ReactNode, onExpandAll?: () => void,
              ) => (
                <div>
                  <div style={{ ...subSectionStyle, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
                    <ChevronRight size={11} style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                    <img src={icon} style={{ width: 14, height: 14, imageRendering: 'pixelated' as const, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: '#aaa', fontFamily: 'inherit', fontWeight: 500 }}>{label}</span>
                    {onExpandAll && (
                      <button
                        style={{ ...subSectionChevronBtn, fontSize: 14, padding: '0 5px', color: '#667', lineHeight: 1 }}
                        title="Expandir/recolher todos"
                        onClick={e => { e.stopPropagation(); onExpandAll(); }}
                      >±</button>
                    )}
                    <span style={{ fontSize: 12, color: '#556' }}>{count}</span>
                  </div>
                  {open && children}
                </div>
              );

              const renderProjectGroup = (srcDirMap: Map<string, UnifiedItem[]>, baseIndent: number) =>
                Array.from(srcDirMap.entries()).map(([dir, items]) => {
                  const isExpanded = sq ? true : expandedProjects.has(dir);
                  const sortedItems = [...items].sort((a, b) => b.ts - a.ts);
                  // Ids de conversas Buddy nesta pasta (únicas deletáveis)
                  const folderBuddyIds = items
                    .filter((i): i is { kind: 'buddy'; conv: typeof conversations[number]; ts: number } => i.kind === 'buddy')
                    .map(i => i.conv.id);
                  const folderAllSelected = folderBuddyIds.length > 0 && folderBuddyIds.every(id => selectedIds.has(id));
                  const folderSomeSelected = !folderAllSelected && folderBuddyIds.some(id => selectedIds.has(id));
                  return (
                    <div key={dir}>
                      {/* Linha da pasta */}
                      <div style={{ ...projectItemStyle(isExpanded), paddingLeft: baseIndent, userSelect: 'none' }}>
                        {/* Chevron: expand/collapse sempre disponível */}
                        <div
                          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '2px 3px', color: '#445' }}
                          onClick={e => {
                            e.stopPropagation();
                            setExpandedProjects(prev => {
                              const next = new Set(prev);
                              if (next.has(dir)) next.delete(dir); else next.add(dir);
                              return next;
                            });
                          }}
                        >
                          <ChevronRight size={12} style={{ transition: 'transform 0.15s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                        </div>

                        {/* Select mode: checkbox clicável */}
                        {selectMode && folderBuddyIds.length > 0 && (
                          <div
                            style={{ flexShrink: 0, display: 'flex', cursor: 'pointer', color: folderAllSelected ? '#aabbff' : folderSomeSelected ? '#7788bb' : '#445', marginRight: 2 }}
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                if (folderAllSelected) folderBuddyIds.forEach(id => next.delete(id));
                                else folderBuddyIds.forEach(id => next.add(id));
                                return next;
                              });
                              if (!isExpanded) setExpandedProjects(prev => { const n = new Set(prev); n.add(dir); return n; });
                            }}
                          >
                            {folderAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                          </div>
                        )}

                        <Folder size={13} style={{ flexShrink: 0, color: isExpanded ? '#6db87a' : '#556' }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: isExpanded ? '#cce' : '#aaa', cursor: 'pointer' }}
                          onClick={() => setExpandedProjects(prev => {
                            const next = new Set(prev); if (next.has(dir)) next.delete(dir); else next.add(dir); return next;
                          })}
                        >
                          {dir.split('/').pop() || dir}
                        </span>

                        {/* Botão novo chat — visível, com label */}
                        {!selectMode && (
                          <button
                            style={{
                              flexShrink: 0,
                              background: 'rgba(74,74,170,0.15)',
                              border: '1px solid #3a3a66',
                              color: '#8899dd',
                              cursor: 'pointer',
                              padding: '2px 7px',
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              borderRadius: 3,
                              fontFamily: 'inherit',
                              whiteSpace: 'nowrap',
                            }}
                            title={`Iniciar novo chat em: ${dir}`}
                            onClick={e => {
                              e.stopPropagation();
                              newConversation(false);
                              void addConvProjectDir(dir);
                              if (isMobile) setSidebarOpen(false);
                            }}
                          >
                            <Plus size={10} />
                            chat
                          </button>
                        )}
                        <span style={{ fontSize: 11, color: '#445', flexShrink: 0, marginLeft: 4 }}>{items.length}</span>
                      </div>
                      {isExpanded && sortedItems.map(item => renderConvItem(item, false, baseIndent + 14))}
                    </div>
                  );
                });

              return (
                <>
                  {/* ── PROJETOS ── */}
                  {hasProjects && (
                    <>
                      <div style={{ ...sectionLabelStyle, cursor: 'pointer' }} onClick={() => setProjectsOpen(o => !o)}>
                        <ChevronRight size={11} style={{ flexShrink: 0, transition: 'transform 0.15s', transform: projectsOpen ? 'rotate(90deg)' : 'rotate(0deg)', color: '#556' }} />
                        <span style={{ flex: 1 }}>PROJETOS</span>
                        <button
                          style={{ ...subSectionChevronBtn, fontSize: 14, padding: '0 5px', color: '#667', lineHeight: 1 }}
                          title={expandedProjects.size > 0 ? 'Recolher todos' : 'Expandir todos'}
                          onClick={e => {
                            e.stopPropagation();
                            if (expandedProjects.size > 0) {
                              setExpandedProjects(new Set());
                            } else {
                              setProjectsOpen(true);
                              setExpandedProjects(new Set(Array.from(dirMap.keys())));
                            }
                          }}
                        >±</button>
                      </div>
                      {projectsOpen && (bothActive ? (
                        <>
                          {showClaudeSessions && claudeDirMap.size > 0 && renderSubSection(
                            'Claude', claudeChatIcon, claudeProjectsOpen, setClaudeProjectsOpen,
                            Array.from(claudeDirMap.values()).reduce((s, a) => s + a.length, 0),
                            renderProjectGroup(claudeDirMap, 28),
                            () => {
                              const dirs = Array.from(claudeDirMap.keys());
                              setExpandedProjects(prev => {
                                const anyExpanded = dirs.some(d => prev.has(d));
                                const next = new Set(prev);
                                if (anyExpanded) { dirs.forEach(d => next.delete(d)); }
                                else { setProjectsOpen(true); setClaudeProjectsOpen(true); dirs.forEach(d => next.add(d)); }
                                return next;
                              });
                            },
                          )}
                          {showBuddySessions && buddyDirMap.size > 0 && renderSubSection(
                            'Buddy', gardenChatIcon, buddyProjectsOpen, setBuddyProjectsOpen,
                            Array.from(buddyDirMap.values()).reduce((s, a) => s + a.length, 0),
                            renderProjectGroup(buddyDirMap, 28),
                            () => {
                              const dirs = Array.from(buddyDirMap.keys());
                              setExpandedProjects(prev => {
                                const anyExpanded = dirs.some(d => prev.has(d));
                                const next = new Set(prev);
                                if (anyExpanded) { dirs.forEach(d => next.delete(d)); }
                                else { setProjectsOpen(true); setBuddyProjectsOpen(true); dirs.forEach(d => next.add(d)); }
                                return next;
                              });
                            },
                          )}
                        </>
                      ) : renderProjectGroup(dirMap, 12))}
                    </>
                  )}

                  {/* ── CONVERSAS ── */}
                  {hasChats && (
                    <>
                      <div style={{ ...sectionLabelStyle, cursor: 'pointer' }} onClick={() => setChatsOpen(o => !o)}>
                        <ChevronRight size={11} style={{ flexShrink: 0, transition: 'transform 0.15s', transform: chatsOpen ? 'rotate(90deg)' : 'rotate(0deg)', color: '#556' }} />
                        <span style={{ flex: 1 }}>CONVERSAS</span>
                        {bothActive && (
                          <button
                            style={{ ...subSectionChevronBtn, fontSize: 14, padding: '0 5px', color: '#667', lineHeight: 1 }}
                            title={claudeChatsOpen || buddyChatsOpen ? 'Recolher todos' : 'Expandir todos'}
                            onClick={e => {
                              e.stopPropagation();
                              const anyOpen = claudeChatsOpen || buddyChatsOpen;
                              setClaudeChatsOpen(!anyOpen);
                              setBuddyChatsOpen(!anyOpen);
                              if (!chatsOpen) setChatsOpen(true);
                            }}
                          >±</button>
                        )}
                      </div>
                      {chatsOpen && (bothActive ? (
                        <>
                          {showClaudeSessions && claudeChats.length > 0 && renderSubSection('Claude', claudeChatIcon, claudeChatsOpen, setClaudeChatsOpen, claudeChats.length, claudeChats.map(i => renderConvItem(i, false, 28)))}
                          {showBuddySessions && buddyChats.length > 0 && renderSubSection('Buddy', gardenChatIcon, buddyChatsOpen, setBuddyChatsOpen, buddyChats.length, buddyChats.map(i => renderConvItem(i, false, 28)))}
                        </>
                      ) : [...claudeChats, ...buddyChats].sort((a, b) => b.ts - a.ts).map(i => renderConvItem(i, false)))}
                    </>
                  )}

                  {/* Estado vazio */}
                  {!hasChats && !hasProjects && !isAnonymous && (
                    <div style={{ padding: '20px 12px', color: '#444', fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
                      {tl('chatNoConversations')}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Export toast — auto-fecha em 3s */}
      {exportToast && (
        <div style={exportToastStyle} onClick={() => setExportToast(null)}>
          <span style={{ fontSize: 13, color: '#aabbff' }}>{exportToast.cmd}</span>
          {exportToast.path && (
            <div style={{ fontSize: 10, color: '#556', marginTop: 4 }}>📁 {exportToast.path}</div>
          )}
        </div>
      )}

      {/* Main chat area */}
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <button onClick={() => setSidebarOpen(s => !s)} style={iconBtnStyle} title="histórico">
            <SidebarToggleIcon open={sidebarOpen} />
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
              <span style={{ fontFamily: 'inherit', fontSize: 12, color: '#4caf50', display: 'block', marginTop: 2 }}>
                {tl('chatTyping')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Ícone de contexto — só no header quando sidebar fechado */}
            {!sidebarOpen && (
              <img
                src={activeConvMeta?.forkedSessionId ? claudeChatIcon : gardenChatIcon}
                alt={activeConvMeta?.forkedSessionId ? 'Claude Code' : 'Buddy Garden'}
                title={activeConvMeta?.forkedSessionId
                  ? `Forked para Claude · ${activeConvMeta.forkedProjectDir ?? ''}`
                  : activeConvProjectDirs.length ? `Buddy Garden · ${activeConvProjectDirs.join(', ')}` : 'Buddy Garden'}
                style={{ width: 28, height: 28, imageRendering: 'pixelated', opacity: 0.85, flexShrink: 0 }}
              />
            )}
            {/* Chips de pastas de contexto */}
            {lockedProjectDir ? (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: '#0d1020', border: '1px solid #2a2a5a',
                  padding: '2px 6px', fontSize: 11, color: '#7a9fff',
                }}
                title={`Sessão Claude — pasta travada: ${lockedProjectDir}`}
              >
                <Lock size={10} style={{ opacity: 0.6, flexShrink: 0 }} />
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lockedProjectDir.split('/').pop()}
                </span>
              </div>
            ) : (
              <>
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
                      style={{ background: 'none', border: 'none', color: '#4a7a4a', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', alignItems: 'center' }}
                      title={`Remover ${dir}`}
                    >
                      <X size={10} />
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
                  <FolderPlus size={14} />
                </button>
              </>
            )}
            <button
              onClick={() => setShowSetup(s => !s)}
              style={{ ...iconBtnStyle, color: showSetup ? '#aabbff' : '#aaa', display: 'flex', alignItems: 'center' }}
              title={tl('chatConfigBtn')}
            >
              <Settings size={15} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Config panel */}
        {showSetup && (
          <div style={setupPanelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={pixelText(10)}>{tl('chatConfigTitle')}</span>
              <button onClick={() => setShowSetup(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
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
                            <span style={{ fontFamily: 'inherit', fontWeight: 600, fontSize: 14, color: isSelected ? '#eee' : '#aaa' }}>
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
                                      fontFamily: 'inherit',
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

          </div>
        )}

        {/* Messages */}
        <div style={messagesStyle}>
          {messages.length === 0 && (
            !conversationsLoaded
              ? <PixelLoader text="LOADING" size="md" />
              : <div style={{ textAlign: 'center', padding: '48px 24px', color: '#444' }}>
                  <span style={{ ...pixelText(9), color: '#333' }}>{tl('chatEmptyHint')}</span>
                </div>
          )}
          {(() => {
            const visibleMessages = messages.filter(m => !m.hidden);
            const lastAssistantIdx = visibleMessages.reduce((last, m, i) => m.role === 'assistant' ? i : last, -1);
            return visibleMessages.map((msg, i) => {
            const isCommandResult = msg.role === 'user' && (
              msg.content.startsWith('[Comando executado]') ||
              msg.content.startsWith('[Erro no comando]')
            );
            const showOnLeft = msg.role === 'assistant' || isCommandResult;
            const isLastAssistant = msg.role === 'assistant' && i === lastAssistantIdx;
            return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: showOnLeft ? 'row' : 'row-reverse',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '14px',
              }}
            >
              {showOnLeft && data.bones && (
                <div style={{ flexShrink: 0, width: 44, height: 44 }}>
                  {isLastAssistant && (isDragon
                    ? <DragonBuddy size={44} mood="happy" isMoving={false} />
                    : <BuddySprite bones={data.bones} frame={frame} size={44} />
                  )}
                </div>
              )}
              <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column' }}>
                <div style={msgBubbleStyle(!showOnLeft)}>
                  <MarkdownRenderer content={msg.content} streaming={msg.streaming} style={{ fontSize: 15, fontFamily: chatFont }} />
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
            );
          });
          })()}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={formStyle}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={isStreaming ? tl('chatWaiting') : tl('chatPlaceholder')}
            style={inputStyle}
            autoFocus
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            style={{ ...sendBtnStyle(isStreaming || !input.trim()), display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Send size={16} />
          </button>
        </form>

        <style>{`
          @keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
        `}</style>
      </div>

      {/* Modal de fork / mover conversa */}
      {forkModal && (() => {
        const conv = conversations.find(c => c.id === forkModal);
        if (!conv) return null;
        const isInClaude = !!conv.forkedSessionId;
        return (
          <div style={modalOverlayStyle} onClick={() => setForkModal(null)}>
            <div style={forkModalBoxStyle} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GitBranch size={16} style={{ color: '#7a9fff' }} />
                  <span style={{ ...pixelText(9), color: '#aabbff' }}>mover conversa</span>
                </div>
                <button onClick={() => setForkModal(null)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Exportar (move) */}
                <button
                  style={forkOptionBtn(false)}
                  onClick={() => { void handleFork(forkModal, isInClaude ? 'to-buddy' : 'to-claude', false); }}
                >
                  <div style={{ color: '#7a9fff', flexShrink: 0, display: 'flex' }}>
                    {isInClaude ? <ArrowLeftFromLine size={16} /> : <ArrowRightFromLine size={16} />}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, color: '#dde', fontWeight: 600 }}>
                      {isInClaude ? 'Importar para Buddy' : 'Exportar para Claude'}
                    </div>
                    <div style={{ fontSize: 11, color: '#556', marginTop: 2 }}>
                      Copia e apaga da origem
                    </div>
                  </div>
                </button>
                {/* Copiar para ambos */}
                <button
                  style={forkOptionBtn(false)}
                  onClick={() => { void handleFork(forkModal, isInClaude ? 'to-buddy' : 'to-claude', true); }}
                >
                  <div style={{ color: '#7ac', flexShrink: 0, display: 'flex' }}>
                    <Copy size={16} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, color: '#dde', fontWeight: 600 }}>Copiar para ambos</div>
                    <div style={{ fontSize: 11, color: '#556', marginTop: 2 }}>
                      Mantém nos dois lugares
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Project picker modal */}
      {showProjectPicker && (
        <ProjectPicker
          currentDirs={activeConvProjectDirs}
          onClose={() => setShowProjectPicker(false)}
          onAdd={dir => { void addConvProjectDir(dir); }}
          onRemove={dir => { void removeConvProjectDir(dir); }}
        />
      )}

    {/* Modal de confirmação de deleção */}
    {deleteConfirm && (() => {
      const ids = deleteConfirm.ids;
      const buddyCount = conversations.filter(c => ids.includes(c.id) && !c.forkedSessionId).length;
      const claudeCount = conversations.filter(c => ids.includes(c.id) && !!c.forkedSessionId).length;
      const total = ids.length;
      const isBulk = total > 1;
      return (
        <div style={modalOverlayStyle} onClick={() => setDeleteConfirm(null)}>
          <div style={modalBoxStyle} onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: 14, color: '#ff6666' }}>
              <Trash2 size={22} />
            </div>
            <div style={{ ...pixelText(10), marginBottom: 10, color: '#eee' }}>
              {isBulk ? `Apagar ${total} conversas?` : 'Apagar conversa?'}
            </div>
            {isBulk && (
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8, display: 'flex', gap: 10, justifyContent: 'center' }}>
                {buddyCount > 0 && <span style={{ color: '#7fb0cc' }}>{buddyCount} buddy</span>}
                {buddyCount > 0 && claudeCount > 0 && <span style={{ color: '#444' }}>·</span>}
                {claudeCount > 0 && <span style={{ color: '#cc9955' }}>{claudeCount} claude</span>}
                <span style={{ color: '#444' }}>·</span>
                <span style={{ color: '#666' }}>{total} total</span>
              </div>
            )}
            <div style={{ fontSize: 12, color: '#666', marginBottom: 22 }}>
              Essa ação é irreversível.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                style={modalCancelBtnStyle}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button
                style={modalDeleteBtnStyle}
                onClick={() => void confirmDelete()}
              >
                <Trash2 size={11} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                Apagar
              </button>
            </div>
          </div>
        </div>
      );
    })()}
  </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const outerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex',
  background: '#0d0d1e',
  fontFamily: 'inherit',
};

const sidebarStyle: React.CSSProperties = {
  background: '#080812',
  borderRight: '1px solid #1a1a30',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  animation: 'slideInRight 0.18s ease-out',
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 12px 10px',
  borderBottom: '1px solid #1a1a30',
  background: '#0a0a18',
};

const sidebarMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  right: 0,
  background: '#0f0f22',
  border: '1px solid #2a2a44',
  boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
  zIndex: 200,
  minWidth: 220,
  display: 'flex',
  flexDirection: 'column',
  padding: '4px 0',
};

const menuItemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 14px',
  background: active ? 'rgba(74,74,170,0.12)' : 'transparent',
  border: 'none',
  color: active ? '#aabbff' : '#888',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
  width: '100%',
  textAlign: 'left' as const,
});

const menuDividerStyle: React.CSSProperties = {
  height: 1,
  background: '#1a1a30',
  margin: '3px 0',
};

const claudeToggleBtn = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  background: active ? 'rgba(180,140,80,0.2)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${active ? 'rgba(180,140,80,0.5)' : '#252535'}`,
  color: active ? '#e0b870' : '#666',
  cursor: 'pointer',
  padding: '4px 8px',
  fontSize: '10px',
  fontFamily: 'inherit',
  borderRadius: 2,
  whiteSpace: 'nowrap' as const,
});

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

const sectionLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 12px 6px',
  fontSize: 13,
  color: '#778',
  letterSpacing: '0.06em',
  fontFamily: 'inherit',
  fontWeight: 700,
  borderTop: '1px solid #0f0f1e',
  marginTop: 2,
};

const projectItemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '7px 12px',
  cursor: 'pointer',
  background: active ? 'rgba(109,184,122,0.08)' : 'transparent',
  borderLeft: active ? '3px solid #3a8a4a' : '3px solid transparent',
  borderBottom: '1px solid #0a0a16',
});

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

const subSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px 5px 16px',
  cursor: 'default',
  background: 'rgba(255,255,255,0.02)',
};

const subSectionChevronBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#445',
  cursor: 'pointer',
  padding: '0 2px',
  display: 'flex',
  alignItems: 'center',
};

const convActionBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#444',
  cursor: 'pointer',
  padding: '4px 5px',
  display: 'flex',
  alignItems: 'center',
  borderRadius: 3,
};

const containerStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center',
  padding: '10px 14px',
  background: '#0d0d1e',
  borderBottom: '1px solid #1a1a30',
  gap: 6,
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
  animation: 'fadeDown 0.18s ease-out',
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
  padding: '13px 17px',
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
  flex: 1, padding: '11px 15px',
  background: '#141430',
  border: '1px solid #2a2a50',
  color: '#eee',
  fontFamily: 'inherit',
  fontSize: '15px',
  outline: 'none',
};

const sendBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '11px 20px',
  background: disabled ? '#1a1a30' : '#3a5acc',
  border: `1px solid ${disabled ? '#252535' : '#5a7aee'}`,
  color: disabled ? '#444' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: '"Press Start 2P", monospace',
  fontSize: '13px',
  boxShadow: disabled ? 'none' : '0 2px 8px rgba(58,90,204,0.3)',
});

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #1e1e35',
  color: '#888',
  cursor: 'pointer',
  padding: '6px 10px',
  fontSize: '16px',
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

/** Ícone de toggle do aside — estilo ChatGPT/Claude */
function SidebarToggleIcon(_: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      {/* Borda do painel */}
      <rect x="1.5" y="1.5" width="17" height="17" rx="3.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Separador vertical do aside */}
      <line x1="7" y1="1.5" x2="7" y2="18.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Linhas de conteúdo no painel principal */}
      <line x1="10" y1="7"  x2="15" y2="7"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Modal de confirmação de deleção ──────────────────────────────────────────

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  animation: 'fadeIn 0.12s ease-out',
};

const modalBoxStyle: React.CSSProperties = {
  background: '#0f0f22',
  border: '1px solid #2a2a55',
  boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
  padding: '28px 32px',
  maxWidth: 340,
  width: '90vw',
  textAlign: 'center',
  animation: 'fadeDown 0.15s ease-out',
};

const forkModalBoxStyle: React.CSSProperties = {
  background: '#0f0f22',
  border: '1px solid #2a2a55',
  boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
  padding: '20px 24px',
  width: 300,
  maxWidth: '90vw',
  animation: 'fadeDown 0.15s ease-out',
};

function forkOptionBtn(_active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 12,
    width: '100%', textAlign: 'left',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #1e1e40',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.1s',
  };
}

const modalCancelBtnStyle: React.CSSProperties = {
  padding: '9px 20px',
  background: 'transparent',
  border: '1px solid #2a2a44',
  color: '#888',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
};

const modalDeleteBtnStyle: React.CSSProperties = {
  padding: '9px 20px',
  background: 'rgba(160,40,40,0.25)',
  border: '1px solid #662222',
  color: '#ff6666',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 13,
};

// ── Font picker ───────────────────────────────────────────────────────────────

export const CHAT_FONTS: { label: string; value: string; previewSize?: number }[] = [
  { label: 'Press Start 2P',  value: '"Press Start 2P", monospace', previewSize: 10 },
  { label: 'Silkscreen',      value: '"Silkscreen", monospace',      previewSize: 13 },
  { label: 'VT323',           value: '"VT323", monospace',           previewSize: 18 },
  { label: 'Pixelify Sans',   value: '"Pixelify Sans", sans-serif',  previewSize: 14 },
  { label: 'Sans-serif',      value: 'sans-serif',                   previewSize: 14 },
  { label: 'Monospace',       value: 'monospace',                    previewSize: 13 },
];
