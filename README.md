# buddy.land 🌱

Seu Buddy do Claude Code, fora do terminal.  
Pixel art animada, mundo interativo, conversa real com o seu companheiro.

```bash
bunx buddy-land
# abre em http://localhost:7892
```

---

## O que é

O Claude Code tem um sistema de pets chamado `/buddy`. Cada usuário tem um companheiro único gerado deterministicamente a partir do seu `userId` — mas ele existe só no terminal, em ASCII, sem interação rica.

O **buddy.land** resolve isso: lê os dados do buddy diretamente dos arquivos locais do Claude Code, renderiza o pet em pixel art animada estilo Stardew Valley, e permite conversar, brincar e ver o pet evoluir com base no seu uso real do Claude Code.

---

## Features

- **18 espécies** com sprites pixel art únicos — duck, goose, cat, rabbit, owl, penguin, turtle, snail, dragon, octopus, axolotl, ghost, robot, blob, cactus, mushroom, chonk, capybara
- **Jardim interativo** com cenários temáticos por espécie e parallax leve
- **Background SVG animado** para o dragão: castelo medieval com estrelas twinkle, morcegos voando, lua crescente, tochas piscando e janelas que pulsam
- **Chat real** com o pet via Anthropic API (`claude-haiku-4-5`), com personalidade dinâmica baseada nos stats e histórico de sessões
- **Sistema de XP e evolução** (Hatchling → Juvenile → Adult → Elder → Ancient) lendo logs de sessão do Claude Code
- **Sistema de humor** (happy, excited, tired, bored, focused, chaotic) que afeta animação, expressão facial e tom do chat
- **Efeito shiny** (1% de chance) com shimmer iridescente
- **8 tipos de chapéu** em pixel art (wizard, cowboy, crown, party, chef, top, flower, halo)
- **Página de stats** estilo ficha RPG com barras animadas, streak e progresso de XP

---

## Como rodar

**Pré-requisito:** [Bun](https://bun.sh) instalado.

```bash
# Opção 1: zero install
bunx buddy-land

# Opção 2: clonar e rodar
git clone https://github.com/blpsoares/buddyGarden.git
cd buddyGarden
bun install
bun run dev
```

Na primeira abertura você será solicitado a informar sua `ANTHROPIC_API_KEY` (guardada localmente em `~/.buddy-land/config.json`).

Se você ainda não rodou `/buddy` no Claude Code, o jardim exibe uma tela de espera e detecta automaticamente quando o companheiro for criado.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Bun |
| Servidor | Bun HTTP nativo + WebSocket |
| Frontend | React + Vite |
| Renderização | Canvas 2D com `imageRendering: pixelated` |
| Chat | Anthropic SDK (`claude-haiku-4-5`) |
| Dados | Arquivos locais do Claude Code (sem banco de dados) |

---

## Como o Buddy é gerado

### Aparência — Bones

Gerada deterministicamente a partir do `userId` com PRNG Mulberry32 e hash FNV-1a:

```
seed = FNV-1a(userId + 'friend-2026-401')
rand = Mulberry32(seed)
```

Atributos sorteados:
- **Espécie** — 18 opções
- **Raridade** — common 50% / uncommon 25% / rare 15% / epic 8% / legendary 2%
- **Stats** — DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK (0–100 cada)
- **Shiny** — 1% de chance
- **Eye & Hat** — selecionados do pool

### Personalidade — Soul

Lida de `~/.claude.json` (campos `companion.name` e `companion.personality`), injetada como system prompt no chat.

---

## Estrutura do projeto

```
buddyGarden/
├── server/
│   ├── index.ts              # Bun HTTP server + WebSocket mood stream
│   ├── buddy.ts              # generateBones() + readSoul() + readUserId()
│   ├── sessions.ts           # lê logs JSONL → XP, streak, contagem
│   ├── chat.ts               # proxy Anthropic com system prompt dinâmico
│   └── sprites.ts            # metadados de sprites por espécie
├── client/src/
│   ├── pages/
│   │   ├── Garden.tsx        # jardim com 18 cenários e idle walk
│   │   ├── Chat.tsx          # chat fullscreen
│   │   └── Stats.tsx         # ficha RPG com barras animadas
│   ├── components/
│   │   ├── BuddySprite.tsx   # canvas pixel art (18 espécies, 3-frame idle)
│   │   ├── SpeechBubble.tsx
│   │   ├── RarityBadge.tsx
│   │   └── StatBar.tsx
│   ├── sprites/
│   │   ├── Dragon.tsx        # DragonBody SVG de alta fidelidade
│   │   └── index.tsx         # registro de sprites por espécie
│   ├── backgrounds/
│   │   └── DragonBackground.tsx  # background SVG animado (castelo noturno)
│   ├── context/
│   │   └── ChatContext.tsx   # estado de chat compartilhado entre páginas
│   ├── hooks/
│   │   ├── useBuddy.ts
│   │   └── useChat.ts
│   └── utils/
│       └── color.ts          # darken / lighten / shiftHue
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## API

```
GET  /api/buddy      → { bones, soul, xp, level, sessionCount }
GET  /api/sessions   → { today, total, streak }
POST /api/chat       → stream de texto (resposta do pet)
WS   /ws/mood        → stream de eventos de humor em tempo real
```

---

## Sistema de XP e evolução

| Tier | XP mínimo | Visual |
|------|-----------|--------|
| Hatchling | 0 | sprite base |
| Juvenile | 100.000 | marcadores de energia nos cantos |
| Adult | 1.000.000 | overlay exclusivo da espécie |
| Elder | 10.000.000 | efeito de partículas permanente |
| Ancient | 100.000.000 | aura animada + paleta alterada |

XP calculado a partir dos logs JSONL em `~/.claude/projects/`. Cada token ≈ 0,001 XP, cada sessão completa = +50 XP, streak diário multiplica até 2×.

---

## Licença

MIT
