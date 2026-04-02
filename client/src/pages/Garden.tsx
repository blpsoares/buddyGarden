import { useState, useEffect, useCallback, useRef } from 'react';
import { useBuddy } from '../hooks/useBuddy.ts';
import { useChat } from '../hooks/useChat.ts';
import { BuddySprite } from '../components/BuddySprite.tsx';
import { RarityBadge } from '../components/RarityBadge.tsx';
import { DragonNightBackground } from '../backgrounds/DragonBackground.tsx';
import type { Page } from '../App.tsx';

type Mood = 'happy' | 'excited' | 'tired' | 'bored' | 'focused' | 'chaotic';

const MOOD_EMOJI: Record<Mood, string> = {
  happy: '😊', excited: '🤩', tired: '😴', bored: '😑', focused: '🔍', chaotic: '🌀',
};

// ── Cenários ──────────────────────────────────────────────────────────────────

interface SceneLayer {
  sky: string;
  horizon: string;
  ground: string;
  groundTop: string; // linha de grama/solo
  particles?: string; // CSS classe para partículas
  deco: Array<{ emoji: string; style: React.CSSProperties }>;
  label: string;
}

// helpers: bottom:'H%' = colado no horizonte, top:'X%' = no céu
const H = '20%'; // altura do chão
const SCENES: Record<string, SceneLayer> = {
  dragon: {
    sky: 'linear-gradient(180deg, #04001a 0%, #14004a 50%, #260060 80%, #1a0048 100%)',
    horizon: '#2d005a',
    ground: 'linear-gradient(180deg, #1a0038 0%, #0d001e 100%)',
    groundTop: '#4a00aa',
    label: '🏰 Castelo das Sombras',
    deco: [], // SVG background handles all decorations
  },
  ghost: {
    sky: 'linear-gradient(180deg, #010208 0%, #07091a 55%, #0e1030 100%)',
    horizon: '#0c0e20',
    ground: 'linear-gradient(180deg, #0a0b18 0%, #050610 100%)',
    groundTop: '#1a1c3a',
    label: '👻 Mansão Mal-Assombrada',
    deco: [
      { emoji: '🏚️', style: { right: '6%', bottom: H, fontSize: '80px', opacity: 0.5 } },
      { emoji: '🌕', style: { left: '15%', top: '8%', fontSize: '52px', opacity: 0.55 } },
      { emoji: '🦇', style: { left: '40%', top: '18%', fontSize: '22px', opacity: 0.7 } },
      { emoji: '🦇', style: { left: '55%', top: '10%', fontSize: '16px', opacity: 0.55 } },
      { emoji: '🦇', style: { left: '28%', top: '32%', fontSize: '13px', opacity: 0.45 } },
    ],
  },
  robot: {
    sky: 'linear-gradient(180deg, #010106 0%, #04041a 50%, #080830 100%)',
    horizon: '#060620',
    ground: 'linear-gradient(180deg, #0a0a20 0%, #050510 100%)',
    groundTop: '#1414408',
    label: '🤖 Cidade Neon',
    deco: [
      { emoji: '🌆', style: { right: '2%', bottom: H, fontSize: '90px', opacity: 0.45 } },
      { emoji: '🌃', style: { left: '2%', bottom: H, fontSize: '70px', opacity: 0.35 } },
      { emoji: '📡', style: { left: '22%', bottom: H, fontSize: '38px', opacity: 0.7 } },
      { emoji: '💡', style: { left: '55%', top: '30%', fontSize: '18px', opacity: 0.6, filter: 'hue-rotate(90deg)' } },
      { emoji: '⚡', style: { right: '25%', top: '20%', fontSize: '20px', opacity: 0.7, filter: 'hue-rotate(90deg)' } },
    ],
  },
  octopus: {
    sky: 'linear-gradient(180deg, #000e22 0%, #001538 55%, #001e48 100%)',
    horizon: '#001838',
    ground: 'linear-gradient(180deg, #001228 0%, #000918 100%)',
    groundTop: '#003060',
    label: '🌊 Abissal Profundo',
    deco: [
      { emoji: '🪸', style: { left: '6%', bottom: H, fontSize: '56px', opacity: 0.75 } },
      { emoji: '🪸', style: { right: '8%', bottom: H, fontSize: '44px', opacity: 0.6 } },
      { emoji: '🐠', style: { left: '65%', top: '28%', fontSize: '28px', opacity: 0.65 } },
      { emoji: '🐟', style: { left: '20%', top: '40%', fontSize: '22px', opacity: 0.5 } },
      { emoji: '🌊', style: { left: '42%', top: '12%', fontSize: '30px', opacity: 0.35 } },
    ],
  },
  axolotl: {
    sky: 'linear-gradient(180deg, #000e20 0%, #001530 55%, #001e40 100%)',
    horizon: '#001228',
    ground: 'linear-gradient(180deg, #000f20 0%, #000810 100%)',
    groundTop: '#002848',
    label: '🐟 Aquário Encantado',
    deco: [
      { emoji: '🌿', style: { left: '4%', bottom: H, fontSize: '52px', opacity: 0.85 } },
      { emoji: '🌿', style: { right: '5%', bottom: H, fontSize: '44px', opacity: 0.75 } },
      { emoji: '🐠', style: { left: '58%', top: '25%', fontSize: '28px', opacity: 0.65 } },
      { emoji: '🫧', style: { left: '32%', top: '18%', fontSize: '20px', opacity: 0.5 } },
      { emoji: '🫧', style: { left: '70%', top: '38%', fontSize: '14px', opacity: 0.4 } },
    ],
  },
  penguin: {
    sky: 'linear-gradient(180deg, #c0d8f8 0%, #d8eeff 60%, #eef5ff 100%)',
    horizon: '#daeeff',
    ground: 'linear-gradient(180deg, #e8f4ff 0%, #cce0f8 100%)',
    groundTop: '#aaccee',
    label: '🧊 Ártico Gelado',
    deco: [
      { emoji: '🧊', style: { left: '8%', bottom: H, fontSize: '52px', opacity: 0.8 } },
      { emoji: '🧊', style: { right: '10%', bottom: H, fontSize: '40px', opacity: 0.65 } },
      { emoji: '❄️', style: { left: '55%', top: '12%', fontSize: '28px', opacity: 0.7 } },
      { emoji: '❄️', style: { left: '28%', top: '22%', fontSize: '18px', opacity: 0.55 } },
      { emoji: '❄️', style: { right: '20%', top: '18%', fontSize: '14px', opacity: 0.5 } },
      { emoji: '🐧', style: { left: '65%', bottom: H, fontSize: '36px', opacity: 0.6 } },
    ],
  },
  cactus: {
    sky: 'linear-gradient(180deg, #c83000 0%, #e85800 30%, #ff8c00 65%, #ffb040 100%)',
    horizon: '#e06018',
    ground: 'linear-gradient(180deg, #c47830 0%, #8a5018 100%)',
    groundTop: '#d48830',
    label: '🌵 Deserto do Pôr do Sol',
    deco: [
      { emoji: '🌵', style: { left: '5%', bottom: H, fontSize: '64px', opacity: 0.85 } },
      { emoji: '🌵', style: { right: '6%', bottom: H, fontSize: '80px', opacity: 0.75 } },
      { emoji: '🌵', style: { left: '40%', bottom: H, fontSize: '44px', opacity: 0.5 } },
      { emoji: '🌞', style: { left: '55%', top: '6%', fontSize: '56px', opacity: 0.55 } },
      { emoji: '🦅', style: { left: '25%', top: '22%', fontSize: '22px', opacity: 0.6 } },
    ],
  },
  mushroom: {
    sky: 'linear-gradient(180deg, #080f02 0%, #152808 55%, #1e3a0e 100%)',
    horizon: '#183010',
    ground: 'linear-gradient(180deg, #152808 0%, #0c1a04 100%)',
    groundTop: '#2a5010',
    label: '🍄 Floresta Mágica',
    deco: [
      { emoji: '🍄', style: { left: '5%', bottom: H, fontSize: '56px', opacity: 0.85 } },
      { emoji: '🍄', style: { right: '6%', bottom: H, fontSize: '44px', opacity: 0.75 } },
      { emoji: '🌿', style: { left: '38%', bottom: H, fontSize: '48px', opacity: 0.7 } },
      { emoji: '✨', style: { left: '18%', top: '25%', fontSize: '20px', opacity: 0.65 } },
      { emoji: '✨', style: { left: '62%', top: '18%', fontSize: '14px', opacity: 0.55 } },
      { emoji: '🌙', style: { left: '70%', top: '8%', fontSize: '30px', opacity: 0.5 } },
    ],
  },
  owl: {
    sky: 'linear-gradient(180deg, #010204 0%, #060c14 55%, #0c1420 100%)',
    horizon: '#080e18',
    ground: 'linear-gradient(180deg, #060c10 0%, #030608 100%)',
    groundTop: '#101828',
    label: '🌙 Floresta Noturna',
    deco: [
      { emoji: '🌳', style: { left: '2%', bottom: H, fontSize: '80px', opacity: 0.55 } },
      { emoji: '🌳', style: { right: '4%', bottom: H, fontSize: '68px', opacity: 0.45 } },
      { emoji: '🌙', style: { left: '58%', top: '8%', fontSize: '48px', opacity: 0.65 } },
      { emoji: '⭐', style: { left: '20%', top: '12%', fontSize: '16px', opacity: 0.8 } },
      { emoji: '⭐', style: { left: '38%', top: '6%', fontSize: '11px', opacity: 0.7 } },
      { emoji: '⭐', style: { left: '80%', top: '16%', fontSize: '13px', opacity: 0.65 } },
      { emoji: '🦉', style: { right: '20%', bottom: H, fontSize: '36px', opacity: 0.55 } },
    ],
  },
  rabbit: {
    sky: 'linear-gradient(180deg, #4aa0d8 0%, #70beea 60%, #a8d8f8 100%)',
    horizon: '#7ec8f0',
    ground: 'linear-gradient(180deg, #5ab85a 0%, #3a9830 100%)',
    groundTop: '#6aca6a',
    label: '🌸 Prado Florido',
    deco: [
      { emoji: '🌸', style: { left: '4%', bottom: H, fontSize: '40px', opacity: 0.9 } },
      { emoji: '🌷', style: { left: '18%', bottom: H, fontSize: '32px', opacity: 0.85 } },
      { emoji: '🌼', style: { right: '8%', bottom: H, fontSize: '36px', opacity: 0.9 } },
      { emoji: '🌸', style: { right: '22%', bottom: H, fontSize: '28px', opacity: 0.75 } },
      { emoji: '☁️', style: { left: '28%', top: '10%', fontSize: '40px', opacity: 0.65 } },
      { emoji: '☁️', style: { left: '62%', top: '6%', fontSize: '30px', opacity: 0.5 } },
      { emoji: '🦋', style: { left: '55%', top: '35%', fontSize: '20px', opacity: 0.7 } },
    ],
  },
  duck: {
    sky: 'linear-gradient(180deg, #4aa0d8 0%, #70beea 60%, #a8d8f8 100%)',
    horizon: '#7ec8f0',
    ground: 'linear-gradient(180deg, #4a9848 0%, #306828 100%)',
    groundTop: '#60b058',
    label: '🦆 Margem do Lago',
    deco: [
      { emoji: '🌊', style: { right: '5%', bottom: H, fontSize: '60px', opacity: 0.65 } },
      { emoji: '🌿', style: { left: '5%', bottom: H, fontSize: '44px', opacity: 0.85 } },
      { emoji: '🌿', style: { left: '20%', bottom: H, fontSize: '32px', opacity: 0.7 } },
      { emoji: '☁️', style: { left: '42%', top: '10%', fontSize: '36px', opacity: 0.55 } },
      { emoji: '🐸', style: { right: '28%', bottom: H, fontSize: '22px', opacity: 0.65 } },
    ],
  },
  goose: {
    sky: 'linear-gradient(180deg, #4aa0d8 0%, #70beea 60%, #a8d8f8 100%)',
    horizon: '#7ec8f0',
    ground: 'linear-gradient(180deg, #4a9848 0%, #306828 100%)',
    groundTop: '#60b058',
    label: '🪿 Margem do Rio',
    deco: [
      { emoji: '🌊', style: { right: '5%', bottom: H, fontSize: '56px', opacity: 0.6 } },
      { emoji: '🌿', style: { left: '4%', bottom: H, fontSize: '44px', opacity: 0.8 } },
      { emoji: '🌿', style: { right: '28%', bottom: H, fontSize: '36px', opacity: 0.7 } },
      { emoji: '☁️', style: { left: '50%', top: '8%', fontSize: '32px', opacity: 0.5 } },
    ],
  },
  capybara: {
    sky: 'linear-gradient(180deg, #0a2208 0%, #184818 55%, #226820 100%)',
    horizon: '#1a5018',
    ground: 'linear-gradient(180deg, #1e5810 0%, #103808 100%)',
    groundTop: '#2a7018',
    label: '🌿 Selva Tropical',
    deco: [
      { emoji: '🌴', style: { left: '2%', bottom: H, fontSize: '80px', opacity: 0.8 } },
      { emoji: '🌴', style: { right: '4%', bottom: H, fontSize: '96px', opacity: 0.7 } },
      { emoji: '🌿', style: { left: '30%', bottom: H, fontSize: '40px', opacity: 0.7 } },
      { emoji: '🦜', style: { left: '52%', top: '22%', fontSize: '28px', opacity: 0.75 } },
      { emoji: '🌺', style: { right: '25%', bottom: H, fontSize: '26px', opacity: 0.8 } },
    ],
  },
  turtle: {
    sky: 'linear-gradient(180deg, #1870c0 0%, #3898d8 55%, #60b8e8 100%)',
    horizon: '#50aae0',
    ground: 'linear-gradient(180deg, #d8b850 0%, #aa8828 100%)',
    groundTop: '#e0c060',
    label: '🏖️ Praia Ensolarada',
    deco: [
      { emoji: '🌊', style: { right: '2%', bottom: H, fontSize: '64px', opacity: 0.65 } },
      { emoji: '⛱️', style: { left: '8%', bottom: H, fontSize: '52px', opacity: 0.8 } },
      { emoji: '🌞', style: { left: '68%', top: '6%', fontSize: '56px', opacity: 0.55 } },
      { emoji: '🐚', style: { right: '30%', bottom: H, fontSize: '22px', opacity: 0.7 } },
    ],
  },
  snail: {
    sky: 'linear-gradient(180deg, #1e2e38 0%, #2e4050 55%, #405060 100%)',
    horizon: '#354858',
    ground: 'linear-gradient(180deg, #2e4820 0%, #1e3010 100%)',
    groundTop: '#3a5828',
    label: '🌧️ Jardim na Chuva',
    deco: [
      { emoji: '🌿', style: { left: '4%', bottom: H, fontSize: '52px', opacity: 0.85 } },
      { emoji: '🌿', style: { right: '6%', bottom: H, fontSize: '40px', opacity: 0.75 } },
      { emoji: '🌧️', style: { left: '28%', top: '10%', fontSize: '40px', opacity: 0.6 } },
      { emoji: '💧', style: { left: '55%', top: '25%', fontSize: '18px', opacity: 0.55 } },
      { emoji: '💧', style: { left: '70%', top: '18%', fontSize: '14px', opacity: 0.45 } },
    ],
  },
  cat: {
    sky: 'linear-gradient(180deg, #c84800 0%, #e86818 45%, #f89040 80%, #ffb868 100%)',
    horizon: '#e07830',
    ground: 'linear-gradient(180deg, #7a4018 0%, #502808 100%)',
    groundTop: '#8a4e20',
    label: '🏠 Tarde Aconchegante',
    deco: [
      { emoji: '🏠', style: { right: '8%', bottom: H, fontSize: '68px', opacity: 0.6 } },
      { emoji: '🌅', style: { left: '12%', top: '8%', fontSize: '48px', opacity: 0.5 } },
      { emoji: '🌳', style: { left: '5%', bottom: H, fontSize: '60px', opacity: 0.5 } },
      { emoji: '🌻', style: { right: '28%', bottom: H, fontSize: '32px', opacity: 0.7 } },
    ],
  },
  chonk: {
    sky: 'linear-gradient(180deg, #c84800 0%, #e86818 45%, #f89040 80%, #ffb868 100%)',
    horizon: '#e07830',
    ground: 'linear-gradient(180deg, #7a4018 0%, #502808 100%)',
    groundTop: '#8a4e20',
    label: '😸 Cantinho do Gordão',
    deco: [
      { emoji: '🛋️', style: { right: '10%', bottom: H, fontSize: '64px', opacity: 0.6 } },
      { emoji: '🐟', style: { left: '12%', bottom: H, fontSize: '30px', opacity: 0.7 } },
      { emoji: '🍕', style: { left: '40%', top: '28%', fontSize: '24px', opacity: 0.6 } },
      { emoji: '😴', style: { left: '65%', top: '18%', fontSize: '20px', opacity: 0.5 } },
    ],
  },
  blob: {
    sky: 'linear-gradient(180deg, #040808 0%, #081018 55%, #0c1820 100%)',
    horizon: '#081018',
    ground: 'linear-gradient(180deg, #081410 0%, #040c08 100%)',
    groundTop: '#102820',
    label: '🫧 Caverna Luminosa',
    deco: [
      { emoji: '💎', style: { left: '6%', bottom: H, fontSize: '36px', opacity: 0.75 } },
      { emoji: '💎', style: { right: '8%', bottom: H, fontSize: '28px', opacity: 0.65 } },
      { emoji: '✨', style: { left: '55%', top: '22%', fontSize: '24px', opacity: 0.8 } },
      { emoji: '✨', style: { left: '20%', top: '35%', fontSize: '16px', opacity: 0.6 } },
      { emoji: '🌟', style: { left: '38%', top: '12%', fontSize: '20px', opacity: 0.55 } },
    ],
  },
};

const DEFAULT_SCENE: SceneLayer = {
  sky: 'linear-gradient(180deg, #4890d8 0%, #70b8e8 60%, #a8d8f5 100%)',
  horizon: '#78c0ee',
  ground: 'linear-gradient(180deg, #58b058 0%, #388830 100%)',
  groundTop: '#68c060',
  label: '🌱 Jardim',
  deco: [
    { emoji: '☁️', style: { left: '25%', top: '12%', fontSize: '36px', opacity: 0.6 } },
    { emoji: '☁️', style: { left: '62%', top: '7%', fontSize: '26px', opacity: 0.5 } },
    { emoji: '🌻', style: { left: '5%', bottom: H, fontSize: '40px', opacity: 0.8 } },
    { emoji: '🌻', style: { right: '6%', bottom: H, fontSize: '32px', opacity: 0.7 } },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onNavigate: (page: Page) => void;
}

const ALL_SPECIES = ['duck','goose','cat','rabbit','owl','penguin','turtle','snail','dragon','octopus','axolotl','ghost','robot','blob','cactus','mushroom','chonk','capybara'] as const;

export function Garden({ onNavigate }: Props) {
  const { data, loading } = useBuddy();
  const { messages, send, isStreaming } = useChat();
  const [frame, setFrame] = useState(0);
  const [pos, setPos] = useState({ x: 80, y: 580 });
  const [targetPos, setTargetPos] = useState({ x: 80, y: 580 });
  const [happy, setHappy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [mood, setMood] = useState<Mood>('happy');
  const [devSpeciesIdx, setDevSpeciesIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastClickTime = useRef(0);

  // WebSocket mood
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws/mood`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; mood: Mood };
        if (msg.type === 'mood') setMood(msg.mood);
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, []);

  // Frame animation
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % 3), 400);
    return () => clearInterval(t);
  }, []);

  // Idle walk
  useEffect(() => {
    if (chatOpen) return;
    const t = setInterval(() => {
      const c = containerRef.current;
      if (!c) return;
      // pet walks on the ground line (80% from top = 20% from bottom)
      const groundY = c.clientHeight * 0.80 - 150; // 150 = approx pet height
      setTargetPos({
        x: Math.max(20, Math.random() * (c.clientWidth - 160)),
        y: groundY,
      });
    }, 4000);
    return () => clearInterval(t);
  }, [chatOpen]);

  // Smooth movement
  useEffect(() => {
    const t = setInterval(() => {
      setPos(p => {
        const dx = targetPos.x - p.x;
        const dy = targetPos.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) return targetPos;
        const speed = chatOpen ? 0 : 1.5;
        return { x: p.x + (dx / dist) * speed, y: p.y + (dy / dist) * speed };
      });
    }, 16);
    return () => clearInterval(t);
  }, [targetPos, chatOpen]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  const handlePetClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickTime.current < 400) {
      setHappy(true);
      setTimeout(() => setHappy(false), 1500);
    }
    lastClickTime.current = now;
    setChatOpen(o => {
      if (!o) setTimeout(() => inputRef.current?.focus(), 80);
      return !o;
    });
  }, []);

  const handleChatSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isStreaming) return;
    setChatInput('');
    void send(text);
  }, [chatInput, isStreaming, send]);

  if (loading) return <div style={centerStyle}><p style={pixelFont}>Carregando...</p></div>;
  if (!data.bones && !data.soul) return <NoBuddy />;

  const { bones, soul } = data;
  const displayBones = bones && devSpeciesIdx !== null
    ? { ...bones, species: ALL_SPECIES[devSpeciesIdx] ?? bones.species }
    : bones;
  const scene = SCENES[displayBones?.species ?? ''] ?? DEFAULT_SCENE;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>

      {/* ── Fundo (sky) ── */}
      <div style={{ position: 'absolute', inset: 0, background: scene.sky }} />

      {/* ── Dragon scene: full SVG background ── */}
      {displayBones?.species === 'dragon' && <DragonNightBackground />}

      {/* ── Ground strip (20% at bottom) — hidden for dragon (SVG handles it) ── */}
      {displayBones?.species !== 'dragon' && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%',
          background: scene.ground,
        }} />
      )}
      {/* ── Horizon glow line ── */}
      {displayBones?.species !== 'dragon' && (
        <div style={{
          position: 'absolute', bottom: '20%', left: 0, right: 0,
          height: '5px',
          background: scene.groundTop,
          boxShadow: `0 -6px 20px ${scene.groundTop}, 0 2px 8px ${scene.groundTop}`,
          zIndex: 2,
        }} />
      )}

      {/* ── Decorações de cenário ── */}
      {scene.deco.map((d, i) => (
        <div key={i} style={{ position: 'absolute', pointerEvents: 'none', userSelect: 'none', ...d.style }}>
          {d.emoji}
        </div>
      ))}

      {/* ── Label do cenário ── */}
      <div style={{ position: 'absolute', top: 6, right: 8, zIndex: 5 }}>
        <span style={{ fontFamily: 'sans-serif', fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
          {scene.label}
        </span>
      </div>

      {/* ── HUD top-left ── */}
      <div style={hudLeft}>
        <span style={{ ...pixelFont, fontSize: '10px', color: '#fff' }}>
          {soul?.name ?? bones?.species ?? 'buddy'}
        </span>
        {bones && <RarityBadge rarity={bones.rarity} style={{ marginTop: 4 }} />}
        {bones?.isShiny && <span style={{ ...pixelFont, fontSize: '7px', color: '#ffd700', marginTop: 2 }}>✨ shiny</span>}
      </div>

      {/* ── HUD bottom ── */}
      <div style={hudBot}>
        <span style={{ ...pixelFont, fontSize: '8px' }}>{MOOD_EMOJI[mood]} {mood}</span>
        <span style={{ ...pixelFont, fontSize: '8px', marginLeft: 12, color: '#999' }}>
          {data.level} · {data.xp.toLocaleString()} xp
        </span>
        <button onClick={() => onNavigate('stats')} style={iconBtn} title="stats">📊</button>
        <button onClick={() => onNavigate('chat')} style={iconBtn} title="chat fullscreen">💬</button>
      </div>

      {/* ── Dev species switcher ── */}
      <div style={{
        position: 'absolute', bottom: 48, right: 8, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(0,0,0,0.7)', padding: '4px 8px',
        border: '1px solid rgba(255,255,100,0.3)',
      }}>
        <button
          onClick={() => setDevSpeciesIdx(i => i === null ? 0 : (i - 1 + ALL_SPECIES.length) % ALL_SPECIES.length)}
          style={{ ...iconBtn, fontSize: '12px', color: '#ff8' }}
        >◀</button>
        <span style={{ ...pixelFont, fontSize: '7px', color: '#ff8', minWidth: 56, textAlign: 'center' }}>
          {devSpeciesIdx !== null ? ALL_SPECIES[devSpeciesIdx] : displayBones?.species ?? '?'}
        </span>
        <button
          onClick={() => setDevSpeciesIdx(i => i === null ? 1 : (i + 1) % ALL_SPECIES.length)}
          style={{ ...iconBtn, fontSize: '12px', color: '#ff8' }}
        >▶</button>
        {devSpeciesIdx !== null && (
          <button
            onClick={() => setDevSpeciesIdx(null)}
            style={{ ...iconBtn, fontSize: '9px', color: '#f88' }}
          >✕</button>
        )}
      </div>

      {/* ── Pet ── */}
      {displayBones && (
        <div style={{
          position: 'absolute',
          left: pos.x,
          ...(displayBones.species === 'dragon'
            ? { bottom: 'calc(35% - 10px)' }  // sit on SVG ground
            : { top: pos.y }),
          userSelect: 'none',
        }}>
          <div
            onClick={handlePetClick}
            style={{
              cursor: 'pointer',
              transform: happy ? 'scale(1.25) rotate(-6deg)' : 'scale(1)',
              transition: 'transform 0.15s',
            }}
          >
            <BuddySprite bones={displayBones} frame={frame} size={128} expression={happy ? 'excited' : mood} />
          </div>
        </div>
      )}

      {/* ── Chat Modal ── */}
      {chatOpen && bones && (
        <div style={modalBackdrop} onClick={e => { if (e.target === e.currentTarget) setChatOpen(false); }}>
          <div style={modalPanel}>

            {/* Modal header */}
            <div style={modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BuddySprite bones={displayBones} frame={frame} size={36} />
                <div>
                  <span style={{ ...pixelFont, fontSize: '9px', color: '#ddd' }}>
                    {soul?.name ?? bones.species}
                  </span>
                  {isStreaming && (
                    <span style={{ display: 'block', fontFamily: 'sans-serif', fontSize: '10px', color: '#4caf50', marginTop: 2 }}>
                      digitando...
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onNavigate('chat')} style={{ ...iconBtn, fontSize: '11px' }} title="chat fullscreen">⛶</button>
                <button onClick={() => setChatOpen(false)} style={{ ...iconBtn, color: '#ff6666' }}>✕</button>
              </div>
            </div>

            {/* Messages */}
            <div style={msgArea}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: '#444' }}>
                  <span style={{ ...pixelFont, fontSize: '8px' }}>diz algo pro teu buddy...</span>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                    gap: 8,
                    alignItems: 'flex-end',
                    marginBottom: 10,
                  }}
                >
                  {msg.role === 'assistant' && (
                    <div style={{ flexShrink: 0 }}>
                      <BuddySprite bones={displayBones} frame={0} size={30} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '72%',
                    padding: '9px 12px',
                    background: msg.role === 'user'
                      ? 'rgba(55,55,140,0.92)'
                      : 'rgba(18,18,45,0.92)',
                    border: `1px solid ${msg.role === 'user' ? 'rgba(100,100,220,0.5)' : 'rgba(60,60,100,0.4)'}`,
                    color: '#eee',
                    fontFamily: 'sans-serif',
                    fontSize: '13px',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  }}>
                    {msg.content}
                    {msg.streaming && <span style={{ marginLeft: 4, animation: 'blink 1s infinite' }}>▌</span>}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleChatSubmit} style={modalInputRow}>
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={isStreaming ? 'aguardando...' : 'mensagem...'}
                disabled={isStreaming}
                style={modalInput}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={isStreaming || !chatInput.trim()}
                style={modalSendBtn(isStreaming || !chatInput.trim())}
              >
                ▶
              </button>
            </form>
          </div>
          <style>{`@keyframes blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }`}</style>
        </div>
      )}
    </div>
  );
}

// ── NoBuddy ───────────────────────────────────────────────────────────────────

function NoBuddy() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={centerStyle}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🥚</div>
        <p style={{ ...pixelFont, fontSize: '10px', marginBottom: 8 }}>seu buddy ainda não nasceu</p>
        <p style={{ ...pixelFont, fontSize: '8px', color: '#666' }}>verificando{dots}</p>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const pixelFont: React.CSSProperties = {
  fontFamily: '"Press Start 2P", monospace',
  color: '#eee',
  display: 'block',
};

const centerStyle: React.CSSProperties = {
  width: '100%', height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#1a1a2e',
};

const hudLeft: React.CSSProperties = {
  position: 'absolute', top: 8, left: 8, zIndex: 5,
  display: 'flex', flexDirection: 'column', gap: 3,
  background: 'rgba(0,0,0,0.6)',
  padding: '6px 8px',
  border: '2px solid rgba(80,80,120,0.4)',
  boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
};

const hudBot: React.CSSProperties = {
  position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 5,
  background: 'rgba(0,0,0,0.7)',
  padding: '5px 12px',
  border: '2px solid rgba(80,80,120,0.4)',
  boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', gap: 4,
  whiteSpace: 'nowrap',
};

const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none',
  cursor: 'pointer', fontSize: '14px',
  padding: '0 3px', lineHeight: 1, color: '#aaa',
};

// Modal
const modalBackdrop: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 30,
  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
  background: 'rgba(5,5,20,0.55)',
  backdropFilter: 'blur(7px)',
  WebkitBackdropFilter: 'blur(7px)',
};

const modalPanel: React.CSSProperties = {
  height: '65%',
  background: 'rgba(8,8,26,0.96)',
  borderTop: '2px solid rgba(80,80,180,0.45)',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 -8px 32px rgba(0,0,20,0.7)',
};

const modalHeader: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid rgba(70,70,160,0.25)',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  flexShrink: 0,
};

const msgArea: React.CSSProperties = {
  flex: 1, overflowY: 'auto',
  padding: '12px 14px',
  display: 'flex', flexDirection: 'column',
};

const modalInputRow: React.CSSProperties = {
  display: 'flex', gap: 8,
  padding: '8px 12px',
  borderTop: '1px solid rgba(70,70,160,0.25)',
  flexShrink: 0,
  background: 'rgba(5,5,18,0.8)',
};

const modalInput: React.CSSProperties = {
  flex: 1, padding: '8px 12px',
  background: 'rgba(14,14,36,0.95)',
  border: '1px solid rgba(80,80,180,0.45)',
  color: '#eee', fontFamily: 'sans-serif', fontSize: '14px',
  outline: 'none',
};

const modalSendBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  background: disabled ? '#1e1e38' : 'rgba(74,74,170,0.85)',
  border: `1px solid ${disabled ? '#333' : 'rgba(120,120,220,0.5)'}`,
  color: disabled ? '#555' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontFamily: '"Press Start 2P", monospace',
  fontSize: '10px',
  flexShrink: 0,
});
