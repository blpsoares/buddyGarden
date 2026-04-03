import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

// ── Extrai o primeiro bloco bash/sh de um texto ────────────────────────────────

const SHELL_BLOCK_RE = /```(?:bash|sh|shell|zsh|fish)\n([\s\S]*?)```/i;

function extractFirstShellCommand(text: string): string | null {
  const m = text.match(SHELL_BLOCK_RE);
  return m?.[1]?.trim() ?? null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CommandStatus = 'pending' | 'allowed' | 'denied' | 'done';

export interface PendingCommand {
  command: string;
  status: CommandStatus;
  output?: string;
  exitCode?: number | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  pendingCommand?: PendingCommand;
  hidden?: boolean;        // mensagem não aparece no UI
  isCommandResult?: boolean; // estilo especial
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  projectDir?: string;
  forkedSessionId?: string;
  forkedProjectDir?: string;
}

interface ChatContextValue {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  isStreaming: boolean;
  apiKeyMissing: boolean;
  setApiKeyMissing: (v: boolean) => void;
  clear: () => void;
  provider: string;
  setProvider: (p: string) => void;
  claudeModel: string;
  setClaudeModel: (m: string) => void;
  approveCommand: (msgIdx: number, alwaysAllow: boolean) => Promise<void>;
  denyCommand: (msgIdx: number) => void;
  sendCommandResult: (command: string, output: string, exitCode: number | null) => Promise<void>;
  // Conversation management
  conversationId: string | null;
  isAnonymous: boolean;
  conversations: ConversationMeta[];
  loadConversation: (id: string) => Promise<void>;
  newConversation: (anonymous?: boolean) => void;
  removeConversation: (id: string) => Promise<void>;
  setIsAnonymous: (v: boolean) => void;
  refreshConversations: () => Promise<void>;
  setConvProjectDir: (dir: string | null) => Promise<void>;
  activeConvMeta: ConversationMeta | null;
  // i18n
  lang: 'pt' | 'en';
  setLang: (l: 'pt' | 'en') => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const [provider, setProvider] = useState('claude-cli');
  const [claudeModel, setClaudeModelState] = useState('claude-haiku-4-5');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [lang, setLangState] = useState<'pt' | 'en'>('pt');

  // Refs para acesso imediato sem closure stale
  const isStreamingRef = useRef(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const isAnonymousRef = useRef(false);
  const providerRef = useRef('claude-cli');
  const langRef = useRef<'pt' | 'en'>('pt');

  // ── Typewriter ────────────────────────────────────────────────────────────────
  // Fila de chars pendentes + timer que drip-feeds a 18ms/tick (≈55fps).
  // Velocidade: 4 chars/tick quando fila < 40 chars (parece digitação humana),
  // 12 chars/tick quando fila > 40 (catch-up sem travar a UI).
  // Quando o provider envia chunks reais (Anthropic/Gemini), a fila fica sempre
  // pequena e o efeito é natural. No CLI (1 chunk grande no final), vira animação.
  const twQueueRef = useRef('');
  const twTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTypewriter = useCallback(() => {
    if (twTimerRef.current) return;
    twTimerRef.current = setInterval(() => {
      const q = twQueueRef.current;
      if (!q.length) return;
      const take = q.length > 40 ? 12 : 4;
      const chars = q.slice(0, take);
      twQueueRef.current = q.slice(take);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) next[next.length - 1] = { ...last, content: last.content + chars };
        return next;
      });
    }, 18);
  }, []);

  const flushTypewriter = useCallback(() => {
    if (twTimerRef.current) { clearInterval(twTimerRef.current); twTimerRef.current = null; }
    const remaining = twQueueRef.current;
    twQueueRef.current = '';
    if (!remaining) return;
    setMessages(prev => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.streaming) next[next.length - 1] = { ...last, content: last.content + remaining };
      return next;
    });
  }, []);

  const applyChunk = useCallback((text: string) => {
    twQueueRef.current += text;
    startTypewriter();
  }, [startTypewriter]);

  // Sincroniza refs com estados
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { isAnonymousRef.current = isAnonymous; }, [isAnonymous]);
  useEffect(() => { providerRef.current = provider; }, [provider]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json() as Promise<{ provider: string; lang?: 'pt' | 'en'; claudeModel?: string }>)
      .then(d => {
        setProvider(d.provider);
        if (d.lang) setLangState(d.lang);
        if (d.claudeModel) setClaudeModelState(d.claudeModel);
      })
      .catch(() => {});
  }, []);

  const setClaudeModel = useCallback((m: string) => {
    setClaudeModelState(m);
  }, []);

  const setLang = useCallback((l: 'pt' | 'en') => {
    setLangState(l);
    void fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: l }),
    }).catch(() => {});
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) setConversations(await res.json() as ConversationMeta[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void refreshConversations(); }, [refreshConversations]);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json() as { messages: Array<{ role: 'user' | 'assistant'; content: string }>; meta: ConversationMeta };
      setMessages((data.messages ?? []).map(m => ({ role: m.role, content: m.content })));
      setConversationId(id);
      setIsAnonymous(false);
      // Atualiza meta na lista para refletir projectDir/forkedSessionId
      if (data.meta) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...data.meta } : c));
      }
    } catch { /* ignore */ }
  }, []);

  const newConversation = useCallback((anonymous = false) => {
    setMessages([]);
    setConversationId(null);
    setIsAnonymous(anonymous);
    setApiKeyMissing(false);
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' }).catch(() => {});
    setConversations(prev => prev.filter(c => c.id !== id));
    if (conversationId === id) {
      setMessages([]);
      setConversationId(null);
    }
  }, [conversationId]);

  const setConvProjectDir = useCallback(async (dir: string | null) => {
    const id = conversationIdRef.current;
    if (!id) return;
    await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir: dir }),
    }).catch(() => {});
    setConversations(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c };
      if (dir) updated.projectDir = dir;
      else delete updated.projectDir;
      return updated;
    }));
  }, []);

  const send = useCallback(async (text: string, _hiddenFromUI = false) => {
    if (isStreamingRef.current || !text.trim()) return;

    // Lê estado via refs (sem closure stale)
    let activeConvId = conversationIdRef.current;
    const currentIsAnonymous = isAnonymousRef.current;
    const currentProvider = providerRef.current;
    const currentLang = langRef.current;

    // history: mensagens visíveis + outputs de comandos como parte do conteúdo
    const history = messagesRef.current
      .filter(m => !m.hidden)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.pendingCommand?.status === 'done'
          ? `${m.content}\n\n[RESULTADO: exit ${m.pendingCommand.exitCode ?? '?'}\n${m.pendingCommand.output ?? ''}]`
          : m.content,
      }));

    // Cria conversa no servidor na primeira mensagem (se não anônimo e mensagem visível)
    if (!currentIsAnonymous && !activeConvId && !_hiddenFromUI) {
      try {
        // Lê projectDir da conversa ativa (se existir) — não existe ainda, então fica undefined
        const res = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firstMessage: text }),
        });
        if (res.ok) {
          const meta = await res.json() as ConversationMeta;
          activeConvId = meta.id;
          setConversationId(meta.id);
          conversationIdRef.current = meta.id;
          setConversations(prev => [meta, ...prev]);
        }
      } catch { /* continua sem persistência */ }
    }

    // Adiciona mensagem do usuário no estado (se visível)
    if (!_hiddenFromUI) {
      setMessages(prev => [...prev, { role: 'user', content: text }]);
    }

    isStreamingRef.current = true;
    setIsStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history, conversationId: activeConvId ?? undefined, lang: currentLang }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw) as { text?: string; error?: string };
            if (parsed.error) {
              flushTypewriter();
              if (parsed.error === 'API_KEY_MISSING') setApiKeyMissing(true);
              const errorMsg = parsed.error === 'API_KEY_MISSING'
                ? '⚠️ API key não configurada. Use ⚙ para configurar.'
                : `⚠️ ${parsed.error}`;
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, content: errorMsg, streaming: false };
                }
                return next;
              });
            } else if (parsed.text) {
              applyChunk(parsed.text);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) {
          next[next.length - 1] = {
            ...last,
            content: `Erro: ${e instanceof Error ? e.message : String(e)}`,
            streaming: false,
          };
        }
        return next;
      });
    } finally {
      flushTypewriter();
      isStreamingRef.current = false;
      setIsStreaming(false);
      // Atualiza lista de conversas para refletir novo messageCount
      if (activeConvId && !currentIsAnonymous && !_hiddenFromUI) {
        setConversations(prev => prev.map(c =>
          c.id === activeConvId ? { ...c, updatedAt: Date.now(), messageCount: c.messageCount + 2 } : c
        ));
      }
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (!last?.streaming) return next;
        if (!last.content.trim()) return next.slice(0, -1);

        let pendingCommand: PendingCommand | undefined;
        if (currentProvider === 'claude-cli') {
          const cmd = extractFirstShellCommand(last.content);
          if (cmd) pendingCommand = { command: cmd, status: 'pending' };
        }

        next[next.length - 1] = { ...last, streaming: false, pendingCommand };
        return next;
      });
    }
  }, []);

  // ── Approve / Deny ────────────────────────────────────────────────────────

  const denyCommand = useCallback((msgIdx: number) => {
    setMessages(prev => {
      const next = [...prev];
      const msg = next[msgIdx];
      if (!msg?.pendingCommand) return prev;
      next[msgIdx] = { ...msg, pendingCommand: { ...msg.pendingCommand, status: 'denied' } };
      return next;
    });
  }, []);

  // ── sendCommandResult: auto-continua após execução de comando ─────────────

  const sendCommandResult = useCallback(async (command: string, output: string, exitCode: number | null) => {
    if (isStreamingRef.current) return;

    const resultText = exitCode === 0
      ? `[Comando executado]\n\`\`\`\n$ ${command}\nexit 0\n${output || '(sem saída)'}\n\`\`\``
      : `[Erro no comando]\n\`\`\`\n$ ${command}\nexit ${exitCode ?? '?'}\n${output || '(sem saída)'}\n\`\`\``;

    // Aguarda um tick para garantir que o estado do comando está 'done'
    await new Promise<void>(resolve => setTimeout(resolve, 50));

    await send(resultText, true);
  }, [send]);

  const approveCommand = useCallback(async (msgIdx: number, alwaysAllow: boolean) => {
    let command = '';
    setMessages(prev => {
      const next = [...prev];
      const msg = next[msgIdx];
      if (!msg?.pendingCommand) return prev;
      command = msg.pendingCommand.command;
      next[msgIdx] = { ...msg, pendingCommand: { ...msg.pendingCommand, status: 'allowed', output: '' } };
      return next;
    });

    if (!command) return;

    if (alwaysAllow) {
      void fetch('/api/config/always-allow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      }).catch(() => {});
    }

    let finalOutput = '';
    let finalExitCode: number | null = null;

    try {
      const res = await fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') continue;
          try {
            const parsed = JSON.parse(raw) as { text?: string; exitCode?: number };
            if (parsed.text != null) {
              finalOutput += parsed.text;
              setMessages(prev => {
                const next = [...prev];
                const msg = next[msgIdx];
                if (!msg?.pendingCommand) return prev;
                next[msgIdx] = {
                  ...msg,
                  pendingCommand: { ...msg.pendingCommand, output: (msg.pendingCommand.output ?? '') + parsed.text },
                };
                return next;
              });
            }
            if (parsed.exitCode != null) {
              finalExitCode = parsed.exitCode;
              setMessages(prev => {
                const next = [...prev];
                const msg = next[msgIdx];
                if (!msg?.pendingCommand) return prev;
                next[msgIdx] = {
                  ...msg,
                  pendingCommand: { ...msg.pendingCommand, status: 'done', exitCode: parsed.exitCode },
                };
                return next;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      const errMsg = `Erro ao executar: ${e instanceof Error ? e.message : String(e)}`;
      finalOutput = errMsg;
      finalExitCode = 1;
      setMessages(prev => {
        const next = [...prev];
        const msg = next[msgIdx];
        if (!msg?.pendingCommand) return prev;
        next[msgIdx] = {
          ...msg,
          pendingCommand: {
            ...msg.pendingCommand,
            status: 'done',
            output: errMsg,
            exitCode: 1,
          },
        };
        return next;
      });
    }

    // Auto-continua: envia resultado do comando para o assistente responder
    setTimeout(() => {
      void sendCommandResult(command, finalOutput, finalExitCode);
    }, 300);
  }, [sendCommandResult]);

  const clear = useCallback(() => {
    setMessages([]);
    setApiKeyMissing(false);
    setConversationId(null);
  }, []);

  const activeConvMeta = conversationId
    ? (conversations.find(c => c.id === conversationId) ?? null)
    : null;

  return (
    <ChatContext.Provider value={{
      messages, send, isStreaming, apiKeyMissing, setApiKeyMissing,
      clear, provider, setProvider, claudeModel, setClaudeModel, approveCommand, denyCommand, sendCommandResult,
      conversationId, isAnonymous, conversations,
      loadConversation, newConversation, removeConversation,
      setIsAnonymous, refreshConversations,
      setConvProjectDir, activeConvMeta,
      lang, setLang,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useSharedChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useSharedChat must be used within ChatProvider');
  return ctx;
}
