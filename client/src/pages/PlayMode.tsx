/**
 * PlayMode — brinque com o seu pet.
 *
 * Interações:
 *   Acariciar  → corações flutuam, pet fica feliz
 *   Buscar!    → osso voa, pet corre atrás, some da tela, volta com discurso engraçado
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBuddy } from '../hooks/useBuddy.ts';
import { DragonBuddy, type DragonAnim } from '../components/DragonBuddy.tsx';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { DragonNightBackground } from '../backgrounds/DragonBackground.tsx';
import { RarityBadge } from '../components/RarityBadge.tsx';
import type { Page } from '../App.tsx';

type PlayState =
  | 'idle'
  | 'petting'         // acariciando
  | 'throw_anim'      // osso voando
  | 'fetching'        // pet sumiu buscando
  | 'returning';      // pet voltando

const FETCH_PHRASES_PT = [
  'vai lá! 🐾',
  'cadê que eu vi aqui...',
  'achei uma minhoca também...',
  'espera aí...',
  'quase, quase...',
];

const FETCH_FOUND_PT = [
  'encontrei! 🦴',
  'olha o que eu trouxe! 🥳',
  'foi mal, fui explorar',
  'achei e já que tava lá dei uma volta',
  'voltei! 🐾',
];

const PET_PHRASES_PT = [
  '🥰 *ronrona*',
  '❤️ mais, mais!',
  '😊 que bom...',
  '💕 to gostando',
  '✨ tô brilhando!',
];

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
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [fetchPhrase, setFetchPhrase] = useState('');
  const [speechBubble, setSpeechBubble] = useState('');
  const [petOffset, setPetOffset] = useState(0); // translateX em px para bounce petting
  const [petTranslateX, setPetTranslateX] = useState('0%'); // para animação de fetch
  const [boneVisible, setBoneVisible] = useState(false);
  const [boneX, setBoneX] = useState(0);
  const [frame, setFrame] = useState(0);
  const heartIdRef = useRef(0);
  const pettingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phraseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sprite frame para não-dragon
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

  // Limpa timers no unmount
  useEffect(() => {
    return () => {
      if (pettingTimerRef.current) clearInterval(pettingTimerRef.current);
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
    };
  }, []);

  const handlePet = useCallback(() => {
    if (playState !== 'idle' && playState !== 'petting') return;

    // Spawna coração
    setHearts(prev => {
      const newHeart: Heart = {
        id: ++heartIdRef.current,
        x: 30 + Math.random() * 40, // %
        emoji: ['❤️', '💕', '✨', '💖', '🥰'][Math.floor(Math.random() * 5)] ?? '❤️',
      };
      return [...prev.slice(-6), newHeart]; // max 7 corações
    });

    // Remove coração após animação
    const id = heartIdRef.current;
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== id));
    }, 1800);

    // Alterna speech bubble
    const phrase = PET_PHRASES_PT[Math.floor(Math.random() * PET_PHRASES_PT.length)] ?? '🥰';
    setSpeechBubble(phrase);

    // Pequeno bounce
    setPetOffset(-8);
    setTimeout(() => setPetOffset(0), 150);

    setPlayState('petting');

    // Volta ao idle após 2s sem clicar
    if (pettingTimerRef.current) clearTimeout(pettingTimerRef.current);
    pettingTimerRef.current = setTimeout(() => {
      setPlayState('idle');
      setSpeechBubble('');
    }, 2000);
  }, [playState]);

  const handleFetch = useCallback(() => {
    if (playState !== 'idle' && playState !== 'petting') return;

    // Para petting se estava
    if (pettingTimerRef.current) clearTimeout(pettingTimerRef.current);
    setSpeechBubble('');
    setHearts([]);

    // 1. Osso aparece e voa para a direita
    setPlayState('throw_anim');
    setBoneVisible(true);
    setBoneX(20);

    // Anima o osso voando
    let bonePos = 20;
    const boneAnim = setInterval(() => {
      bonePos += 8;
      setBoneX(bonePos);
      if (bonePos > 110) {
        clearInterval(boneAnim);
        setBoneVisible(false);
      }
    }, 30);

    // 2. Após 400ms pet corre atrás
    fetchTimerRef.current = setTimeout(() => {
      setPlayState('fetching');
      setSpeechBubble(FETCH_PHRASES_PT[0] ?? 'vai lá!');
      setPetTranslateX('130%');

      // Frases rotativas enquanto vai buscar
      let phraseIdx = 0;
      if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
      phraseTimerRef.current = setInterval(() => {
        phraseIdx = (phraseIdx + 1) % FETCH_PHRASES_PT.length;
        setSpeechBubble(FETCH_PHRASES_PT[phraseIdx] ?? '...');
      }, 900);

      // 3. Após 3.5s pet volta do lado esquerdo
      fetchTimerRef.current = setTimeout(() => {
        if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
        const found = FETCH_FOUND_PT[Math.floor(Math.random() * FETCH_FOUND_PT.length)] ?? 'voltei!';
        setSpeechBubble(found);
        setPlayState('returning');
        setPetTranslateX('-130%');

        // Sem animação: posição pula para esquerda (fora da tela), depois desliza ao centro
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPetTranslateX('0%');
          });
        });

        // 4. Volta ao idle após retornar
        fetchTimerRef.current = setTimeout(() => {
          setPlayState('idle');
          setSpeechBubble('');
        }, 3000);
      }, 3500);
    }, 400);
  }, [playState]);

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
    playState === 'fetching' || playState === 'throw_anim' || playState === 'returning'
      ? 'walk'
      : 'idle';

  const isMoving = playState === 'fetching' || playState === 'returning';

  return (
    <div style={containerStyle}>
      {isDragon ? <DragonNightBackground /> : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,#04001a 0%,#14004a 55%,#1a0048 100%)' }} />
      )}

      {/* HUD */}
      <div style={hudStyle}>
        <button onClick={() => onNavigate('garden')} style={backBtn} title="jardim">🌱</button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
          <span style={pixelText(9)}>{petName}</span>
          {bones && <RarityBadge rarity={bones.rarity} />}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Arena de brincadeiras */}
      <div style={arenaStyle}>

        {/* Osso voador */}
        {boneVisible && (
          <div style={{
            position: 'absolute',
            left: `${boneX}%`,
            top: '30%',
            fontSize: 28,
            zIndex: 30,
            transition: 'none',
            transform: 'rotate(-30deg)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
          }}>
            🦴
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
            <span style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#eee', lineHeight: 1.4 }}>
              {speechBubble}
            </span>
            <div style={bubbleTailStyle} />
          </div>
        )}

        {/* Pet */}
        <div
          style={{
            ...petWrapStyle,
            transform: `translateX(${petTranslateX}) translateY(${petOffset}px)`,
            transition: playState === 'fetching'
              ? 'transform 0.6s ease-in'
              : playState === 'returning'
                ? 'transform 0.7s ease-out'
                : `transform 0.15s ease-out`,
          }}
          onClick={handlePet}
        >
          {isDragon && bones ? (
            <DragonBuddy
              size={300}
              mood={playState === 'petting' ? 'excited' : 'happy'}
              isMoving={isMoving}
              forceAnim={forceAnim}
            />
          ) : bones ? (
            <BuddySprite
              bones={bones}
              frame={frame}
              size={240}
              expression={playState === 'petting' ? 'excited' : 'happy'}
            />
          ) : null}
        </div>

        {/* Botões de ação */}
        {(playState === 'idle' || playState === 'petting') && (
          <div style={actionsStyle}>
            <button onClick={handlePet} style={actionBtn('#4a6e4a', '#7aaa7a')}>
              <span style={{ fontSize: 20 }}>🤚</span>
              <span style={pixelText(7)}>acariciar</span>
            </button>
            <button onClick={handleFetch} style={actionBtn('#6e4a2a', '#aa8a5a')}>
              <span style={{ fontSize: 20 }}>🦴</span>
              <span style={pixelText(7)}>buscar!</span>
            </button>
          </div>
        )}

        {/* Status durante fetch */}
        {playState === 'fetching' && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <span style={{ fontFamily: 'sans-serif', fontSize: 13, color: '#666' }}>
              {petName} está procurando...
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
      `}</style>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

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

const hudStyle: React.CSSProperties = {
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

const backBtn: React.CSSProperties = {
  background: 'rgba(20,20,50,0.8)',
  border: '2px solid rgba(80,80,180,0.4)',
  color: '#aaa',
  cursor: 'pointer',
  padding: '6px 10px',
  fontSize: 16,
  boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
};

const arenaStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingBottom: '80px',
  overflow: 'hidden',
};

const petWrapStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 15,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const speechBubbleStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20%',
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'rgba(14,14,40,0.95)',
  border: '1px solid rgba(80,80,200,0.5)',
  padding: '10px 16px',
  maxWidth: 220,
  textAlign: 'center',
  boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
  zIndex: 20,
  animation: 'fadeIn 0.2s ease',
};

const bubbleTailStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: -8,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '8px solid transparent',
  borderRight: '8px solid transparent',
  borderTop: '8px solid rgba(14,14,40,0.95)',
};

const actionsStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 16,
  zIndex: 20,
};

function actionBtn(bg: string, border: string): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: '12px 20px',
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
    fontSize: size,
    color: '#eee',
    display: 'block',
  };
}
