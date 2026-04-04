/**
 * PlayMode — brinque com o seu pet.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sprout } from 'lucide-react';
import { useBuddy } from '../hooks/useBuddy.ts';
import { DragonBuddy, type DragonAnim } from '../components/DragonBuddy.tsx';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { DragonNightBackground } from '../backgrounds/DragonBackground.tsx';
import { RarityBadge } from '../components/RarityBadge.tsx';
import { useT } from '../hooks/useT.ts';
import type { Page } from '../App.tsx';

type PlayState =
  | 'idle'
  | 'petting'
  | 'throw_anim'
  | 'fetching'
  | 'returning'
  | 'trick_prompt'   // mostrando o comando do truque
  | 'trick_doing'    // executando o truque
  | 'trick_done';    // comemoração

// ── Vocabulário expandido ────────────────────────────────────────────────────

const VERBS_FETCH_GO = [
  'vai lá', 'corre', 'busca', 'arranca', 'voa', 'dispara', 'foge',
  'sai correndo', 'já tô indo', 'focado', 'mira e corre', 'acelera',
  'não me para', 'manda ver', 'lança',
];

const VERBS_FETCH_SEARCHING = [
  'procurando...', 'fareijando...', 'farejando o chão...', 'explorando a área...',
  'achei uma trilha...', 'quase lá...', 'espera...', 'teve uma distração...',
  'desviei de algo...', 'investigando...', 'cheirando tudo...', 'calculando...',
  'perdendo tempo aqui...', 'quase!', 'reajustando rota...',
];

const ADJECTIVES_FETCH_FOUND = [
  'encontrei', 'achei', 'peguei', 'trouxe', 'consegui', 'localizei',
  'rastreei', 'resgatei', 'capturei', 'recuperei',
];

const EXTRAS_FETCH_FOUND = [
  'e dei uma olhada em tudo', 'e aproveitei pra explorar', 'mas quase me perdi',
  'tinha muita coisa boa por lá', 'o caminho foi longo mas valeu',
  'e ainda vi umas coisas legais', 'com uma pequena viagem de volta',
  'e fiz amizades no caminho', 'foi longe mas tô bem', 'e cheirei umas flores',
  'descobri um atalho secreto', 'e quase fui pra outro mundo',
  'me distraí um pouco', 'demorei mais que o planejado',
];

const REACTIONS_PET = [
  '*ronrona*', 'mais, mais!', 'que bom...', 'to gostando', 'tô brilhando!',
  '*suspira feliz*', 'isso aí!', 'não para...', 'tô no paraíso',
  'você é o melhor', 'tô voando de felicidade', '*ronronaaaaa*',
  'ohhh sim...', 'assim eu te amo', 'continua!',
];

const EMOJIS_PET = ['❤️', '💕', '✨', '💖', '🥰', '💗', '🌟', '💫', '🎀', '🩷'];

// ── Truques ──────────────────────────────────────────────────────────────────

interface Trick {
  command: string;   // o que o usuário "mandou"
  doing: string;     // o que o pet está fazendo
  done: string[];    // frases de comemoração
  emoji: string;
}

const TRICKS: Trick[] = [
  {
    command: 'senta!',
    doing: 'sentando...',
    done: ['sentei! 🐾', 'sabe fazer isso com os olhos fechados', 'fácil demais pra mim', 'sentou na vibe'],
    emoji: '🪑',
  },
  {
    command: 'gira!',
    doing: 'girando...',
    done: ['girei! 🌀', 'ficou tonto', 'girou 720°', 'tontura ativada'],
    emoji: '🌀',
  },
  {
    command: 'pula!',
    doing: 'pulando...',
    done: ['pulei! 🦘', 'chegou na lua quase', 'recorde pessoal!', 'superou a gravidade'],
    emoji: '🦘',
  },
  {
    command: 'deita!',
    doing: 'deitando...',
    done: ['deitei... 😴', 'cama modo ativado', 'pronto pra dormir', 'posição de descanso: perfeita'],
    emoji: '😴',
  },
  {
    command: 'dança!',
    doing: 'dançando...',
    done: ['dançou! 💃', 'movimentos impecáveis', 'ritmo no sangue', 'coreografia nova desbloqueada'],
    emoji: '💃',
  },
  {
    command: 'rugido!',
    doing: 'rugindo...',
    done: ['RAAAWR! 🔊', 'vizinhos ligaram', 'decibelzinho alto', 'poder vocal: máximo'],
    emoji: '🔊',
  },
  {
    command: 'esconde!',
    doing: 'escondendo...',
    done: ['😶‍🌫️ sumiu!', 'camuflagem perfeita', 'ninja mode', 'onde fui parar?!'],
    emoji: '🫥',
  },
  {
    command: 'acena!',
    doing: 'acenando...',
    done: ['oi oi! 👋', 'acena pros fãs', 'muito carismático', 'passou na fama'],
    emoji: '👋',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function buildFetchGoPhrase(): string {
  const verb = pick(VERBS_FETCH_GO);
  const emojis = ['🐾', '💨', '⚡', '🚀', ''];
  return `${verb}! ${pick(emojis)}`.trim();
}

function buildFetchFoundPhrase(petName: string): string {
  const verb = pick(ADJECTIVES_FETCH_FOUND);
  const extra = Math.random() > 0.4 ? ` — ${pick(EXTRAS_FETCH_FOUND)}` : '';
  const emojis = ['🦴', '🥳', '✨', '🎉', '🐾', ''];
  return `${petName} ${verb}! ${pick(emojis)}${extra}`.trim();
}

function buildPetPhrase(): string {
  const reaction = pick(REACTIONS_PET);
  const emoji = pick(EMOJIS_PET);
  return `${emoji} ${reaction}`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface Heart {
  id: number;
  x: number;
  emoji: string;
}

interface Props {
  onNavigate: (page: Page) => void;
}

export function PlayMode({ onNavigate }: Props) {
  const { data } = useBuddy();
  const tl = useT();
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [speechBubble, setSpeechBubble] = useState('');
  const [petOffset, setPetOffset] = useState(0);
  // posição X do pet: null = centro (CSS padrão), 'off-right' = fora pela direita, 'off-left' = fora pela esquerda
  const [petOffscreen, setPetOffscreen] = useState<'center' | 'off-right' | 'off-left'>('center');
  const [petTransition, setPetTransition] = useState(true);
  const [boneVisible, setBoneVisible] = useState(false);
  const [boneX, setBoneX] = useState(0);
  const [currentTrick, setCurrentTrick] = useState<Trick | null>(null);
  const [frame, setFrame] = useState(0);
  const heartIdRef = useRef(0);
  const pettingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phraseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sprite frame para não-dragon
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      if (pettingTimerRef.current) clearTimeout(pettingTimerRef.current);
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
    };
  }, []);

  const handlePet = useCallback(() => {
    if (playState !== 'idle' && playState !== 'petting') return;

    setHearts(prev => {
      const newHeart: Heart = {
        id: ++heartIdRef.current,
        x: 30 + Math.random() * 40,
        emoji: pick(EMOJIS_PET),
      };
      return [...prev.slice(-6), newHeart];
    });

    const id = heartIdRef.current;
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 1800);

    setSpeechBubble(buildPetPhrase());
    setPetOffset(-8);
    setTimeout(() => setPetOffset(0), 150);
    setPlayState('petting');

    if (pettingTimerRef.current) clearTimeout(pettingTimerRef.current);
    pettingTimerRef.current = setTimeout(() => {
      setPlayState('idle');
      setSpeechBubble('');
    }, 2000);
  }, [playState]);

  const handleFetch = useCallback(() => {
    if (playState !== 'idle' && playState !== 'petting') return;

    if (pettingTimerRef.current) clearTimeout(pettingTimerRef.current);
    setSpeechBubble('');
    setHearts([]);

    // 1. Osso aparece e voa para a direita
    setPlayState('throw_anim');
    setBoneVisible(true);
    setBoneX(20);

    let bonePos = 20;
    const boneAnim = setInterval(() => {
      bonePos += 8;
      setBoneX(bonePos);
      if (bonePos > 115) {
        clearInterval(boneAnim);
        setBoneVisible(false);
      }
    }, 30);

    // 2. Após 400ms o pet corre e SAI DA TELA pela direita
    fetchTimerRef.current = setTimeout(() => {
      setPlayState('fetching');
      setSpeechBubble(buildFetchGoPhrase());
      // Animação de saída: desliza para fora pela direita
      setPetTransition(true);
      setPetOffscreen('off-right');

      // Frases rotativas enquanto busca
      let phraseIdx = 0;
      if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
      phraseTimerRef.current = setInterval(() => {
        phraseIdx = (phraseIdx + 1) % VERBS_FETCH_SEARCHING.length;
        setSpeechBubble(VERBS_FETCH_SEARCHING[phraseIdx] ?? '...');
      }, 900);

      // 3. Após 3s, teleporta para fora pela esquerda SEM transição
      fetchTimerRef.current = setTimeout(() => {
        if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);

        // Desabilita transição → pula para fora pela esquerda instantaneamente
        setPetTransition(false);
        setPetOffscreen('off-left');

        // Re-habilita transição no próximo frame → desliza para o centro
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPetTransition(true);
            setPetOffscreen('center');
            setPlayState('returning');
          });
        });

      }, 3000);
    }, 400);
  }, [playState]);

  // Volta ao idle após pet retornar ao centro
  useEffect(() => {
    if (playState !== 'returning') return;
    const petName = data.soul?.name ?? data.bones?.species ?? 'Buddy';
    const phrase = buildFetchFoundPhrase(petName);
    setSpeechBubble(phrase);

    const t = setTimeout(() => {
      setPlayState('idle');
      setSpeechBubble('');
    }, 3500);
    return () => clearTimeout(t);
  }, [playState, data.soul?.name, data.bones?.species]);

  const handleTrick = useCallback(() => {
    if (playState !== 'idle' && playState !== 'petting') return;
    if (pettingTimerRef.current) clearTimeout(pettingTimerRef.current);
    setHearts([]);

    const trick = pick(TRICKS);
    setCurrentTrick(trick);
    setSpeechBubble(`${trick.command} ${trick.emoji}`);
    setPlayState('trick_prompt');

    // Pet "executa" o truque após 800ms
    const t1 = setTimeout(() => {
      setPlayState('trick_doing');
      setSpeechBubble(trick.doing);

      // Finaliza com comemoração
      const t2 = setTimeout(() => {
        setPlayState('trick_done');
        setSpeechBubble(pick(trick.done));

        // Volta ao idle
        const t3 = setTimeout(() => {
          setPlayState('idle');
          setSpeechBubble('');
          setCurrentTrick(null);
        }, 2500);
        fetchTimerRef.current = t3;
      }, 1500);
      fetchTimerRef.current = t2;
    }, 800);
    fetchTimerRef.current = t1;
  }, [playState]);

  if (!data.bones && !data.soul) {
    return (
      <div style={centerStyle}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🥚</div>
          <span style={pixelText(10)}>{tl('playNoBuddy')}</span>
        </div>
      </div>
    );
  }

  const { bones, soul } = data;
  const isDragon = bones?.species === 'dragon';
  const petName = soul?.name ?? bones?.species ?? 'Buddy';

  const forceAnim: DragonAnim =
    playState === 'fetching' || playState === 'throw_anim'
      ? 'walkr'
      : playState === 'returning'
        ? 'walkl'
        : playState === 'trick_doing'
          ? 'special'
          : 'idle';

  // Pet só "anda" quando está realmente se movendo (saindo/voltando da tela)
  const isActuallyMoving = playState === 'fetching' || playState === 'returning';

  const petTranslateX =
    petOffscreen === 'off-right' ? '200vw'
    : petOffscreen === 'off-left' ? '-200vw'
    : '0px';

  const trickScale = playState === 'trick_doing' ? 1.12 : playState === 'trick_done' ? 1.05 : 1;

  return (
    <div style={containerStyle}>
      {isDragon ? <DragonNightBackground /> : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#04001a 0%,#14004a 55%,#1a0048 100%)' }} />
      )}

      {/* HUD */}
      <div style={hudStyle}>
        <button onClick={() => onNavigate('garden')} style={backBtn} title="jardim"><Sprout size={16} /></button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
          <span style={pixelText(9)}>{petName}</span>
          {bones && <RarityBadge rarity={bones.rarity} />}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Arena */}
      <div style={arenaStyle}>

        {/* Osso voador */}
        {boneVisible && (
          <div style={{
            position: 'absolute',
            left: `${boneX}%`,
            top: '28%',
            fontSize: 52,
            zIndex: 30,
            transition: 'none',
            animation: 'boneSpin 0.4s linear infinite',
            filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.7))',
          }}>
            🦴
          </div>
        )}

        {/* Truque — exibe o comando visualmente */}
        {(playState === 'trick_prompt' || playState === 'trick_doing') && currentTrick && (
          <div style={{
            position: 'absolute',
            top: '14%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 44,
            zIndex: 25,
            animation: 'trickPop 0.3s ease-out',
          }}>
            {currentTrick.emoji}
          </div>
        )}

        {/* Corações flutuantes */}
        {hearts.map(h => (
          <div
            key={h.id}
            style={{
              position: 'absolute',
              left: `${h.x}%`,
              bottom: '55%',
              fontSize: 22,
              zIndex: 25,
              animation: 'heartFloat 1.8s ease-out forwards',
              pointerEvents: 'none',
            }}
          >
            {h.emoji}
          </div>
        ))}

        {/* Speech bubble */}
        {speechBubble && (
          <div style={speechBubbleStyle}>
            <span style={{ fontFamily: 'inherit', fontSize: 13, color: '#eee', lineHeight: 1.4 }}>
              {speechBubble}
            </span>
            <div style={bubbleTailStyle} />
          </div>
        )}

        {/* Pet */}
        <div
          style={{
            ...petWrapStyle,
            transform: `translateX(${petTranslateX}) translateY(${petOffset}px) scale(${trickScale})`,
            transition: petTransition
              ? `transform ${isActuallyMoving ? (playState === 'fetching' ? '0.55s ease-in' : '0.65s ease-out') : '0.18s ease-out'}`
              : 'none',
          }}
          onClick={handlePet}
        >
          {isDragon && bones ? (
            <DragonBuddy
              size={300}
              mood={playState === 'petting' || playState === 'trick_done' ? 'excited' : 'happy'}
              isMoving={isActuallyMoving}
              forceAnim={forceAnim}
            />
          ) : bones ? (
            <BuddySprite
              bones={bones}
              frame={frame}
              size={240}
              expression={playState === 'petting' || playState === 'trick_done' ? 'excited' : 'happy'}
            />
          ) : null}
        </div>

        {/* Botões de ação */}
        {(playState === 'idle' || playState === 'petting') && (
          <div style={actionsStyle}>
            <button onClick={handlePet} style={actionBtn('#4a6e4a', '#7aaa7a')}>
              <span style={{ fontSize: 20 }}>🤚</span>
              <span style={pixelText(7)}>{tl('playPet')}</span>
            </button>
            <button onClick={handleFetch} style={actionBtn('#6e4a2a', '#aa8a5a')}>
              <span style={{ fontSize: 20 }}>🦴</span>
              <span style={pixelText(7)}>{tl('playFetch')}</span>
            </button>
            <button onClick={handleTrick} style={actionBtn('#4a2a6e', '#8a5aaa')}>
              <span style={{ fontSize: 20 }}>🎪</span>
              <span style={pixelText(7)}>{tl('playTrick')}</span>
            </button>
          </div>
        )}

        {/* Status durante fetch */}
        {playState === 'fetching' && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontFamily: 'inherit', fontSize: 13, color: '#555' }}>
              {petName} {tl('playFetching')}
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes heartFloat {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          60%  { opacity: 0.8; transform: translateY(-60px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-100px) scale(0.8); }
        }
        @keyframes boneSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes trickPop {
          0%   { opacity: 0; transform: translateX(-50%) scale(0.5); }
          60%  { transform: translateX(-50%) scale(1.2); }
          100% { opacity: 1; transform: translateX(-50%) scale(1); }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  position: 'relative', overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
};

const centerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#04001a',
};

const hudStyle: React.CSSProperties = {
  position: 'relative', zIndex: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 16px',
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(4px)',
  borderBottom: '1px solid rgba(80,80,180,0.2)',
  flexShrink: 0,
};

const backBtn: React.CSSProperties = {
  background: 'rgba(20,20,50,0.8)',
  border: '2px solid rgba(80,80,180,0.4)',
  color: '#aaa', cursor: 'pointer',
  padding: '6px 10px', fontSize: 16,
  boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
};

const arenaStyle: React.CSSProperties = {
  flex: 1, position: 'relative',
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'flex-end',
  paddingBottom: '80px',
  overflow: 'hidden',
};

const petWrapStyle: React.CSSProperties = {
  position: 'relative', zIndex: 15,
  cursor: 'pointer',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  transformOrigin: 'bottom center',
};

const speechBubbleStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20%', left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(14,14,40,0.95)',
  border: '1px solid rgba(80,80,200,0.5)',
  padding: '10px 16px',
  maxWidth: 260, textAlign: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
  zIndex: 20,
  animation: 'fadeIn 0.2s ease',
};

const bubbleTailStyle: React.CSSProperties = {
  position: 'absolute', bottom: -8, left: '50%',
  transform: 'translateX(-50%)',
  width: 0, height: 0,
  borderLeft: '8px solid transparent',
  borderRight: '8px solid transparent',
  borderTop: '8px solid rgba(14,14,40,0.95)',
};

const actionsStyle: React.CSSProperties = {
  position: 'absolute', bottom: 16, left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex', gap: 12, zIndex: 20,
};

function actionBtn(bg: string, border: string): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 6,
    padding: '12px 18px',
    background: `${bg}cc`,
    border: `2px solid ${border}`,
    cursor: 'pointer',
    boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
    color: '#eee',
    backdropFilter: 'blur(4px)',
  };
}

function pixelText(size: number): React.CSSProperties {
  return {
    fontFamily: '"Press Start 2P", monospace',
    fontSize: size, color: '#eee', display: 'block',
  };
}
