# buddy.land

Seu Buddy do Claude Code, fora do terminal.  
Pixel art animada, mundo interativo, conversa real com o seu companheiro.

```bash
bunx buddy-land
# abre em http://localhost:7892
```

---

## O que é

O Claude Code tem um sistema de pets chamado `/buddy`. Cada usuário tem um companheiro único gerado deterministicamente a partir do seu `userId` — mas ele existe só no terminal, em ASCII, sem interação rica.

O **buddy.land** resolve isso: lê os dados do buddy diretamente dos arquivos locais do Claude Code, renderiza o pet em pixel art animada, e permite conversar, brincar e ver o pet evoluir com base no seu uso real do Claude Code.

---

## Features

### Companheiro vivo
- **18 espécies** com sprites pixel art únicos — duck, goose, cat, rabbit, owl, penguin, turtle, snail, dragon, octopus, axolotl, ghost, robot, blob, cactus, mushroom, chonk, capybara
- **5 raridades** — common (50%), uncommon (25%), rare (15%), epic (8%), legendary (2%)
- **Geração determinística** — seu pet é sempre o mesmo, gerado a partir do seu `userId` com PRNG Mulberry32 + hash FNV-1a
- **Efeito shiny** (1% de chance) com shimmer iridescente no canvas
- **8 chapéus** em pixel art — wizard, cowboy, crown, party, chef, top, flower, halo
- **10 tipos de olho** — estilo pixel art

### Jardim interativo
- Cenários temáticos por espécie com parallax leve
- Background SVG animado para o dragão: castelo medieval, estrelas twinkle, morcegos, lua crescente, tochas piscando
- Pet caminha pelo jardim no idle, para e olha pra você no hover
- Ciclo de dia/noite baseado no horário real
- Menu de ações no clique — chat rápido, stats, playground

### Chat com personalidade
- **3 provedores** de IA — Anthropic (claude-haiku-4-5, sonnet-4-6, opus-4-6), Google Gemini, Claude Code CLI
- **System prompt dinâmico** com personalidade do pet (nome, espécie, raridade, stats, humor)
- **Contexto de projeto injetado** — o pet sabe o que você está codando (README, package.json, git status)
- **Streaming com typewriter** — animação fluida de texto
- **Compressão automática de histórico** — sliding window com resumo para não explodir o contexto
- **Execução de comandos** — o pet pode sugerir e executar comandos shell com aprovação do usuário
- **Histórico persistente** — conversas salvas em JSONL em `~/.buddy-garden/conversations/`
- **Fork para Claude Code** — exporta conversa como sessão real do Claude Code
- **Sessões Claude como contexto** — importa sessões do Claude Code como contexto interno
- Sidebar com accordion: seções PROJETOS e CONVERSAS colapsáveis
- Multi-pasta por conversa — seleciona múltiplos diretórios como contexto

### Sistema de XP e evolução
| Tier | XP mínimo | Visual |
|------|-----------|--------|
| Hatchling | 0 | sprite base |
| Juvenile | 100.000 | marcadores de energia nos cantos |
| Adult | 1.000.000 | overlay exclusivo da espécie |
| Elder | 10.000.000 | efeito de partículas permanente |
| Ancient | 100.000.000 | aura animada + paleta alterada |

XP calculado a partir dos logs JSONL em `~/.claude/projects/`. Cada token ≈ 0,001 XP, cada sessão = +50 XP, streak diário multiplica até 2×.

### Sistema de humor
| Mood | Condição |
|------|----------|
| happy | padrão |
| excited | streak ≥ 7 dias |
| tired | tarde da noite + sessões hoje |
| bored | zero sessões hoje |
| focused | DEBUGGING > 80 + mais de 2 sessões |
| chaotic | CHAOS > 80 |

Afeta velocidade de movimento, expressão facial, animação idle e tom das respostas.

### Stats e ficha RPG
- 5 stats — DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK (0–100)
- Peak e Valley destacados
- Barras animadas ao abrir
- Gráfico de atividade dos últimos 7 dias (separando sessões Claude vs Buddy)
- Progresso de XP para próximo tier
- Arquétipos gerados a partir dos stats dominantes
- Badge shiny com efeito iridescente

### Modo Buddy
- Interface estilo Pou — pet no centro com máquina de estados
- Ações: pet, alimentar, brincar, conversar
- Animações de reação a cada ação

### Playground
- Mini-jogos com o pet — pet, fetch, trick

---

## Como rodar

**Pré-requisito:** [Bun](https://bun.sh) instalado.

```bash
# Opção 1: zero install (em breve no npm)
bunx buddy-land

# Opção 2: clonar e rodar
git clone https://github.com/blpsoares/buddyGarden.git
cd buddyGarden
bun install
bun run dev
```

Abre em `http://localhost:7892` (servidor) + `http://localhost:5173` (Vite dev).

Na primeira abertura você será solicitado a informar sua `ANTHROPIC_API_KEY` — guardada localmente em `~/.buddy-land/config.json`. Nada é enviado para servidores externos além da API configurada.

Se você ainda não rodou `/buddy` no Claude Code, o jardim exibe uma tela de espera e detecta automaticamente quando o companheiro for criado (polling a cada 5s).

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Bun |
| Servidor | Bun HTTP nativo + WebSocket |
| Frontend | React 18 + Vite 6 |
| Renderização | Canvas 2D — `imageRendering: pixelated` |
| Chat | Anthropic SDK / Google Generative AI / Claude Code CLI |
| i18n | PT-BR + EN (170+ chaves) |
| Ícones | lucide-react |
| Testes | Bun test (unit) + Playwright (E2E) |
| Dados | Arquivos locais — sem banco de dados |

---

## Como o Buddy é gerado

### Aparência — Bones

Gerada deterministicamente a partir do `userId` com PRNG Mulberry32 e hash FNV-1a:

```
seed = FNV-1a(userId + 'friend-2026-401')
rand = Mulberry32(seed)
```

Atributos sorteados em sequência determinística:
- **Raridade** — por peso acumulado
- **Espécie** — índice no array de 18 espécies
- **Stats** — DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK (0–100 cada)
- **Shiny** — `rand() < 0.01`
- **Eye & Hat** — índice nos respectivos pools

### Personalidade — Soul

Lida de `~/.claude.json` nos campos `companion.name` e `companion.personality`, injetada como system prompt no chat. Se não existir, o pet usa um fallback genérico baseado na espécie.

---

## Estrutura do projeto

```
buddyGarden/
├── server/
│   ├── index.ts              # Bun HTTP server (7892) + WebSocket /ws/mood
│   ├── buddy.ts              # generateBones() + readSoul() + readUserId()
│   ├── sessions.ts           # logs JSONL → XP, streak, contagem, last7Days
│   ├── chat.ts               # streaming multi-provider + system prompt dinâmico
│   ├── conversations.ts      # CRUD conversas em JSONL + index.json
│   ├── claude-sessions.ts    # leitura de sessões do Claude Code (~/.claude/)
│   ├── sprites.ts            # metadados de sprites por espécie (paletas, frames)
│   └── project-context.ts   # extrai contexto de projeto para injetar no chat
├── client/src/
│   ├── App.tsx               # roteamento de páginas + nav + settings
│   ├── i18n.ts               # traduções PT/EN
│   ├── context/
│   │   └── ChatContext.tsx   # estado global de chat (streaming, conversas, provider)
│   ├── pages/
│   │   ├── Garden.tsx        # jardim com 18 cenários, idle walk, menu de clique
│   │   ├── Chat.tsx          # chat fullscreen com sidebar e seleção de contexto
│   │   ├── Stats.tsx         # ficha RPG com gráfico de atividade e arquétipos
│   │   ├── BuddyMode.tsx     # modo Pou-like com máquina de estados
│   │   └── PlayMode.tsx      # mini-jogos
│   ├── components/
│   │   ├── BuddySprite.tsx   # canvas pixel art (18 espécies, 3-frame idle, shiny)
│   │   ├── DragonBuddy.tsx   # sprite dragon com SVG de alta fidelidade
│   │   ├── SpeechBubble.tsx  # balão de fala do pet
│   │   ├── RarityBadge.tsx   # badge de raridade animado
│   │   ├── StatBar.tsx       # barra de stat com animação de preenchimento
│   │   ├── MarkdownRenderer.tsx # markdown → JSX para respostas do chat
│   │   ├── ProjectPicker.tsx # seletor de diretórios com checkbox multi-pasta
│   │   ├── PermissionDialog.tsx # diálogo de aprovação de comandos shell
│   │   └── PixelLoader.tsx   # loading animado estilo pixel art
│   ├── sprites/
│   │   ├── Dragon.tsx        # DragonBody SVG com animações walk/idle/sleep
│   │   └── index.tsx         # registro de sprites por espécie
│   ├── backgrounds/
│   │   └── DragonBackground.tsx  # background SVG animado (castelo noturno)
│   ├── hooks/
│   │   ├── useBuddy.ts       # fetch e polling do buddy
│   │   ├── useChat.ts        # wrapper do ChatContext
│   │   ├── useBreakpoint.ts  # detecção mobile/desktop
│   │   ├── useSpriteAnimation.ts # timing de frames
│   │   ├── useLoadAtlas.ts   # pré-carregamento de atlas
│   │   └── useT.ts           # shorthand de tradução
│   └── utils/
│       └── color.ts          # darken / lighten / shiftHue
├── tests/
│   ├── buddy.test.ts         # unit: generateBones, detectSpecies
│   ├── sessions.test.ts      # unit: XP, streak, last7Days
│   ├── conversations.test.ts # unit: CRUD conversas
│   ├── i18n.test.ts          # unit: traduções PT/EN
│   ├── chat.test.ts          # unit: buildSystemPrompt, compressHistory
│   └── *.spec.ts             # E2E Playwright: navegação, garden, chat, stats, etc.
├── cli/
│   └── chat.ts               # CLI de chat direto (sem UI)
├── public/
│   └── favicon.ico
├── package.json
├── vite.config.ts
├── playwright.config.ts
└── tsconfig.json
```

---

## API

```
GET  /api/buddy                          → { bones, soul, xp, level, sessionCount }
GET  /api/sessions                       → { today, total, streak, last7Days, claude, buddy }
POST /api/chat                           → SSE stream de resposta do pet

GET  /api/conversations                  → lista de conversas
POST /api/conversations                  → cria nova conversa
DELETE /api/conversations                → deleta em massa (body: { ids })
GET  /api/conversations/:id              → mensagens + meta
PATCH /api/conversations/:id             → atualiza título ou projectDirs
DELETE /api/conversations/:id            → deleta uma conversa
POST /api/conversations/:id/messages     → adiciona mensagens
POST /api/conversations/:id/fork         → exporta como sessão Claude Code

GET  /api/claude-sessions                → lista sessões do Claude Code
GET  /api/claude-sessions/:hash/:id      → mensagens de uma sessão

GET  /api/project                        → dir configurado
POST /api/project                        → configura dir (ou null para remover)
GET  /api/project/browse?path=...        → browser de filesystem

GET  /api/config                         → provider, apiKey, lang
POST /api/config                         → atualiza config
POST /api/config/always-allow            → whitelist de comando

POST /api/exec                           → executa comando shell (requer aprovação)

WS   /ws/mood                            → stream de eventos de humor (a cada 30s)
```

---

## Dados locais

Tudo fica em `~/.buddy-land/` — nunca enviado a servidores externos:

```
~/.buddy-land/
├── config.json          # provider, apiKey, claudeModel, lang, alwaysAllowed
├── progress.json        # { xp, lastUpdated }
└── conversations/
    ├── index.json       # metadados de todas as conversas
    └── {uuid}.jsonl     # mensagens de cada conversa
```

---

## Testes

```bash
# Unit tests (Bun)
bun test

# E2E tests (Playwright, requer servidor rodando)
bun run test:e2e

# E2E com interface visual
bun run test:e2e:ui

# Ver relatório do último E2E
bun run test:e2e:report
```

---

## Roadmap

| Versão | Escopo |
|--------|--------|
| v0.1 | Lê ~/.claude.json, gera bones, renderiza sprite, mostra nome e raridade |
| v0.2 | Animação idle 3 frames, jardim básico, pet se move |
| v0.3 | Chat funcional com Anthropic API + soul como system prompt |
| v0.4 | Sessões → XP, stats page, progresso de evolução |
| v0.5 | Mood system, variação dia/noite, reações via WebSocket |
| v0.6 | Sidebar de histórico, multi-model, fork para Claude Code |
| v0.7 | Contexto de projeto injetado no chat, multi-pasta |
| v0.8 | Execução de comandos com aprovação, Modo Buddy, Playground |
| v0.9 | i18n PT/EN, fonte global, loading animado, scrollbar customizada |
| v1.0 | Todos os 18 sprites completos, shiny, conquistas, polish geral |

---

## Licença

MIT
