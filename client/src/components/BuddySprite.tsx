import { useEffect, useRef } from 'react';
import type { BuddyBones } from '../hooks/useBuddy.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Expression = 'happy' | 'excited' | 'sleepy' | 'focused' | 'chaotic' | 'bored';

interface Props {
  bones: Pick<BuddyBones, 'species' | 'isShiny' | 'eye' | 'hat'>;
  frame?: number;
  size?: number;
  expression?: Expression;
}

// ── Palette ───────────────────────────────────────────────────────────────────

interface Pal { p: string; d: string; l: string; b: string; K: string; a: string; }

const PALS: Record<string, Pal> = {
  duck:     { p:'#F5C84E', d:'#C49830', l:'#FFE47A', b:'#FFFFFF', K:'#2C2210', a:'#FF8C30' },
  goose:    { p:'#D8D8B8', d:'#A0A070', l:'#F0F0D8', b:'#F5C84E', K:'#2C2210', a:'#FF9030' },
  cat:      { p:'#D4A060', d:'#8A5020', l:'#EFC07A', b:'#FFF0EC', K:'#2C1A0A', a:'#FF9BB0' },
  rabbit:   { p:'#E8D0D0', d:'#B08080', l:'#FFF0F0', b:'#FFE0E0', K:'#2C1A1A', a:'#FF9BB0' },
  owl:      { p:'#7A6040', d:'#4A3010', l:'#AA8860', b:'#FFD070', K:'#1A1008', a:'#FF9030' },
  penguin:  { p:'#283848', d:'#101828', l:'#384858', b:'#FFFFFF', K:'#0A0A10', a:'#FF8C30' },
  turtle:   { p:'#488048', d:'#285028', l:'#68A868', b:'#D8C870', K:'#102010', a:'#F0C840' },
  snail:    { p:'#C07848', d:'#884818', l:'#DCA870', b:'#F0C840', K:'#2C1A08', a:'#FF68A0' },
  dragon:   { p:'#8848F8', d:'#3810C0', l:'#B888FF', b:'#FF4888', K:'#100048', a:'#FFD840' },
  octopus:  { p:'#E05888', d:'#A02858', l:'#FF88A8', b:'#FFE0E8', K:'#280A18', a:'#8848F0' },
  axolotl:  { p:'#FFA0C0', d:'#C05888', l:'#FFD8E8', b:'#FFFFFF', K:'#280A18', a:'#FF5898' },
  ghost:    { p:'#D0D0E8', d:'#7878A8', l:'#F0F0FF', b:'#FFFFFF', K:'#303068', a:'#FF60A8' },
  robot:    { p:'#6868A0', d:'#303078', l:'#A0B8E0', b:'#0A0A20', K:'#101038', a:'#00F078' },
  blob:     { p:'#60C888', d:'#208848', l:'#98F8B8', b:'#FFFFFF', K:'#082818', a:'#FF7070' },
  cactus:   { p:'#408040', d:'#206020', l:'#68B068', b:'#FFFFFF', K:'#102010', a:'#FF60A0' },
  mushroom: { p:'#C82020', d:'#800000', l:'#FF6060', b:'#FFFFFF', K:'#1A0A0A', a:'#F0C840' },
  chonk:    { p:'#C08848', d:'#885020', l:'#E0B870', b:'#FFF0E0', K:'#2C1808', a:'#FFB0A0' },
  capybara: { p:'#B08050', d:'#784820', l:'#C8A070', b:'#C8A070', K:'#2C1808', a:'#70A050' },
};

// ── Drawing helpers ───────────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;

/** Fill a solid rectangle */
const rf = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Chamfered rect (cross pattern) with outline — gives rounded-square pixel look */
const ov = (ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, K: string) => {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w < 2 || h < 2) { rf(ctx, x, y, w, h, fill); return; }
  ctx.fillStyle = K;
  ctx.fillRect(x + 1, y, w - 2, h);
  ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
};

/** 2×2 eye or blink line */
const px_eye = (ctx: Ctx, x: number, y: number, white: string, pupil: string, blink: boolean) => {
  x = Math.round(x); y = Math.round(y);
  if (blink) {
    ctx.fillStyle = pupil;
    ctx.fillRect(x, y + 1, 2, 1);
  } else {
    ctx.fillStyle = white;
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = pupil;
    ctx.fillRect(x, y, 1, 1);
  }
};

/** 3×3 eye (owl-style) with optional dark ring */
const px_eye3 = (ctx: Ctx, x: number, y: number, fill: string, pupil: string, ring: string, blink: boolean) => {
  x = Math.round(x); y = Math.round(y);
  if (blink) {
    ctx.fillStyle = pupil;
    ctx.fillRect(x, y + 1, 3, 1);
    return;
  }
  // ring
  ctx.fillStyle = ring;
  ctx.fillRect(x + 1, y, 1, 3);
  ctx.fillRect(x, y + 1, 3, 1);
  // fill
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, 1, 1);
  // pupil
  ctx.fillStyle = pupil;
  ctx.fillRect(x + 1, y + 1, 1, 1);
};

/** Draw mouth based on expression */
const drawMouth = (ctx: Ctx, cx: number, y: number, expr: Expression, K: string) => {
  cx = Math.round(cx); y = Math.round(y);
  switch (expr) {
    case 'happy':
      ctx.fillStyle = K;
      ctx.fillRect(cx - 1, y, 3, 1);
      ctx.fillRect(cx - 2, y - 1, 1, 1);
      ctx.fillRect(cx + 2, y - 1, 1, 1);
      break;
    case 'excited':
      ctx.fillStyle = K;
      ctx.fillRect(cx - 2, y - 1, 5, 2);
      ctx.fillStyle = '#FF6080';
      ctx.fillRect(cx - 1, y, 3, 1);
      break;
    case 'sleepy':
      ctx.fillStyle = K;
      ctx.fillRect(cx - 1, y, 3, 1);
      break;
    case 'focused':
      ctx.fillStyle = K;
      ctx.fillRect(cx - 1, y, 3, 1);
      ctx.fillRect(cx - 2, y, 1, 1);
      break;
    case 'chaotic':
      ctx.fillStyle = K;
      ctx.fillRect(cx - 2, y, 5, 1);
      ctx.fillRect(cx - 3, y - 1, 1, 1);
      ctx.fillRect(cx + 3, y - 1, 1, 1);
      break;
    case 'bored':
      ctx.fillStyle = K;
      ctx.fillRect(cx - 1, y, 3, 1);
      break;
  }
};

// ── Species drawers ───────────────────────────────────────────────────────────

function drawDuck(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // tail
  ov(ctx, 1, 14 + by, 5, 5, d, K);
  // body
  ov(ctx, 3, 12 + by, 14, 9, p, K);
  // belly
  ov(ctx, 6, 14 + by, 8, 6, l, 'transparent');
  // wing
  rf(ctx, 14, 14 + by, 3, 4, d);
  // feet
  ov(ctx, 4, 20 + by, 4, 3, a, K);
  ov(ctx, 11, 20 + by, 4, 3, a, K);
  // head
  ov(ctx, 4, 1 + by, 15, 11, p, K);
  // white cheek patch
  ov(ctx, 9, 6 + by, 6, 4, b, 'transparent');
  // beak
  rf(ctx, 19, 4 + by, 4, 3, a);
  ctx.fillStyle = K;
  ctx.fillRect(19, 5 + by, 4, 1);
  // eyes
  px_eye(ctx, 8, 3 + by, b, K, blink);
  px_eye(ctx, 14, 3 + by, b, K, blink);
  // mouth
  drawMouth(ctx, 12, 9 + by, expr, K);
}

function drawGoose(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // tail
  ov(ctx, 1, 13 + by, 5, 6, d, K);
  // body
  ov(ctx, 3, 13 + by, 14, 9, p, K);
  // belly (yellow)
  ov(ctx, 6, 15 + by, 8, 6, b, 'transparent');
  // neck (elongated)
  ov(ctx, 8, 8 + by, 6, 7, p, K);
  // wing
  rf(ctx, 14, 15 + by, 3, 4, d);
  // feet
  ov(ctx, 4, 21 + by, 4, 2, a, K);
  ov(ctx, 11, 21 + by, 4, 2, a, K);
  // head
  ov(ctx, 5, 1 + by, 14, 9, p, K);
  // beak
  rf(ctx, 19, 4 + by, 4, 2, a);
  ctx.fillStyle = K;
  ctx.fillRect(19, 5 + by, 4, 1);
  // eyes
  px_eye(ctx, 9, 2 + by, b, K, blink);
  px_eye(ctx, 15, 2 + by, b, K, blink);
  // light highlight on belly area
  ov(ctx, 8, 16 + by, 5, 4, l, 'transparent');
  drawMouth(ctx, 13, 8 + by, expr, K);
}

function drawCat(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // ears (before head so head overlaps base)
  // left ear outer
  ctx.fillStyle = K;
  ctx.fillRect(5, 0 + by, 4, 4);
  ctx.fillStyle = p;
  ctx.fillRect(6, 1 + by, 2, 3);
  ctx.fillStyle = a;
  ctx.fillRect(6, 2 + by, 2, 2);
  // right ear outer
  ctx.fillStyle = K;
  ctx.fillRect(15, 0 + by, 4, 4);
  ctx.fillStyle = p;
  ctx.fillRect(16, 1 + by, 2, 3);
  ctx.fillStyle = a;
  ctx.fillRect(16, 2 + by, 2, 2);
  // head
  ov(ctx, 4, 2 + by, 16, 10, p, K);
  // face highlight
  ov(ctx, 7, 5 + by, 10, 6, l, 'transparent');
  // eyes
  px_eye(ctx, 7, 4 + by, b, K, blink);
  px_eye(ctx, 15, 4 + by, b, K, blink);
  // nose
  rf(ctx, 11, 9 + by, 2, 1, a);
  // whiskers
  ctx.fillStyle = d;
  ctx.fillRect(5, 9 + by, 4, 1);
  ctx.fillRect(15, 9 + by, 4, 1);
  ctx.fillRect(5, 10 + by, 3, 1);
  ctx.fillRect(16, 10 + by, 3, 1);
  // body
  ov(ctx, 4, 12 + by, 15, 8, p, K);
  // belly
  ov(ctx, 7, 14 + by, 9, 5, b, 'transparent');
  // tail
  rf(ctx, 19, 14 + by, 3, 7, d);
  rf(ctx, 18, 20 + by, 3, 2, d);
  // legs
  ov(ctx, 5, 19 + by, 4, 4, d, K);
  ov(ctx, 13, 19 + by, 4, 4, d, K);
  drawMouth(ctx, 12, 10 + by, expr, K);
}

function drawRabbit(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // left ear
  ov(ctx, 5, 0 + by, 3, 7, p, K);
  rf(ctx, 6, 1 + by, 1, 5, a);
  // right ear
  ov(ctx, 15, 0 + by, 3, 7, p, K);
  rf(ctx, 16, 1 + by, 1, 5, a);
  // head
  ov(ctx, 4, 5 + by, 16, 10, p, K);
  // face
  ov(ctx, 7, 8 + by, 10, 6, l, 'transparent');
  // eyes
  px_eye(ctx, 7, 7 + by, b, K, blink);
  px_eye(ctx, 15, 7 + by, b, K, blink);
  // nose
  rf(ctx, 11, 11 + by, 2, 1, a);
  // body
  ov(ctx, 4, 15 + by, 15, 7, p, K);
  // belly
  ov(ctx, 7, 16 + by, 9, 5, l, 'transparent');
  // tail (small round back)
  ov(ctx, 19, 17 + by, 3, 3, b, K);
  // legs
  ov(ctx, 5, 21 + by, 4, 3, d, K);
  ov(ctx, 14, 21 + by, 4, 3, d, K);
  drawMouth(ctx, 12, 12 + by, expr, K);
}

function drawOwl(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // ear tufts
  ctx.fillStyle = K;
  ctx.fillRect(7, 1 + by, 2, 3);
  ctx.fillStyle = d;
  ctx.fillRect(7, 2 + by, 2, 2);
  ctx.fillStyle = K;
  ctx.fillRect(15, 1 + by, 2, 3);
  ctx.fillStyle = d;
  ctx.fillRect(15, 2 + by, 2, 2);
  // head (very round and wide)
  ov(ctx, 3, 2 + by, 18, 12, p, K);
  // face disk (lighter center)
  ov(ctx, 5, 4 + by, 14, 9, l, 'transparent');
  // big 3×3 eyes with ring
  const eyeRing = d;
  if (blink) {
    ctx.fillStyle = K;
    ctx.fillRect(6, 7 + by, 3, 1);
    ctx.fillRect(15, 7 + by, 3, 1);
  } else {
    // left eye ring
    ctx.fillStyle = eyeRing;
    ctx.fillRect(6, 5 + by, 5, 5);
    ctx.fillStyle = b;
    ctx.fillRect(7, 6 + by, 3, 3);
    ctx.fillStyle = K;
    ctx.fillRect(7, 6 + by, 2, 2);
    // right eye ring
    ctx.fillStyle = eyeRing;
    ctx.fillRect(13, 5 + by, 5, 5);
    ctx.fillStyle = b;
    ctx.fillRect(14, 6 + by, 3, 3);
    ctx.fillStyle = K;
    ctx.fillRect(14, 6 + by, 2, 2);
  }
  // beak (small triangle/diamond between eyes)
  rf(ctx, 11, 8 + by, 2, 1, a);
  rf(ctx, 11, 9 + by, 2, 2, a);
  ctx.fillStyle = K;
  ctx.fillRect(11, 10 + by, 2, 1);
  // body
  ov(ctx, 4, 14 + by, 16, 8, p, K);
  // belly
  ov(ctx, 7, 15 + by, 10, 6, a, 'transparent');
  // wing V markings
  ctx.fillStyle = d;
  ctx.fillRect(6, 16 + by, 4, 1);
  ctx.fillRect(7, 17 + by, 3, 1);
  ctx.fillRect(14, 16 + by, 4, 1);
  ctx.fillRect(13, 17 + by, 3, 1);
  // feet
  ov(ctx, 6, 21 + by, 4, 3, d, K);
  ov(ctx, 13, 21 + by, 4, 3, d, K);
  drawMouth(ctx, 12, 12 + by, expr, K);
}

function drawPenguin(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // body (dark)
  ov(ctx, 3, 12 + by, 18, 10, p, K);
  // white belly oval
  ov(ctx, 7, 13 + by, 10, 8, b, 'transparent');
  // wing arms
  rf(ctx, 2, 14 + by, 3, 6, d);
  rf(ctx, 19, 14 + by, 3, 6, d);
  // feet
  ov(ctx, 6, 21 + by, 4, 3, a, K);
  ov(ctx, 13, 21 + by, 4, 3, a, K);
  // head
  ov(ctx, 5, 1 + by, 14, 12, p, K);
  // white face patch
  ov(ctx, 7, 5 + by, 10, 7, b, 'transparent');
  // eyes
  px_eye(ctx, 8, 4 + by, b, K, blink);
  px_eye(ctx, 14, 4 + by, b, K, blink);
  // beak
  rf(ctx, 10, 9 + by, 4, 2, a);
  ctx.fillStyle = K;
  ctx.fillRect(10, 10 + by, 4, 1);
  drawMouth(ctx, 12, 11 + by, expr, K);
}

function drawTurtle(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // legs (corner stubs)
  ov(ctx, 2, 16 + by, 4, 4, p, K);
  ov(ctx, 18, 16 + by, 4, 4, p, K);
  ov(ctx, 4, 21 + by, 4, 3, p, K);
  ov(ctx, 16, 21 + by, 4, 3, p, K);
  // shell base
  ov(ctx, 3, 8 + by, 18, 14, d, K);
  // shell dome top
  ov(ctx, 4, 5 + by, 16, 13, p, K);
  // shell highlight
  ov(ctx, 6, 6 + by, 12, 9, l, 'transparent');
  // shell pattern (crosshatch lines)
  ctx.fillStyle = d;
  ctx.fillRect(11, 6 + by, 1, 11);
  ctx.fillRect(7, 6 + by, 1, 11);
  ctx.fillRect(15, 6 + by, 1, 11);
  ctx.fillRect(4, 10 + by, 16, 1);
  ctx.fillRect(4, 14 + by, 16, 1);
  // shell outline accent
  rf(ctx, 5, 5 + by, 1, 1, a);
  rf(ctx, 18, 5 + by, 1, 1, a);
  // head (small, poking out from top)
  ov(ctx, 8, 1 + by, 8, 6, p, K);
  // eyes
  px_eye(ctx, 9, 2 + by, b, K, blink);
  px_eye(ctx, 14, 2 + by, b, K, blink);
  drawMouth(ctx, 12, 5 + by, expr, K);
}

function drawSnail(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // SIDE VIEW
  // foot/body (horizontal)
  ov(ctx, 1, 17 + by, 16, 5, p, K);
  // foot highlight
  ov(ctx, 3, 18 + by, 8, 3, l, 'transparent');
  // shell (big spiral on right)
  // outer
  ov(ctx, 8, 5 + by, 14, 14, d, K);
  // mid ring
  ov(ctx, 10, 7 + by, 10, 10, p, K);
  // inner
  ov(ctx, 12, 9 + by, 6, 6, l, K);
  // center dot
  rf(ctx, 14, 11 + by, 2, 2, a);
  // eye stalks
  ctx.fillStyle = K;
  ctx.fillRect(2, 13 + by, 1, 4);
  ctx.fillRect(5, 12 + by, 1, 5);
  // eyes on stalks
  rf(ctx, 1, 12 + by, 3, 2, b);
  ctx.fillStyle = K;
  ctx.fillRect(2, 12 + by, 1, 1);
  rf(ctx, 4, 11 + by, 3, 2, b);
  ctx.fillStyle = K;
  ctx.fillRect(5, 11 + by, 1, 1);
  // face on left of body
  if (!blink) {
    ctx.fillStyle = K;
    ctx.fillRect(3, 19 + by, 3, 1);
  } else {
    ctx.fillStyle = K;
    ctx.fillRect(3, 20 + by, 3, 1);
  }
  // accent
  ov(ctx, 1, 21 + by, 3, 2, a, 'transparent');
}

function drawDragon(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  // ── SIDE VIEW: head faces LEFT, wing rises behind, tail sweeps RIGHT ──
  const { p, d, l, b, K, a } = pal;

  // === WING (large triangle, tip upper-right, base at body y=12) ===
  // rows [xl, xr] going from y=1 (tip) to y=12 (base)
  const wg:[number,number][] = [
    [21,22],[19,22],[17,22],[15,22],[13,22],
    [11,22],[10,22],[10,22],[10,21],[10,20],[10,19],[10,18],
  ];
  wg.forEach(([xl,xr],i)=>{
    const y=1+i+by; const w=xr-xl+1;
    if(w===1){rf(ctx,xl,y,1,1,K);return;}
    rf(ctx,xl,y,1,1,K); rf(ctx,xr,y,1,1,K);
    rf(ctx,xl+1,y,w-2,1,d);           // dark purple fill with lighter ribs
  });
  // wing membrane ribs (bright accent = gold, very visible)
  rf(ctx,14,4+by,1,5,a); rf(ctx,17,3+by,1,6,a); rf(ctx,20,2+by,1,5,a);

  // === TAIL: sweeps right from body, ends in diamond ===
  rf(ctx,16,17+by,7,2,K); rf(ctx,17,18+by,5,1,d);  // row 1
  rf(ctx,18,19+by,6,2,K); rf(ctx,19,20+by,4,1,d);  // row 2
  rf(ctx,21,21+by,3,1,K); rf(ctx,22,21+by,1,1,d);  // tip area
  // diamond tip
  rf(ctx,22,20+by,1,1,a); rf(ctx,23,21+by,1,1,a); rf(ctx,22,22+by,1,1,a);

  // === BODY ===
  ov(ctx,5,12+by,14,8,p,K);
  // belly lighter
  rf(ctx,7,14+by,10,4,b); rf(ctx,6,15+by,12,2,b);
  // spine bumps
  rf(ctx,9,12+by,1,1,a); rf(ctx,12,12+by,1,1,a); rf(ctx,15,12+by,1,1,a);

  // === HORN (single, side view — one horn visible) ===
  rf(ctx,6,0+by,1,1,K); rf(ctx,7,0+by,1,1,a);  // horn tip
  rf(ctx,6,1+by,1,2,K); rf(ctx,7,1+by,1,2,a);  // horn shaft
  rf(ctx,8,2+by,1,2,K); rf(ctx,9,2+by,1,2,a);  // second horn (slightly behind)

  // === HEAD (faces LEFT) ===
  ov(ctx,1,3+by,14,11,p,K);
  rf(ctx,3,5+by,6,3,l);  // head shine

  // === SNOUT (blunt, points LEFT) ===
  rf(ctx,0,7+by,3,5,K); rf(ctx,1,8+by,1,3,l);  // snout
  rf(ctx,1,9+by,1,1,K);  // nostril

  // === EYE (side view — just one large eye) ===
  if(blink){
    rf(ctx,7,8+by,5,1,K);
  } else {
    ov(ctx,6,6+by,5,5,'#fff',K);
    rf(ctx,7,7+by,3,3,a);    // iris (gold)
    rf(ctx,8,6+by,1,5,K);    // vertical slit pupil
    rf(ctx,6,6+by,2,2,'#fff'); // eye highlight
  }

  // Mouth (small, on snout side)
  if(expr==='excited'||expr==='chaotic'){
    rf(ctx,1,11+by,3,1,K); rf(ctx,1,10+by,1,1,K); rf(ctx,3,10+by,1,1,K);
  } else {
    rf(ctx,1,11+by,2,1,K);
  }

  // === LEGS ===
  ov(ctx,6,19+by,4,4,d,K);
  rf(ctx,5,22+by,1,2,K); rf(ctx,7,23+by,1,1,K); rf(ctx,9,22+by,1,2,K);  // claws
  // back leg (partially hidden)
  ov(ctx,12,19+by,3,4,d,K);
  rf(ctx,11,22+by,1,2,K); rf(ctx,13,23+by,1,1,K);
}

function drawOctopus(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // tentacles (sinuous lines below y=14)
  ctx.fillStyle = p;
  // 6 tentacles
  const tentacleX = [2, 5, 8, 12, 15, 18];
  for (let i = 0; i < tentacleX.length; i++) {
    const x = tentacleX[i];
    const offset = i % 2 === 0 ? 0 : 1;
    ctx.fillRect(x, 15 + by, 2, 3 + offset);
    ctx.fillRect(x + (i % 2 === 0 ? 1 : -1), 18 + offset + by, 2, 3);
    // suckers
    ctx.fillStyle = l;
    ctx.fillRect(x + 1, 17 + offset + by, 1, 1);
    ctx.fillStyle = p;
  }
  // outline tentacles
  ctx.fillStyle = K;
  for (let i = 0; i < tentacleX.length; i++) {
    const x = tentacleX[i];
    ctx.fillRect(x - 1, 15 + by, 1, 5);
    ctx.fillRect(x + 2, 15 + by, 1, 5);
  }
  // mantle body
  ov(ctx, 3, 3 + by, 18, 14, p, K);
  // belly
  ov(ctx, 6, 7 + by, 12, 9, l, 'transparent');
  // eyes (big cute)
  px_eye(ctx, 7, 5 + by, b, K, blink);
  px_eye(ctx, 7, 5 + by, b, a, blink);
  px_eye(ctx, 15, 5 + by, b, K, blink);
  // highlight dot in eyes
  if (!blink) {
    ctx.fillStyle = b;
    ctx.fillRect(8, 5 + by, 1, 1);
    ctx.fillRect(16, 5 + by, 1, 1);
  }
  drawMouth(ctx, 12, 10 + by, expr, K);
  // accent spots
  ctx.fillStyle = a;
  ctx.fillRect(10, 4 + by, 2, 1);
  ctx.fillRect(5, 8 + by, 1, 2);
  ctx.fillRect(18, 8 + by, 1, 2);
}

function drawAxolotl(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // gill frills LEFT (zigzag spikes pointing left)
  ctx.fillStyle = a;
  ctx.fillRect(1, 3 + by, 3, 1);
  ctx.fillRect(0, 5 + by, 3, 1);
  ctx.fillRect(1, 7 + by, 3, 1);
  ctx.fillStyle = K;
  ctx.fillRect(0, 3 + by, 1, 1);
  ctx.fillRect(-1, 5 + by, 1, 1);
  ctx.fillRect(0, 7 + by, 1, 1);
  // gill frills RIGHT
  ctx.fillStyle = a;
  ctx.fillRect(20, 3 + by, 3, 1);
  ctx.fillRect(21, 5 + by, 3, 1);
  ctx.fillRect(20, 7 + by, 3, 1);
  ctx.fillStyle = K;
  ctx.fillRect(23, 3 + by, 1, 1);
  ctx.fillRect(24, 5 + by, 1, 1);
  ctx.fillRect(23, 7 + by, 1, 1);
  // head (wide and flat)
  ov(ctx, 3, 2 + by, 18, 10, p, K);
  // face highlight
  ov(ctx, 5, 4 + by, 14, 7, l, 'transparent');
  // eyes
  px_eye(ctx, 7, 4 + by, b, K, blink);
  px_eye(ctx, 16, 4 + by, b, K, blink);
  // wide smile
  ctx.fillStyle = K;
  ctx.fillRect(7, 10 + by, 10, 1);
  ctx.fillRect(6, 9 + by, 1, 1);
  ctx.fillRect(17, 9 + by, 1, 1);
  // body
  ov(ctx, 4, 12 + by, 16, 9, p, K);
  // belly
  ov(ctx, 7, 13 + by, 10, 6, b, 'transparent');
  // stubby legs
  ov(ctx, 4, 20 + by, 4, 3, d, K);
  ov(ctx, 16, 20 + by, 4, 3, d, K);
  // gill accent
  ctx.fillStyle = d;
  ctx.fillRect(6, 3 + by, 2, 1);
  ctx.fillRect(16, 3 + by, 2, 1);
}

function drawGhost(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // body + head merged (no neck)
  ov(ctx, 3, 1 + by, 18, 18, p, K);
  // lighter inner
  ov(ctx, 6, 3 + by, 12, 14, l, 'transparent');
  // wavy bottom edge
  ctx.fillStyle = K;
  ctx.fillRect(3, 18 + by, 18, 1);
  ctx.fillStyle = p;
  // alternating waves cut into bottom
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(4 + i * 4, 19 + by, 2, 3);
    ctx.fillRect(4 + i * 4, 22 + by, 2, 1);
  }
  ctx.fillStyle = K;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(6 + i * 4, 19 + by, 2, 2);
  }
  // eyes (simple dot eyes, ghost-like)
  if (blink) {
    ctx.fillStyle = K;
    ctx.fillRect(8, 8 + by, 2, 1);
    ctx.fillRect(14, 8 + by, 2, 1);
  } else {
    ctx.fillStyle = d;
    ctx.fillRect(8, 7 + by, 2, 3);
    ctx.fillRect(14, 7 + by, 2, 3);
    ctx.fillStyle = K;
    ctx.fillRect(8, 7 + by, 2, 2);
    ctx.fillRect(14, 7 + by, 2, 2);
  }
  // blush
  ctx.fillStyle = a;
  ctx.fillRect(6, 11 + by, 2, 1);
  ctx.fillRect(16, 11 + by, 2, 1);
  // tiny bow on top
  ctx.fillStyle = a;
  ctx.fillRect(10, 0 + by, 4, 2);
  ctx.fillStyle = K;
  ctx.fillRect(11, 0 + by, 2, 1);
  drawMouth(ctx, 12, 13 + by, expr, K);
}

function drawRobot(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // antenna
  ctx.fillStyle = K;
  ctx.fillRect(11, 0 + by, 1, 3);
  ov(ctx, 9, 0 + by, 5, 3, a, K);
  // head (boxy — rect not oval)
  rf(ctx, 4, 3 + by, 16, 11, K);
  rf(ctx, 5, 4 + by, 14, 9, p, K);
  // visor dark band
  rf(ctx, 5, 6 + by, 14, 4, b);
  ctx.fillStyle = K;
  ctx.fillRect(5, 6 + by, 14, 1);
  ctx.fillRect(5, 9 + by, 14, 1);
  // LED eyes in visor
  if (blink) {
    ctx.fillStyle = a;
    ctx.fillRect(7, 7 + by, 4, 1);
    ctx.fillRect(13, 7 + by, 4, 1);
  } else {
    ctx.fillStyle = a;
    ctx.fillRect(7, 7 + by, 2, 2);
    ctx.fillRect(15, 7 + by, 2, 2);
    ctx.fillStyle = l;
    ctx.fillRect(7, 7 + by, 1, 1);
    ctx.fillRect(15, 7 + by, 1, 1);
  }
  // chest panel
  ov(ctx, 4, 14 + by, 16, 8, p, K);
  rf(ctx, 7, 15 + by, 10, 5, d);
  ctx.fillStyle = a;
  ctx.fillRect(8, 16 + by, 2, 2);
  ctx.fillRect(12, 16 + by, 3, 1);
  ctx.fillRect(12, 18 + by, 3, 1);
  // arms (rectangular)
  rf(ctx, 1, 14 + by, 3, 6, K);
  rf(ctx, 1, 14 + by, 2, 5, p);
  rf(ctx, 20, 14 + by, 3, 6, K);
  rf(ctx, 21, 14 + by, 2, 5, p);
  // feet (square)
  rf(ctx, 5, 21 + by, 5, 3, K);
  rf(ctx, 5, 21 + by, 4, 2, p);
  rf(ctx, 14, 21 + by, 5, 3, K);
  rf(ctx, 14, 21 + by, 4, 2, p);
  // mouth light
  ctx.fillStyle = l;
  ctx.fillRect(8, 11 + by, 8, 1);
  ctx.fillStyle = p;
  ctx.fillRect(9, 11 + by, 6, 1);
}

function drawBlob(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // amorphous shape — one big body with lumpy top
  // bumps on top
  ov(ctx, 4, 2 + by, 6, 5, p, K);
  ov(ctx, 10, 1 + by, 7, 5, p, K);
  ov(ctx, 16, 3 + by, 5, 4, p, K);
  // main body
  ov(ctx, 2, 5 + by, 20, 17, p, K);
  // inner highlight
  ov(ctx, 5, 7 + by, 14, 12, l, 'transparent');
  // face on upper part
  px_eye(ctx, 8, 7 + by, b, K, blink);
  px_eye(ctx, 15, 7 + by, b, K, blink);
  // highlight in eyes
  if (!blink) {
    ctx.fillStyle = b;
    ctx.fillRect(9, 7 + by, 1, 1);
    ctx.fillRect(16, 7 + by, 1, 1);
  }
  drawMouth(ctx, 12, 12 + by, expr, K);
  // accent spots
  ctx.fillStyle = a;
  ctx.fillRect(5, 13 + by, 2, 2);
  ctx.fillRect(17, 15 + by, 2, 2);
  ctx.fillStyle = d;
  ctx.fillRect(12, 16 + by, 3, 2);
}

function drawCactus(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // barrel body (main trunk)
  ov(ctx, 6, 10 + by, 12, 12, p, K);
  // body highlight
  ov(ctx, 9, 12 + by, 6, 9, l, 'transparent');
  // left arm
  ov(ctx, 2, 12 + by, 7, 5, p, K);
  ov(ctx, 2, 9 + by, 5, 5, p, K);
  // right arm
  ov(ctx, 15, 12 + by, 7, 5, p, K);
  ov(ctx, 17, 9 + by, 5, 5, p, K);
  // spines on body
  ctx.fillStyle = l;
  ctx.fillRect(7, 12 + by, 1, 1);
  ctx.fillRect(7, 16 + by, 1, 1);
  ctx.fillRect(16, 12 + by, 1, 1);
  ctx.fillRect(16, 16 + by, 1, 1);
  ctx.fillRect(10, 11 + by, 1, 1);
  ctx.fillRect(13, 11 + by, 1, 1);
  // flower on top (pink petals)
  ctx.fillStyle = a;
  ctx.fillRect(10, 1 + by, 4, 1);
  ctx.fillRect(11, 0 + by, 2, 1);
  ctx.fillRect(9, 2 + by, 1, 3);
  ctx.fillRect(14, 2 + by, 1, 3);
  ctx.fillRect(10, 4 + by, 4, 1);
  ctx.fillRect(11, 5 + by, 2, 1);
  // flower center
  ctx.fillStyle = '#F0C840';
  ctx.fillRect(10, 2 + by, 4, 3);
  ctx.fillStyle = K;
  ctx.fillRect(11, 3 + by, 2, 1);
  // face on body
  px_eye(ctx, 9, 14 + by, b, K, blink);
  px_eye(ctx, 14, 14 + by, b, K, blink);
  drawMouth(ctx, 12, 18 + by, expr, K);
  // feet/base
  ov(ctx, 7, 21 + by, 10, 3, d, K);
}

function drawMushroom(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // large cap (top 60% of sprite)
  ov(ctx, 2, 1 + by, 20, 13, p, K);
  // cap underside (slightly lighter, flat bottom)
  rf(ctx, 3, 13 + by, 18, 2, d);
  // cap highlight
  ov(ctx, 5, 3 + by, 8, 6, l, 'transparent');
  // white spots on cap
  rf(ctx, 6, 4 + by, 2, 2, b);
  rf(ctx, 15, 3 + by, 2, 2, b);
  rf(ctx, 11, 6 + by, 2, 2, b);
  rf(ctx, 7, 9 + by, 2, 2, b);
  rf(ctx, 17, 8 + by, 2, 2, b);
  // white stem
  ov(ctx, 7, 14 + by, 10, 8, b, K);
  // stem highlight
  ov(ctx, 9, 15 + by, 5, 6, '#F8F8F8', 'transparent');
  // face on stem
  px_eye(ctx, 9, 16 + by, b, K, blink);
  px_eye(ctx, 14, 16 + by, b, K, blink);
  drawMouth(ctx, 12, 20 + by, expr, K);
  // tiny legs/feet
  ov(ctx, 7, 21 + by, 4, 3, K, K);
  ov(ctx, 7, 21 + by, 3, 2, d);
  ov(ctx, 13, 21 + by, 4, 3, K, K);
  ov(ctx, 14, 21 + by, 3, 2, d);
}

function drawChonk(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // VERY FAT — almost full width
  // fat rolls hint
  ctx.fillStyle = d;
  ctx.fillRect(3, 14 + by, 18, 1);
  // huge body
  ov(ctx, 1, 10 + by, 22, 12, p, K);
  // wide belly
  ov(ctx, 4, 12 + by, 16, 9, l, 'transparent');
  // chubby roll layer
  ov(ctx, 2, 13 + by, 20, 7, p, 'transparent');
  ctx.fillStyle = d;
  ctx.fillRect(2, 13 + by, 20, 1);
  // tiny cat ears barely visible
  ctx.fillStyle = K;
  ctx.fillRect(6, 8 + by, 3, 3);
  ctx.fillStyle = p;
  ctx.fillRect(7, 9 + by, 1, 2);
  ctx.fillStyle = a;
  ctx.fillRect(7, 10 + by, 1, 1);
  ctx.fillStyle = K;
  ctx.fillRect(15, 8 + by, 3, 3);
  ctx.fillStyle = p;
  ctx.fillRect(15, 9 + by, 1, 2);
  ctx.fillStyle = a;
  ctx.fillRect(15, 10 + by, 1, 1);
  // tiny head barely above body
  ov(ctx, 5, 6 + by, 14, 7, p, K);
  // tiny eyes
  px_eye(ctx, 8, 7 + by, b, K, blink);
  px_eye(ctx, 15, 7 + by, b, K, blink);
  // tiny legs barely visible
  ov(ctx, 3, 21 + by, 4, 3, d, K);
  ov(ctx, 17, 21 + by, 4, 3, d, K);
  // whiskers (tiny)
  ctx.fillStyle = l;
  ctx.fillRect(5, 11 + by, 3, 1);
  ctx.fillRect(16, 11 + by, 3, 1);
  drawMouth(ctx, 12, 11 + by, expr, K);
}

function drawCapybara(ctx: Ctx, pal: Pal, by: number, blink: boolean, expr: Expression) {
  const { p, d, l, b, K, a } = pal;
  // herbs on top of head
  ctx.fillStyle = a;
  ctx.fillRect(9, 0 + by, 1, 2);
  ctx.fillRect(12, 0 + by, 1, 3);
  ctx.fillRect(15, 0 + by, 1, 2);
  ctx.fillRect(8, 0 + by, 2, 1);
  ctx.fillRect(11, 0 + by, 2, 1);
  ctx.fillRect(14, 0 + by, 2, 1);
  // wide flat rectangular head
  rf(ctx, 4, 1 + by, 16, 1, K);
  rf(ctx, 3, 2 + by, 18, 1, K);
  rf(ctx, 3, 2 + by, 16, 7, p);
  rf(ctx, 3, 8 + by, 18, 1, K);
  rf(ctx, 4, 9 + by, 16, 1, K);
  // head fill
  rf(ctx, 4, 3 + by, 14, 5, p);
  // head highlight
  rf(ctx, 6, 3 + by, 8, 3, l);
  // snout (flat, wide)
  rf(ctx, 5, 7 + by, 12, 3, d);
  // nostrils
  ctx.fillStyle = K;
  ctx.fillRect(8, 8 + by, 1, 1);
  ctx.fillRect(14, 8 + by, 1, 1);
  // eyes (wide set, small)
  px_eye(ctx, 6, 3 + by, b, K, blink);
  px_eye(ctx, 16, 3 + by, b, K, blink);
  // body (barrel-shaped)
  ov(ctx, 3, 10 + by, 18, 10, p, K);
  ov(ctx, 5, 12 + by, 14, 7, l, 'transparent');
  // legs (short)
  ov(ctx, 4, 19 + by, 5, 4, d, K);
  ov(ctx, 15, 19 + by, 5, 4, d, K);
  ov(ctx, 5, 21 + by, 4, 3, d, K);
  ov(ctx, 14, 21 + by, 4, 3, d, K);
  drawMouth(ctx, 11, 10 + by, expr, K);
}

// ── Hat overlays ──────────────────────────────────────────────────────────────

function drawHat(ctx: Ctx, hat: string, by: number) {
  switch (hat) {
    case 'wizard':
      // tall pointy hat
      ctx.fillStyle = '#6040C0';
      ctx.fillRect(10, 0 + by, 4, 1);
      ctx.fillRect(9, 1 + by, 6, 1);
      ctx.fillRect(8, 2 + by, 8, 1);
      ctx.fillRect(7, 3 + by, 10, 2);
      ctx.fillRect(5, 5 + by, 14, 2);
      ctx.fillStyle = '#2A1880';
      ctx.fillRect(5, 6 + by, 14, 1);
      ctx.fillStyle = '#FFD840';
      ctx.fillRect(11, 2 + by, 2, 1);
      ctx.fillRect(10, 4 + by, 1, 1);
      ctx.fillRect(14, 3 + by, 1, 1);
      break;
    case 'cowboy':
      // wide brim + crown
      ctx.fillStyle = '#8B5A2B';
      ctx.fillRect(3, 4 + by, 18, 1);
      ctx.fillRect(6, 2 + by, 12, 4);
      ctx.fillStyle = '#5C3A1A';
      ctx.fillRect(6, 5 + by, 12, 1);
      ctx.fillRect(3, 4 + by, 3, 1);
      ctx.fillRect(18, 4 + by, 3, 1);
      ctx.fillStyle = '#FFD080';
      ctx.fillRect(7, 3 + by, 3, 1);
      break;
    case 'crown':
      // golden crown with 3 points
      ctx.fillStyle = '#FFD840';
      ctx.fillRect(6, 4 + by, 12, 3);
      ctx.fillRect(6, 2 + by, 2, 3);
      ctx.fillRect(11, 1 + by, 2, 4);
      ctx.fillRect(16, 2 + by, 2, 3);
      ctx.fillStyle = '#FFA020';
      ctx.fillRect(6, 6 + by, 12, 1);
      ctx.fillStyle = '#FF4040';
      ctx.fillRect(8, 4 + by, 1, 1);
      ctx.fillRect(12, 4 + by, 1, 1);
      ctx.fillRect(16, 4 + by, 1, 1);
      break;
    case 'party':
      // cone party hat
      ctx.fillStyle = '#FF40C0';
      ctx.fillRect(11, 0 + by, 2, 1);
      ctx.fillRect(10, 1 + by, 4, 1);
      ctx.fillRect(9, 2 + by, 6, 1);
      ctx.fillRect(8, 3 + by, 8, 1);
      ctx.fillRect(7, 4 + by, 10, 1);
      ctx.fillRect(6, 5 + by, 12, 1);
      ctx.fillStyle = '#FFD840';
      ctx.fillRect(11, 1 + by, 1, 1);
      ctx.fillRect(9, 3 + by, 1, 1);
      ctx.fillRect(14, 4 + by, 1, 1);
      break;
    case 'chef':
      // tall white chef hat
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(8, 0 + by, 8, 1);
      ctx.fillRect(7, 1 + by, 10, 2);
      ctx.fillRect(8, 3 + by, 8, 3);
      ctx.fillRect(6, 6 + by, 12, 1);
      ctx.fillStyle = '#DDDDDD';
      ctx.fillRect(7, 1 + by, 1, 5);
      ctx.fillRect(16, 1 + by, 1, 5);
      ctx.fillStyle = '#101010';
      ctx.fillRect(6, 6 + by, 12, 1);
      break;
    case 'top':
      // top hat
      ctx.fillStyle = '#181818';
      ctx.fillRect(4, 5 + by, 16, 1);
      ctx.fillRect(7, 1 + by, 10, 5);
      ctx.fillStyle = '#383838';
      ctx.fillRect(8, 2 + by, 8, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 5 + by, 10, 1);
      break;
    case 'flower':
      // flower crown
      ctx.fillStyle = '#FF70A0';
      ctx.fillRect(5, 3 + by, 2, 2);
      ctx.fillRect(10, 2 + by, 2, 2);
      ctx.fillRect(16, 3 + by, 2, 2);
      ctx.fillStyle = '#FFD840';
      ctx.fillRect(5, 3 + by, 1, 1);
      ctx.fillRect(10, 2 + by, 1, 1);
      ctx.fillRect(16, 3 + by, 1, 1);
      ctx.fillStyle = '#60B060';
      ctx.fillRect(7, 4 + by, 3, 1);
      ctx.fillRect(12, 3 + by, 4, 1);
      break;
    case 'halo':
      // golden halo ring
      ctx.fillStyle = '#FFD840';
      ctx.fillRect(8, 0 + by, 8, 1);
      ctx.fillRect(6, 1 + by, 12, 1);
      ctx.fillRect(5, 2 + by, 2, 1);
      ctx.fillRect(17, 2 + by, 2, 1);
      ctx.fillStyle = '#FFF0A0';
      ctx.fillRect(9, 0 + by, 6, 1);
      break;
    default:
      break;
  }
}

// ── Shiny shimmer overlay ─────────────────────────────────────────────────────

function applyShimmer(ctx: Ctx, frame: number) {
  const shimmerColors = [
    'rgba(255, 200, 255, 0.35)',
    'rgba(200, 255, 255, 0.35)',
    'rgba(255, 255, 200, 0.35)',
  ];
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = shimmerColors[frame % shimmerColors.length];
  ctx.fillRect(0, 0, 24, 24);
  ctx.globalCompositeOperation = 'source-over';
  // sparkles
  ctx.fillStyle = '#FFFFFF';
  const sparkPositions = [[3, 3], [20, 5], [5, 18], [19, 20], [12, 2]];
  const sparkIdx = frame % sparkPositions.length;
  const [sx, sy] = sparkPositions[sparkIdx];
  ctx.fillRect(sx, sy, 1, 1);
  ctx.fillRect(sx + 1, sy - 1, 1, 1);
  ctx.fillRect(sx - 1, sy + 1, 1, 1);
}

// ── Species dispatch ──────────────────────────────────────────────────────────

function drawSpecies(
  ctx: Ctx,
  species: string,
  pal: Pal,
  by: number,
  blink: boolean,
  expr: Expression
) {
  switch (species) {
    case 'duck':     drawDuck(ctx, pal, by, blink, expr); break;
    case 'goose':    drawGoose(ctx, pal, by, blink, expr); break;
    case 'cat':      drawCat(ctx, pal, by, blink, expr); break;
    case 'rabbit':   drawRabbit(ctx, pal, by, blink, expr); break;
    case 'owl':      drawOwl(ctx, pal, by, blink, expr); break;
    case 'penguin':  drawPenguin(ctx, pal, by, blink, expr); break;
    case 'turtle':   drawTurtle(ctx, pal, by, blink, expr); break;
    case 'snail':    drawSnail(ctx, pal, by, blink, expr); break;
    case 'dragon':   drawDragon(ctx, pal, by, blink, expr); break;
    case 'octopus':  drawOctopus(ctx, pal, by, blink, expr); break;
    case 'axolotl':  drawAxolotl(ctx, pal, by, blink, expr); break;
    case 'ghost':    drawGhost(ctx, pal, by, blink, expr); break;
    case 'robot':    drawRobot(ctx, pal, by, blink, expr); break;
    case 'blob':     drawBlob(ctx, pal, by, blink, expr); break;
    case 'cactus':   drawCactus(ctx, pal, by, blink, expr); break;
    case 'mushroom': drawMushroom(ctx, pal, by, blink, expr); break;
    case 'chonk':    drawChonk(ctx, pal, by, blink, expr); break;
    case 'capybara': drawCapybara(ctx, pal, by, blink, expr); break;
    default:         drawBlob(ctx, pal, by, blink, expr); break;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BuddySprite({
  bones,
  frame = 0,
  size = 128,
  expression = 'happy',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 24, 24);

    const { species, isShiny, hat } = bones;
    const pal = PALS[species] ?? PALS['blob'];

    // frame semantics: 0=neutral, 1=bob up, 2=bob down + blink
    const bobY = frame === 1 ? -1 : frame === 2 ? 1 : 0;
    const blink = frame === 2;

    // draw species
    drawSpecies(ctx, species, pal, bobY, blink, expression);

    // draw hat on top
    if (hat && hat !== 'none') {
      drawHat(ctx, hat, bobY);
    }

    // shiny shimmer
    if (isShiny) {
      applyShimmer(ctx, frame);
    }
  }, [bones, frame, expression]);

  return (
    <div style={{ display: 'inline-block', imageRendering: 'pixelated', lineHeight: 0 }}>
      <canvas
        ref={canvasRef}
        width={24}
        height={24}
        style={{
          width: size,
          height: size,
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />
    </div>
  );
}
