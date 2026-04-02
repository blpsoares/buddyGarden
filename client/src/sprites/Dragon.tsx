import type { FC } from 'react';
import type { Expression } from '../components/BuddySprite.tsx';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface DragonBodyProps {
  primary: string;
  belly: string;
  accent: string;
  dark: string;
  light: string;
  outline: string;
  frame: number;
  size: number;
}

export interface DragonEyesProps {
  eyeColor: string;
  expression: Expression;
  frame: number;
  size: number;
  bodyY: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function frameValues(frame: number): { bodyY: number; wingRot: number; tailSwg: number; blink: boolean } {
  switch (frame % 3) {
    case 1: return { bodyY: -3, wingRot: -8, tailSwg: 10,  blink: false };
    case 2: return { bodyY:  2, wingRot:  5, tailSwg: -6,  blink: true  };
    default: return { bodyY:  0, wingRot:  0, tailSwg: 0,   blink: false };
  }
}

// ── DragonBody ────────────────────────────────────────────────────────────────

export const DragonBody: FC<DragonBodyProps> = ({ primary: c, belly, accent, dark, light, outline, frame, size }) => {
  const { bodyY, wingRot, tailSwg } = frameValues(frame);

  const bodyTransform = `translateY(${bodyY}px)`;
  const wingTransformL = `rotate(${wingRot}deg)`;
  const wingTransformR = `rotate(${-wingRot}deg)`;
  const tailTransform  = `rotate(${tailSwg}deg)`;

  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      style={{ position: 'absolute', top: 0, left: 0 }}
    >
      <defs>
        <linearGradient id="drg-body" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={light} />
          <stop offset="45%"  stopColor={c} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <linearGradient id="drg-belly" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={belly} stopOpacity="0.9" />
          <stop offset="100%" stopColor={belly} stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="drg-wing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={dark} />
          <stop offset="100%" stopColor={c} stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* ── Group that bobs up/down ── */}
      <g style={{ transform: bodyTransform, transition: 'transform 0.38s ease-in-out' }}>

        {/* ── Left wing (behind body) ── */}
        <g style={{ transformOrigin: '36px 55px', transform: wingTransformL, transition: 'transform 0.38s ease-in-out' }}>
          <path
            d="M36,55 C20,45 4,20 14,8 C20,2 32,14 36,28 C28,22 22,30 24,42 Z"
            fill="url(#drg-wing)"
            stroke={outline}
            strokeWidth={1.5}
            opacity={0.92}
          />
          {/* membrane ribs */}
          <path d="M36,55 C28,38 18,22 14,8"  fill="none" stroke={light} strokeWidth={1} opacity={0.4}/>
          <path d="M36,55 C26,42 18,30 20,16" fill="none" stroke={light} strokeWidth={0.7} opacity={0.3}/>
          <path d="M36,55 C30,46 26,36 28,24" fill="none" stroke={light} strokeWidth={0.5} opacity={0.25}/>
        </g>

        {/* ── Right wing (behind body) ── */}
        <g style={{ transformOrigin: '60px 55px', transform: wingTransformR, transition: 'transform 0.38s ease-in-out' }}>
          <path
            d="M60,55 C76,45 92,20 82,8 C76,2 64,14 60,28 C68,22 74,30 72,42 Z"
            fill="url(#drg-wing)"
            stroke={outline}
            strokeWidth={1.5}
            opacity={0.92}
          />
          <path d="M60,55 C68,38 78,22 82,8"  fill="none" stroke={light} strokeWidth={1} opacity={0.4}/>
          <path d="M60,55 C70,42 78,30 76,16" fill="none" stroke={light} strokeWidth={0.7} opacity={0.3}/>
          <path d="M60,55 C66,46 70,36 68,24" fill="none" stroke={light} strokeWidth={0.5} opacity={0.25}/>
        </g>

        {/* ── Tail ── */}
        <g style={{ transformOrigin: '68px 72px', transform: tailTransform, transition: 'transform 0.42s ease-in-out' }}>
          <path
            d="M68,72 C80,68 90,60 88,50 C86,44 80,46 76,52 C82,54 82,62 74,66 Z"
            fill={c}
            stroke={outline}
            strokeWidth={1.4}
          />
          {/* diamond tip */}
          <polygon
            points="88,50 84,44 92,44 90,50"
            fill={accent}
            stroke={outline}
            strokeWidth={1}
          />
          {/* spine ridge on tail */}
          <path d="M72,66 C78,62 82,56 82,50" fill="none" stroke={accent} strokeWidth={1.2} opacity={0.6}/>
        </g>

        {/* ── Body ── */}
        <ellipse cx={48} cy={63} rx={25} ry={20} fill="url(#drg-body)" stroke={outline} strokeWidth={1.8}/>

        {/* ── Belly ── */}
        <ellipse cx={48} cy={68} rx={16} ry={13} fill="url(#drg-belly)"/>
        {/* belly scale rows */}
        <path d="M38,62 Q48,65 58,62" fill="none" stroke={belly} strokeWidth={1.2} opacity={0.5}/>
        <path d="M36,68 Q48,72 60,68" fill="none" stroke={belly} strokeWidth={1.2} opacity={0.4}/>

        {/* ── Legs ── */}
        {/* left leg */}
        <path d="M36,78 C32,82 28,84 26,88" stroke={dark} strokeWidth={6} strokeLinecap="round" fill="none"/>
        <path d="M36,78 C32,82 28,84 26,88" stroke={c}    strokeWidth={4} strokeLinecap="round" fill="none"/>
        {/* left claws */}
        <path d="M26,88 C22,90 20,94 18,92" stroke={dark} strokeWidth={2.5} strokeLinecap="round" fill="none"/>
        <path d="M26,88 C24,92 24,96 22,95" stroke={dark} strokeWidth={2.5} strokeLinecap="round" fill="none"/>
        <path d="M26,88 C28,92 30,96 28,95" stroke={dark} strokeWidth={2.5} strokeLinecap="round" fill="none"/>
        {/* right leg */}
        <path d="M60,78 C64,82 68,84 70,88" stroke={dark} strokeWidth={6} strokeLinecap="round" fill="none"/>
        <path d="M60,78 C64,82 68,84 70,88" stroke={c}    strokeWidth={4} strokeLinecap="round" fill="none"/>
        {/* right claws */}
        <path d="M70,88 C74,90 76,94 78,92" stroke={dark} strokeWidth={2.5} strokeLinecap="round" fill="none"/>
        <path d="M70,88 C72,92 72,96 74,95" stroke={dark} strokeWidth={2.5} strokeLinecap="round" fill="none"/>
        <path d="M70,88 C68,92 66,96 68,95" stroke={dark} strokeWidth={2.5} strokeLinecap="round" fill="none"/>

        {/* ── Neck ── */}
        <path d="M38,44 C36,36 38,30 42,26" stroke={outline} strokeWidth={14} strokeLinecap="round" fill="none"/>
        <path d="M38,44 C36,36 38,30 42,26" stroke="url(#drg-body)" strokeWidth={12} strokeLinecap="round" fill="none"/>

        {/* ── Head ── */}
        <ellipse cx={48} cy={26} rx={22} ry={20} fill="url(#drg-body)" stroke={outline} strokeWidth={1.8}/>

        {/* ── Horns ── */}
        <path d="M34,10 C30,4 28,0 32,2 C36,4 38,10 36,14Z" fill={accent} stroke={outline} strokeWidth={1.2}/>
        <path d="M62,10 C66,4 68,0 64,2 C60,4 58,10 60,14Z" fill={accent} stroke={outline} strokeWidth={1.2}/>
        {/* small horn ridges */}
        <path d="M38,8 C36,4 38,2 40,4 C40,6 40,8 38,8Z"   fill={accent} stroke={outline} strokeWidth={0.8} opacity={0.7}/>
        <path d="M58,8 C60,4 58,2 56,4 C56,6 56,8 58,8Z"   fill={accent} stroke={outline} strokeWidth={0.8} opacity={0.7}/>

        {/* ── Head highlight ── */}
        <ellipse cx={38} cy={17} rx={9} ry={6} fill="rgba(255,255,255,0.18)" transform="rotate(-25 38 17)"/>

        {/* ── Snout ── */}
        <ellipse cx={64} cy={30} rx={11} ry={8} fill={c} stroke={outline} strokeWidth={1.4}/>
        <ellipse cx={64} cy={30} rx={7}  ry={5} fill={light} opacity={0.5}/>
        {/* nostrils */}
        <circle cx={61} cy={32} r={2} fill={dark}/>
        <circle cx={67} cy={32} r={2} fill={dark}/>
        {/* nostril shine */}
        <circle cx={60} cy={31} r={0.7} fill="rgba(255,255,255,0.6)"/>
        <circle cx={66} cy={31} r={0.7} fill="rgba(255,255,255,0.6)"/>

        {/* ── Spine ridge on back ── */}
        {[0,1,2,3].map(i => (
          <polygon
            key={i}
            points={`${44+i*4},${50-i} ${42+i*4},${42-i*2} ${46+i*4},${42-i*2}`}
            fill={accent}
            stroke={outline}
            strokeWidth={0.8}
            opacity={0.9}
          />
        ))}

      </g>
    </svg>
  );
};

// ── DragonEyes ────────────────────────────────────────────────────────────────

export const DragonEyes: FC<DragonEyesProps> = ({ eyeColor, expression, frame, size, bodyY }) => {
  const { blink } = frameValues(frame);

  // Eye positions in viewBox coords (matching FACE.dragon: lx:34 ly:27 rx:56 ry:27)
  const lx = 34, ly = 27, rx = 56, ry = 27;
  const er = 9;

  const scaleY = blink ? 0.1 : 1;

  function Pupil({ cx, cy, r }: { cx: number; cy: number; r: number }) {
    return (
      <g style={{ transformOrigin: `${cx}px ${cy}px`, transform: `scaleY(${scaleY})`, transition: 'transform 0.08s' }}>
        {/* sclera */}
        <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.95} fill="rgba(255,255,255,0.92)" stroke="#100048" strokeWidth={1.3}/>
        {/* iris */}
        <ellipse cx={cx} cy={cy} rx={r * 0.72} ry={r * 0.85} fill={eyeColor}/>
        {/* slit pupil — vertical */}
        <ellipse cx={cx} cy={cy} rx={r * 0.18} ry={r * 0.72} fill="#100048"/>
        {/* shine */}
        <circle cx={cx - r * 0.25} cy={cy - r * 0.3} r={r * 0.2} fill="rgba(255,255,255,0.85)"/>
      </g>
    );
  }

  function Eyebrow({ cx, cy, flip }: { cx: number; cy: number; flip?: boolean }) {
    const d = flip ? -1 : 1;
    switch (expression) {
      case 'excited':
        return <path d={`M${cx - 8 * d},${cy - 14} Q${cx},${cy - 17} ${cx + 6 * d},${cy - 13}`}
          stroke={eyeColor} strokeWidth={2.2} fill="none" strokeLinecap="round"/>;
      case 'focused':
        return <path d={`M${cx - 8 * d},${cy - 12} L${cx + 6 * d},${cy - 11}`}
          stroke={eyeColor} strokeWidth={2} fill="none" strokeLinecap="round"/>;
      case 'chaotic':
        return <path d={`M${cx - 8 * d},${cy - 11} Q${cx - 2 * d},${cy - 16} ${cx + 6 * d},${cy - 12}`}
          stroke={eyeColor} strokeWidth={2} fill="none" strokeLinecap="round"/>;
      case 'sleepy':
        return <path d={`M${cx - 7 * d},${cy - 11} Q${cx},${cy - 10} ${cx + 5 * d},${cy - 12}`}
          stroke={eyeColor} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.7}/>;
      case 'bored':
        return <path d={`M${cx - 7 * d},${cy - 12} L${cx + 5 * d},${cy - 12}`}
          stroke={eyeColor} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.7}/>;
      default: // happy
        return <path d={`M${cx - 8 * d},${cy - 13} Q${cx},${cy - 15} ${cx + 6 * d},${cy - 12}`}
          stroke={eyeColor} strokeWidth={2} fill="none" strokeLinecap="round"/>;
    }
  }

  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        transform: `translateY(${bodyY}px)`,
        transition: 'transform 0.38s ease-in-out',
        pointerEvents: 'none',
      }}
    >
      <Eyebrow cx={lx} cy={ly} />
      <Eyebrow cx={rx} cy={ry} flip />
      <Pupil cx={lx} cy={ly} r={er} />
      <Pupil cx={rx} cy={ry} r={er * 0.92} />

      {/* mouth expression */}
      {expression === 'excited' && (
        <path d="M42,38 Q48,44 54,38" stroke="#100048" strokeWidth={2} fill="none" strokeLinecap="round"/>
      )}
      {expression === 'chaotic' && (
        <polyline points="40,38 43,42 46,36 50,42 54,38"
          stroke="#100048" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      )}
      {expression === 'focused' && (
        <line x1="43" y1="39" x2="53" y2="39" stroke="#100048" strokeWidth={2} strokeLinecap="round"/>
      )}
      {(expression === 'happy' || expression === 'bored' || expression === 'sleepy') && (
        <path d="M42,37 Q48,43 54,37" stroke="#100048" strokeWidth={1.8} fill="none" strokeLinecap="round"
          opacity={expression === 'bored' ? 0.5 : 1}/>
      )}

      {/* excited blush */}
      {expression === 'excited' && (
        <>
          <ellipse cx={lx - 12} cy={ly + 7} rx={6} ry={4} fill="rgba(255,120,100,0.35)"/>
          <ellipse cx={rx + 12} cy={ry + 7} rx={6} ry={4} fill="rgba(255,120,100,0.35)"/>
        </>
      )}
    </svg>
  );
};
