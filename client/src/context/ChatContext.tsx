import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface ChatContextValue {
  messages: ChatMessage[];
  send: (text: string) => Promise<void>;
  isStreaming: boolean;
  apiKeyMissing: boolean;
  setApiKeyMissing: (v: boolean) => void;
  clear: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  const send = useCallback(async (text: string) => {
    if (isStreaming || !text.trim()) return;

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsStreaming(true);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
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
            if (parsed.error === 'API_KEY_MISSING') {
              setApiKeyMissing(true);
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, content: '⚠️ API key não configurada. Use ⚙ no chat para configurar.', streaming: false };
                }
                return next;
              });
            } else if (parsed.text) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) next[next.length - 1] = { ...last, content: last.content + parsed.text };
                return next;
              });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) next[next.length - 1] = { ...last, content: `Erro: ${e instanceof Error ? e.message : String(e)}`, streaming: false };
        return next;
      });
    } finally {
      setIsStreaming(false);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) {
          if (!last.content.trim()) return next.slice(0, -1);
          next[next.length - 1] = { ...last, streaming: false };
        }
        return next;
      });
    }
  }, [isStreaming, messages]);

  const clear = useCallback(() => { setMessages([]); setApiKeyMissing(false); }, []);

  return (
    <ChatContext.Provider value={{ messages, send, isStreaming, apiKeyMissing, setApiKeyMissing, clear }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useSharedChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useSharedChat must be used within ChatProvider');
  return ctx;
}
