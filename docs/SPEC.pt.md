# buddy.land

Seu Buddy do Claude Code, fora do terminal.
Pixel art animada, mundo interativo, conversa real com o seu pet.

Roda local com `bunx buddy-land` → abre em `http://localhost:7892`

---

## O que é

O Claude Code tem um sistema de pets chamado `/buddy` — lançado em 01/04/2026.
Cada usuário tem um pet único gerado deterministicamente a partir do seu `userId`.
O pet existe só no terminal, em ASCII, sem interação rica e sem evolução.

O **buddy.land** resolve isso: lê os dados do buddy diretamente dos arquivos locais
do Claude Code, renderiza o pet em pixel art animada, e permite conversar, brincar
e ver o pet evoluir com base no uso real do Claude Code.

---

## Stack obrigatória

- **Runtime:** Bun
- **Server:** Bun HTTP nativo na porta `7892`
- **Frontend:** React + Vite
- **Renderização:** Canvas 2D para pixel art animada
- **Chat:** Anthropic SDK (claude-haiku-4-5 — barato, rápido, divertido)
- **Sem banco de dados** — fonte da verdade são os arquivos locais do Claude Code

---

## Como o Buddy é gerado — o algoritmo completo

O Claude Code gera o pet via dois sistemas: **Bones** (aparência) e **Soul** (personalidade).

### Bones — geração determinística

```typescript
// Seed: userId + 'friend-2026-401'
// PRNG: Mulberry32

function mulberry32(seed: number) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function hashString(str: string): number {
  // FNV-1a 32-bit
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
}

function generateBones(userId: string) {
  const seed = hashString(userId + 'friend-2026-401');
  const rand = mulberry32(seed);

  // Espécies (18 total) com pesos de raridade
  const SPECIES = [
    'duck', 'goose', 'cat', 'rabbit', 'owl', 'penguin',
    'turtle', 'snail', 'dragon', 'octopus', 'axolotl',
    'ghost', 'robot', 'blob', 'cactus', 'mushroom', 'chonk', 'capybara'
  ];

  // Raridade
  const RARITIES = [
    { name: 'common',    weight: 0.50 },
    { name: 'uncommon',  weight: 0.25 },
    { name: 'rare',      weight: 0.15 },
    { name: 'epic',      weight: 0.08 },
    { name: 'legendary', weight: 0.02 },
  ];

  // Olhos
  const EYES = ['·', 'o', '•', '◉', '◎', '✦', '⊙', '◦', '◈', '◉'];

  // Chapéus
  const HATS = ['none', 'wizard', 'cowboy', 'crown', 'party', 'chef', 'top', 'flower', 'halo'];

  // Selecionar raridade por peso acumulado
  const rarityRoll = rand();
  let cumulative = 0;
  let rarity = RARITIES[0].name;
  for (const r of RARITIES) {
    cumulative += r.weight;
    if (rarityRoll < cumulative) { rarity = r.name; break; }
  }

  // Espécie baseada na raridade
  const speciesIndex = Math.floor(rand() * SPECIES.length);

  // Stats (DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK) — somam ~250
  const stats = {
    debugging: Math.floor(rand() * 100),
    patience:  Math.floor(rand() * 100),
    chaos:     Math.floor(rand() * 100),
    wisdom:    Math.floor(rand() * 100),
    snark:     Math.floor(rand() * 100),
  };

  // Peak e Valley
  const statEntries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  const peak  = statEntries[0][0];
  const valley = statEntries[statEntries.length - 1][0];

  // Shiny (1% de chance)
  const isShiny = rand() < 0.01;

  // Eye e Hat
  const eyeIndex = Math.floor(rand() * EYES.length);
  const hatIndex = Math.floor(rand() * HATS.length);

  return {
    species:  SPECIES[speciesIndex],
    rarity,
    stats,
    peak,
    valley,
    isShiny,
    eye:      EYES[eyeIndex],
    hat:      HATS[hatIndex],
  };
}
```

### Soul — leitura do ~/.claude.json

```typescript
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface BuddySoul {
  name: string;
  personality: string;
}

function readSoul(): BuddySoul | null {
  const path = join(homedir(), '.claude.json');
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    // A soul fica em raw.companion ou raw.buddy — verificar ambos
    const companion = raw.companion ?? raw.buddy;
    if (!companion?.name) return null;
    return {
      name: companion.name,
      personality: companion.personality ?? '',
    };
  } catch { return null; }
}
```

### userId — leitura do ~/.claude.json

```typescript
function readUserId(): string | null {
  const path = join(homedir(), '.claude.json');
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    return raw.userId ?? raw.oauthAccount?.id ?? null;
  } catch { return null; }
}
```

---

## Estrutura de arquivos

```
buddy-land/
├── server/
│   ├── index.ts          # Bun HTTP server + WebSocket
│   ├── buddy.ts          # generateBones() + readSoul() + readUserId()
│   ├── sessions.ts       # lê logs JSONL → XP e stats reais
│   ├── chat.ts           # proxy Anthropic API com soul como system prompt
│   └── sprites.ts        # definição dos sprites pixel art por espécie
├── client/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Garden.tsx    # mundo principal com o pet
│   │   │   ├── Chat.tsx      # conversa com o pet
│   │   │   └── Stats.tsx     # ficha RPG
│   │   ├── components/
│   │   │   ├── BuddySprite.tsx   # renderizador canvas pixel art
│   │   │   ├── SpeechBubble.tsx  # fala do pet
│   │   │   ├── RarityBadge.tsx   # badge de raridade
│   │   │   └── StatBar.tsx       # barra de stat com animação
│   │   └── hooks/
│   │       ├── useBuddy.ts       # lê buddy do servidor
│   │       └── useChat.ts        # estado do chat
│   └── index.html
├── package.json
└── CLAUDE.md
```

---

## API do servidor

```
GET  /api/buddy          → { bones, soul, xp, level, sessionCount }
GET  /api/sessions       → { today: number, total: number, streak: number }
POST /api/chat           → { message } → stream de resposta do pet
WS   /ws/mood            → stream de reações do pet a eventos do sistema
```

---

## Sistema de XP e evolução

O buddy.land lê os logs JSONL de sessão do Claude Code:

```typescript
// Localização dos logs de sessão
const SESSION_LOGS_DIR = join(homedir(), '.claude', 'projects');

function calculateXP(): number {
  // Cada token ≈ 0.001 XP
  // Cada sessão completa = +50 XP bônus
  // Streak diário = multiplicador 1.0x → 2.0x (máximo 7 dias)
}
```

**Tiers de evolução:**
```
Hatchling  →  0 XP        sprite base, sem adornos
Juvenile   →  100K XP     marcadores de energia nos cantos do sprite
Adult      →  1M XP       padrão de overlay específico da espécie
Elder      →  10M XP      efeito de partículas permanente
Ancient    →  100M XP     aura animada + paleta de cores alterada
```

O nível e XP ficam em `~/.buddy-land/progress.json` — gerenciado pelo servidor.

---

## Pixel art — sprites por espécie

Cada espécie tem:
- **Sprite base**: grid 32×32 pixels com paleta de 8 cores
- **3 frames de animação idle**: piscar, mexer levemente, "respirar"
- **Overlay de olho**: posicionado dinamicamente sobre o sprite base
- **Overlay de chapéu**: posicionado no topo do sprite
- **Variante shiny**: paleta alterada com efeito de shimmer iridescente

### Definição de paleta por espécie

```typescript
const SPECIES_PALETTES: Record<string, string[]> = {
  duck:     ['#F5D06E', '#E8B84B', '#4A9EDB', '#FFFFFF', '#2C2C2A', '#FF8C42'],
  capybara: ['#C4956A', '#A67C52', '#8B5E3C', '#D4B896', '#2C2C2A', '#7FB069'],
  dragon:   ['#8B4FFF', '#6B3FCC', '#FF4F8B', '#FFDD57', '#2C2C2A', '#4FFFB0'],
  ghost:    ['#E8E8F0', '#C8C8D8', '#9898B8', '#FFFFFF', '#4848A8', '#FF6B9D'],
  robot:    ['#8888A8', '#6868A0', '#4848A8', '#C8D8FF', '#2C2C2A', '#00FF88'],
  blob:     ['#7FE4B0', '#5FD49A', '#3FC484', '#AFFFC8', '#2C2C2A', '#FF7F7F'],
  // ... todas as 18 espécies
};
```

### Renderização no Canvas

```typescript
// BuddySprite.tsx — componente React com Canvas
function BuddySprite({ species, eye, hat, isShiny, frame, level }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false; // pixel art — sem suavização
    ctx.clearRect(0, 0, 64, 64);      // canvas 64×64 (2x scale)

    // 1. Desenhar sprite base com paleta da espécie
    drawBaseSprite(ctx, species, frame);

    // 2. Se shiny, aplicar shimmer
    if (isShiny) applyShimmerEffect(ctx, frame);

    // 3. Overlay de olho
    drawEyeOverlay(ctx, species, eye);

    // 4. Overlay de chapéu
    if (hat !== 'none') drawHatOverlay(ctx, species, hat);

    // 5. Se level >= Juvenile, marcadores de energia nos cantos
    if (level >= 2) drawEnergyMarkers(ctx, level);

    // 6. Partículas se Elder+
    if (level >= 4) drawParticles(ctx, frame);

  }, [species, eye, hat, isShiny, frame, level]);

  return <canvas ref={canvasRef} width={64} height={64} style={{ imageRendering: 'pixelated' }} />;
}
```

### Loop de animação

```typescript
// No Garden.tsx — loop de 60fps com frame cycling
useEffect(() => {
  let frame = 0;
  const IDLE_FRAMES = 3;
  const FRAME_DURATION = 400; // ms por frame

  const interval = setInterval(() => {
    frame = (frame + 1) % IDLE_FRAMES;
    setCurrentFrame(frame);
  }, FRAME_DURATION);

  return () => clearInterval(interval);
}, []);
```

---

## O jardim — Garden.tsx

Um ambiente 2D com parallax simples onde o pet vive.

**Elementos visuais:**
- Background em pixel art: grama, céu, nuvens flutuando
- O pet anda/caminha pelo jardim quando idle (path aleatório)
- Quando você clica no pet: para, olha pra você, speech bubble aparece
- Itens colecionáveis no jardim: flores, estrelas, borboletas (aumentam humor)
- Dia/noite baseado no horário real do sistema

**Interações:**
- **Clique no pet** → abre chat inline com speech bubble
- **Duplo clique** → ação "pet" (o pet faz animação de felicidade)
- **Tecla [S]** → abre ficha de stats
- **Tecla [C]** → abre chat fullscreen

---

## Chat com o pet — system prompt dinâmico

O chat usa `claude-haiku-4-5` com o system prompt construído dinamicamente:

```typescript
function buildSystemPrompt(soul: BuddySoul, bones: Bones, sessions: SessionData): string {
  return `You are ${soul.name}, a ${bones.rarity} ${bones.species} companion.

Your personality: ${soul.personality}

Your stats:
- DEBUGGING: ${bones.stats.debugging}/100 ${bones.peak === 'debugging' ? '(your best!)' : ''}
- PATIENCE: ${bones.stats.patience}/100
- CHAOS: ${bones.stats.chaos}/100 ${bones.peak === 'chaos' ? '(your best!)' : ''}
- WISDOM: ${bones.stats.wisdom}/100
- SNARK: ${bones.stats.snark}/100 ${bones.peak === 'snark' ? '(your best!)' : ''}

Your user has coded for ${sessions.total} sessions total and ${sessions.today} sessions today.
Their streak is ${sessions.streak} days.

You are a small, expressive companion. You speak in short, playful messages (1-3 sentences max).
You react to your stats — high CHAOS means chaotic energy, high SNARK means witty comments,
high WISDOM means thoughtful observations. You care deeply about your user's coding journey.
You occasionally make references to being a ${bones.species} in a funny way.
${bones.isShiny ? 'You know you are special — you are shiny and you are not shy about it.' : ''}
You are NOT Claude the AI assistant. You are ${soul.name}, a distinct personality.
Never break character. Never mention Anthropic or Claude Code directly.
Keep responses SHORT and EXPRESSIVE. Use 1-2 emojis max per message.`;
}
```

**Reações automáticas** (via WebSocket mood stream):
- Detecta quando um novo arquivo foi editado → reage com comentário
- Detecta sessão nova iniciada → boas-vindas
- Detecta hora tarde da noite → "vai dormir..."
- Detecta fim de semana → energia diferente

---

## Tela de Stats — Stats.tsx

Ficha de RPG visual com:
- **Nome e espécie** com badge de raridade animado
- **Barras de stat** com animação de preenchimento ao abrir
- **Peak e Valley** destacados com ícones
- **Badge shiny** com efeito iridescente se aplicável
- **Progresso de XP** para próximo tier de evolução
- **Histórico** — gráfico de sessões por dia (últimos 7 dias)
- **Conquistas** — primeiro dia, 100 sessões, streak de 7 dias, etc.

---

## Efeito shiny

Pets shiny (1% de chance) têm efeito especial no canvas:

```typescript
function applyShimmerEffect(ctx: CanvasRenderingContext2D, frame: number) {
  // Overlay iridescente que cicla por 3 paletas de cores
  const shimmerColors = [
    'rgba(255, 200, 255, 0.3)',
    'rgba(200, 255, 255, 0.3)',
    'rgba(255, 255, 200, 0.3)',
  ];
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = shimmerColors[frame % shimmerColors.length];
  ctx.fillRect(0, 0, 64, 64);
  ctx.globalCompositeOperation = 'source-over';

  // Partículas de sparkle nos cantos
  drawSparkles(ctx, frame);
}
```

---

## Como rodar

```bash
# Opção 1: zero install
bunx buddy-land

# Opção 2: instalar globalmente
bun install -g buddy-land
buddy-land

# Opção 3: clonar e rodar
git clone https://github.com/blpsoares/buddy-land
cd buddy-land
bun install
bun run dev
```

Abre automaticamente `http://localhost:7892` no browser padrão.

---

## O que fazer se ~/.claude.json não existir

Se o usuário não tiver rodado `/buddy` ainda no Claude Code:

1. Mostrar uma tela de "seu buddy ainda não nasceu"
2. Instruir: "abra o Claude Code e rode `/buddy` para criar seu companheiro"
3. Polling a cada 5 segundos — assim que detectar o arquivo, transição animada para o jardim

---

## Estado do humor (mood)

O pet tem um estado de humor que muda com o tempo:

```typescript
type Mood = 'happy' | 'excited' | 'tired' | 'bored' | 'focused' | 'chaotic';

function calculateMood(sessions: SessionData, bones: Bones): Mood {
  const hour = new Date().getHours();
  const isLateNight = hour >= 23 || hour <= 5;
  const isWeekend = [0, 6].includes(new Date().getDay());

  if (isLateNight && sessions.today > 0) return 'tired';
  if (sessions.streak >= 7) return 'excited';
  if (sessions.today === 0) return 'bored';
  if (bones.stats.chaos > 80) return 'chaotic';
  if (bones.stats.debugging > 80 && sessions.today > 2) return 'focused';
  return 'happy';
}
```

O mood afeta:
- Velocidade de movimento do pet no jardim
- Expressão facial (overlay de olho)
- Tom das respostas no chat (injetado no system prompt)
- Animação de idle (mais acelerada se excited, mais lenta se tired)

---

## Ambiente visual por período do dia

```typescript
function getTimeOfDay(): 'dawn' | 'day' | 'dusk' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8)   return 'dawn';
  if (hour >= 8 && hour < 18)  return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
}
```

Cada período tem paleta de cores diferente no background do jardim,
estrelas à noite, aurora ao amanhecer, tons quentes ao entardecer.

---

## Detalhes de implementação importantes

### imageRendering: pixelated é obrigatório
Todo elemento canvas e img relacionado ao pet deve ter:
```css
image-rendering: pixelated;
image-rendering: crisp-edges; /* fallback */
```
Sem isso os sprites ficam borrados quando escalonados.

### Canvas scale para telas retina
```typescript
const dpr = window.devicePixelRatio || 1;
canvas.width  = SPRITE_SIZE * dpr;
canvas.height = SPRITE_SIZE * dpr;
canvas.style.width  = `${SPRITE_SIZE}px`;
canvas.style.height = `${SPRITE_SIZE}px`;
ctx.scale(dpr, dpr);
```

### O chat NÃO deve usar o userId do Claude Code
O ANTHROPIC_API_KEY deve ser pedido ao usuário na primeira abertura
e guardado em `~/.buddy-land/config.json`. Nunca usar a sessão do Claude Code.

### Polling de arquivos (não fs.watch)
Para detectar mudanças no `~/.claude.json` e nos logs de sessão,
usar polling a cada 10s em vez de `fs.watch` — mais estável no WSL/Windows.

---

## Design visual da interface

A interface ao redor do jardim deve ser:
- **Tema**: fantasia leve, pixel art, cores vibrantes mas não saturadas demais
- **Fonte**: pixel font para elementos de UI do pet (nome, stats), sans-serif moderna para chat
- **Bordas**: pixel-perfect, sem border-radius suavizado nos elementos de UI do pet
- **Fundo do jardim**: tile-based, 16×16 tiles, scrolling parallax leve
- **HUD mínimo**: nome do pet + raridade no canto superior, humor no canto inferior

O jardim deve parecer um jogo — não um dashboard.

---

## Roadmap

| Versão | Scope |
|---|---|
| v0.1 | Lê ~/.claude.json, gera bones, renderiza sprite no canvas, mostra nome e raridade |
| v0.2 | Animação idle 3 frames, jardim básico com grama, pet se move |
| v0.3 | Chat funcional com Anthropic API usando soul como system prompt |
| v0.4 | Lê logs de sessão → XP, stats page, progresso de evolução |
| v0.5 | Mood system, variação dia/noite, reações automáticas via WebSocket |
| v1.0 | Todos os 18 sprites completos, shiny effect, conquistas, polish geral |
