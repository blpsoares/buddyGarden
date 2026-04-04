/**
 * BuddyMode — modo "Pou": pet + chat lado a lado.
 *
 * Layout:
 *   - Sem mensagens: pet centralizado na tela inteira
 *   - Com mensagens: chat scroll à esquerda | pet fixo à direita
 *
 * Estados do dragão:
 *   idle     → breathe loop (idle atlas, 8fps)
 *   roaming  → walk loop 2x (walk atlas, 10fps) → idle
 *   reacting → fire breath once (special atlas, 12fps) → idle
 *   sleeping → sleep loop (sleep atlas, 4fps)
 *
 * Transições:
 *   idle     → reacting  : clique no pet
 *   idle     → sleeping  : mood=tired
 *   idle     → roaming   : aleatório ~20s (40% chance)
 *   reacting → idle      : onAnimEnd
 *   sleeping → idle      : mood≠tired
 *   roaming  → idle      : onAnimEnd (2 loops de walk)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Maximize2 } from 'lucide-react';
import { useBuddy } from '../hooks/useBuddy.ts';
import { useSharedChat } from '../context/ChatContext.tsx';
import { DragonBuddy, type DragonAnim } from '../components/DragonBuddy.tsx';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { DragonNightBackground } from '../backgrounds/DragonBackground.tsx';
import { RarityBadge } from '../components/RarityBadge.tsx';
import { MarkdownRenderer } from '../components/MarkdownRenderer.tsx';
import { useT } from '../hooks/useT.ts';
import type { Page } from '../App.tsx';

type PetState = 'idle' | 'roaming' | 'reacting' | 'sleeping';

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊', excited: '🤩', tired: '😴', bored: '😑', focused: '🔍', chaotic: '🌀',
};

interface Props {
  onNavigate: (page: Page) => void;
}

export function BuddyMode({ onNavigate }: Props) {
  const { data } = useBuddy();
  const tl = useT();
  const {
    messages, send, isStreaming, lang,
    isAnonymous, newConversation, conversationId,
  } = useSharedChat();

  const [petState, setPetState] = useState<PetState>('idle');
  const [mood, setMood] = useState('happy');
  const [input, setInput] = useState('');
  const [frame, setFrame] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const roamLoopRef = useRef(0);

  // WebSocket mood
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/mood`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; mood: string };
        if (msg.type === 'mood') setMood(msg.mood);
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, []);

  // Sprite frame para não-dragon
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

  // Transição idle → sleeping quando cansado
  useEffect(() => {
    if (mood === 'tired' && petState === 'idle') setPetState('sleeping');
    if (mood !== 'tired' && petState === 'sleeping') setPetState('idle');
  }, [mood, petState]);

  // Roaming aleatório: a cada ~20s, 40% de chance
  useEffect(() => {
    if (petState !== 'idle') return;
    const t = setInterval(() => {
      if (Math.random() < 0.4) {
        roamLoopRef.current = 0;
        setPetState('roaming');
      }
    }, 20_000);
    return () => clearInterval(t);
  }, [petState]);

  // Quando a conversa está vazia ao abrir BuddyMode, inicia nova conversa
  useEffect(() => {
    if (messages.length === 0 && !conversationId) {
      newConversation(isAnonymous);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-foco no input ao montar
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll para o fim — usa scrollTop direto no container para não escapar
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handlePetClick = useCallback(() => {
    inputRef.current?.focus();
    if (petState === 'sleeping') {
      setPetState('idle');
      return;
    }
    if (petState === 'idle' || petState === 'roaming') {
      setPetState('reacting');
    }
  }, [petState]);

  const handleAnimEnd = useCallback(() => {
    if (petState === 'reacting') {
      setPetState('idle');
      return;
    }
    if (petState === 'roaming') {
      roamLoopRef.current += 1;
      if (roamLoopRef.current >= 2) {
        setPetState('idle');
      } else {
        setPetState('idle');
        setTimeout(() => setPetState('roaming'), 50);
      }
    }
  }, [petState]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    void send(text);
    // Re-foca após envio
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [input, isStreaming, send]);

  if (!data.bones && !data.soul) {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🥚</div>
          <span style={pixelText(10)}>seu buddy ainda não nasceu</span>
        </div>
      </div>
    );
  }

  const { bones, soul } = data;
  const isDragon = bones?.species === 'dragon';
  const petName = soul?.name ?? bones?.species ?? 'Buddy';

  const forceAnim: DragonAnim =
    petState === 'sleeping'  ? 'sleep'   :
    petState === 'roaming'   ? 'walk'    :
    petState === 'reacting'  ? 'special' :
    'idle';

  const hasMessages = messages.length > 0;

  return (
    <div style={containerStyle}>
      {/* Background */}
      {isDragon ? (
        <DragonNightBackground />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#04001a 0%,#14004a 55%,#1a0048 100%)' }} />
      )}

      {/* ── HUD top ── */}
      <div style={hudTopStyle}>
        <button onClick={() => onNavigate('garden')} style={modeToggleBtn} title="Voltar ao jardim">
          <ArrowLeft size={16} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
          <span style={pixelText(9)}>{petName}</span>
          {bones && <RarityBadge rarity={bones.rarity} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
          <span style={{ fontFamily: 'inherit', fontSize: 11, color: '#aaa' }}>
            {MOOD_EMOJI[mood] ?? '😊'} {mood}
          </span>
          <span style={{ fontFamily: 'inherit', fontSize: 10, color: '#555' }}>
            {data.level} · {data.xp.toLocaleString()} xp
          </span>
        </div>
      </div>

      {/* ── Conteúdo principal ── */}
      <div style={mainContentStyle}>
        {/* Chat (visível quando há mensagens) */}
        {hasMessages && (
          <div style={chatPanelStyle}>
            <div ref={messagesContainerRef} style={messagesListStyle}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    ...msgRowStyle,
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={avatarStyle}>
                      {isDragon && bones ? (
                        <DragonBuddy size={28} mood={mood} forceAnim="idle" />
                      ) : bones ? (
                        <BuddySprite bones={bones} frame={frame} size={28} expression="happy" />
                      ) : (
                        <span style={{ fontSize: 18 }}>🐾</span>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      ...bubbleStyle,
                      background: msg.role === 'user'
                        ? 'rgba(55,55,140,0.92)'
                        : 'rgba(14,14,40,0.92)',
                      border: `1px solid ${msg.role === 'user' ? 'rgba(100,100,200,0.5)' : 'rgba(60,60,120,0.4)'}`,
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    {msg.role === 'assistant' && (
                      <span style={{ fontFamily: '"Press Start 2P",monospace', fontSize: 7, color: '#6666cc', display: 'block', marginBottom: 4 }}>
                        {petName}
                      </span>
                    )}
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer
                        content={msg.content}
                        streaming={msg.streaming}
                        style={{ fontSize: 13, lineHeight: 1.5 }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'inherit', fontSize: 13, color: '#eee', lineHeight: 1.5 }}>
                        {msg.content}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div />
            </div>
          </div>
        )}

        {/* Pet */}
        <div
          style={{
            ...petAreaStyle,
            flex: hasMessages ? '0 0 auto' : '1',
            alignItems: hasMessages ? 'flex-end' : 'center',
            justifyContent: hasMessages ? 'flex-end' : 'center',
            paddingBottom: hasMessages ? '0' : '60px',
          }}
          onClick={handlePetClick}
        >
          <div style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {isDragon && bones ? (
              <DragonBuddy
                size={hasMessages ? 220 : 400}
                mood={mood}
                isMoving={petState === 'roaming'}
                forceAnim={forceAnim}
                onAnimEnd={handleAnimEnd}
              />
            ) : bones ? (
              <BuddySprite
                bones={bones}
                frame={frame}
                size={hasMessages ? 180 : 320}
                expression={petState === 'sleeping' ? 'sleepy' : petState === 'reacting' ? 'excited' : 'happy'}
              />
            ) : null}

            {petState === 'sleeping' && (
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 20, animation: 'float 2s ease-in-out infinite' }}>💤</span>
              </div>
            )}
            {petState === 'reacting' && (
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 20 }}>🔥</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Hint quando sem mensagens ── */}
      {!hasMessages && petState === 'idle' && (
        <div style={hintStyle}>
          <span style={{ fontFamily: 'inherit', fontSize: 11, color: '#444' }}>
            {tl('buddyMsgHint')}
          </span>
        </div>
      )}

      {/* ── Input bar ── */}
      <form onSubmit={handleSubmit} style={inputBarStyle}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={isStreaming
            ? (lang === 'pt' ? 'aguardando...' : 'waiting...')
            : (lang === 'pt' ? 'mensagem...' : 'message...')}
          disabled={isStreaming}
          style={inputStyle}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          style={sendBtnStyle(isStreaming || !input.trim())}
        >
          <Send size={14} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate('chat')}
          style={{ ...sendBtnStyle(false), background: 'rgba(30,30,70,0.9)', borderColor: 'rgba(80,80,180,0.4)' }}
          title={tl('chatFullscreen')}
        >
          <Maximize2 size={14} />
        </button>
      </form>

      <style>{`
        @keyframes blink   { 0%,50%{opacity:1} 51%,100%{opacity:0} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const centerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#04001a',
};

const hudTopStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(4px)',
  borderBottom: '1px solid rgba(80,80,180,0.2)',
  flexShrink: 0,
};

const modeToggleBtn: React.CSSProperties = {
  background: 'rgba(20,20,50,0.8)',
  border: '2px solid rgba(80,80,180,0.4)',
  color: '#aaa',
  cursor: 'pointer',
  padding: '6px 10px',
  fontSize: 16,
  boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
};

// Área abaixo do HUD, acima do input bar
const mainContentStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'row',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 5,
  // pet column usa overflow:visible para a animação especial não ser cortada
};

// Painel de chat (esquerda quando há mensagens)
const chatPanelStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 0,
};

const messagesListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '12px 14px 8px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const msgRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
};

const avatarStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'visible',
};

const bubbleStyle: React.CSSProperties = {
  padding: '8px 12px',
  maxWidth: '80%',
  boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
  wordBreak: 'break-word',
};

// Área do pet (direita com mensagens, centralizado sem)
const petAreaStyle: React.CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  padding: '12px 16px',
  cursor: 'pointer',
  overflow: 'visible',
};

const hintStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  bottom: '80px',
  left: '50%',
  transform: 'translateX(-50%)',
  whiteSpace: 'nowrap',
};

const inputBarStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 20,
  display: 'flex',
  gap: 8,
  padding: '10px 14px',
  background: 'rgba(5,5,18,0.85)',
  backdropFilter: 'blur(8px)',
  borderTop: '1px solid rgba(60,60,120,0.35)',
  flexShrink: 0,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '9px 13px',
  background: 'rgba(12,12,32,0.95)',
  border: '1px solid rgba(80,80,180,0.45)',
  color: '#eee',
  fontFamily: 'inherit',
  fontSize: 14,
  outline: 'none',
};

const sendBtnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '9px 14px',
  background: disabled ? 'rgba(20,20,40,0.8)' : 'rgba(74,74,170,0.85)',
  border: `1px solid ${disabled ? 'rgba(50,50,80,0.4)' : 'rgba(120,120,220,0.5)'}`,
  color: disabled ? '#444' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: '"Press Start 2P", monospace',
  fontSize: 11,
});

function pixelText(size: number): React.CSSProperties {
  return {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: size,
    color: '#eee',
    display: 'block',
  };
}
