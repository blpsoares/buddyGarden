# buddy.land

Your Claude Code Buddy, outside the terminal.  
Animated pixel art, interactive world, real conversation with your companion.

```bash
bunx buddy-land
# opens at http://localhost:7892
```

---

## What is it

Claude Code has a pet system called `/buddy`. Every user gets a unique companion generated deterministically from their `userId` — but it only lives in the terminal as ASCII art, with no rich interaction.

**buddy.land** solves this: it reads your buddy's data directly from Claude Code's local files, renders the pet as animated pixel art, and lets you chat, play, and watch it evolve based on your real Claude Code usage.

---

## Features

### Living companion
- **18 species** with unique pixel art sprites — duck, goose, cat, rabbit, owl, penguin, turtle, snail, dragon, octopus, axolotl, ghost, robot, blob, cactus, mushroom, chonk, capybara
- **5 rarities** — common (50%), uncommon (25%), rare (15%), epic (8%), legendary (2%)
- **Deterministic generation** — your pet is always the same, generated from your `userId` using Mulberry32 PRNG + FNV-1a hash
- **Shiny effect** (1% chance) with iridescent shimmer on canvas
- **8 hats** in pixel art — wizard, cowboy, crown, party, chef, top, flower, halo
- **10 eye types** — pixel art style

### Interactive garden
- Species-themed scenery with subtle parallax
- Animated SVG background for the dragon: medieval castle, twinkling stars, flying bats, crescent moon, flickering torches
- Pet walks around idle, stops and looks at you on hover
- Real-time day/night cycle based on system clock
- Click menu — quick chat, stats, playground

### Chat with personality
- **3 AI providers** — Anthropic (claude-haiku-4-5, sonnet-4-6, opus-4-6), Google Gemini, Claude Code CLI
- **Dynamic system prompt** with pet's personality (name, species, rarity, stats, mood)
- **Project context injection** — the pet knows what you're coding (README, package.json, git status)
- **Typewriter streaming** — smooth text animation
- **Automatic history compression** — sliding window with summarization to prevent context overflow
- **Command execution** — the pet can suggest and run shell commands with user approval
- **Persistent history** — conversations saved as JSONL in `~/.buddy-garden/conversations/`
- **Fork to Claude Code** — exports conversation as a real Claude Code session
- **Claude sessions as context** — imports Claude Code sessions as silent internal context
- Sidebar with accordion sections: PROJECTS and CONVERSATIONS collapsible
- Multi-folder per conversation — select multiple directories as context

### XP and evolution system
| Tier | Min XP | Visual |
|------|--------|--------|
| Hatchling | 0 | base sprite |
| Juvenile | 100,000 | energy markers in corners |
| Adult | 1,000,000 | species-exclusive overlay |
| Elder | 10,000,000 | permanent particle effect |
| Ancient | 100,000,000 | animated aura + altered palette |

XP calculated from JSONL logs in `~/.claude/projects/`. Each token ≈ 0.001 XP, each session = +50 XP, daily streak multiplies up to 2×.

### Mood system
| Mood | Condition |
|------|-----------|
| happy | default |
| excited | streak ≥ 7 days |
| tired | late night + sessions today |
| bored | zero sessions today |
| focused | DEBUGGING > 80 + more than 2 sessions |
| chaotic | CHAOS > 80 |

Affects movement speed, facial expression, idle animation, and response tone.

### Stats and RPG sheet
- 5 stats — DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK (0–100)
- Peak and Valley highlighted
- Animated fill bars on open
- Activity chart for last 7 days (separating Claude vs Buddy sessions)
- XP progress to next tier
- Archetypes generated from dominant stats
- Shiny badge with iridescent effect

### Buddy Mode
- Pou-style interface — pet centered with state machine
- Actions: pet, feed, play, chat
- Reaction animations for each action

### Playground
- Mini-games with the pet — pet, fetch, trick

---

## Getting started

**Prerequisite:** [Bun](https://bun.sh) installed.

```bash
# Option 1: zero install (coming to npm)
bunx buddy-land

# Option 2: clone and run
git clone https://github.com/blpsoares/buddyGarden.git
cd buddyGarden
bun install
bun run dev
```

Opens at `http://localhost:7892` (server) + `http://localhost:5173` (Vite dev).

On first launch you'll be asked for your `ANTHROPIC_API_KEY` — stored locally in `~/.buddy-land/config.json`. Nothing is sent to external servers beyond the configured AI provider.

If you haven't run `/buddy` in Claude Code yet, the garden shows a waiting screen and automatically detects when the companion is created (polling every 5s).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Server | Bun HTTP native + WebSocket |
| Frontend | React 18 + Vite 6 |
| Rendering | Canvas 2D — `imageRendering: pixelated` |
| Chat | Anthropic SDK / Google Generative AI / Claude Code CLI |
| i18n | PT-BR + EN (170+ keys) |
| Icons | lucide-react |
| Tests | Bun test (unit) + Playwright (E2E) |
| Data | Local files — no database |

---

## How the Buddy is generated

### Appearance — Bones

Deterministically generated from `userId` using Mulberry32 PRNG and FNV-1a hash:

```
seed = FNV-1a(userId + 'friend-2026-401')
rand = Mulberry32(seed)
```

Attributes rolled in deterministic sequence:
- **Rarity** — by cumulative weight
- **Species** — index into array of 18 species
- **Stats** — DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK (0–100 each)
- **Shiny** — `rand() < 0.01`
- **Eye & Hat** — index into respective pools

### Personality — Soul

Read from `~/.claude.json` at fields `companion.name` and `companion.personality`, injected as the chat system prompt. Falls back to a generic species-based personality if not found.

---

## Project structure

```
buddyGarden/
├── server/
│   ├── index.ts              # Bun HTTP server (7892) + WebSocket /ws/mood
│   ├── buddy.ts              # generateBones() + readSoul() + readUserId()
│   ├── sessions.ts           # JSONL logs → XP, streak, count, last7Days
│   ├── chat.ts               # multi-provider streaming + dynamic system prompt
│   ├── conversations.ts      # CRUD conversations in JSONL + index.json
│   ├── claude-sessions.ts    # reads Claude Code sessions (~/.claude/)
│   ├── sprites.ts            # species sprite metadata (palettes, frames)
│   └── project-context.ts   # extracts project context to inject into chat
├── client/src/
│   ├── App.tsx               # page routing + nav + settings
│   ├── i18n.ts               # PT/EN translations
│   ├── context/
│   │   └── ChatContext.tsx   # global chat state (streaming, conversations, provider)
│   ├── pages/
│   │   ├── Garden.tsx        # garden with 18 sceneries, idle walk, click menu
│   │   ├── Chat.tsx          # fullscreen chat with sidebar and context selection
│   │   ├── Stats.tsx         # RPG sheet with activity chart and archetypes
│   │   ├── BuddyMode.tsx     # Pou-style mode with state machine
│   │   └── PlayMode.tsx      # mini-games
│   ├── components/
│   │   ├── BuddySprite.tsx   # pixel art canvas (18 species, 3-frame idle, shiny)
│   │   ├── DragonBuddy.tsx   # dragon sprite with high-fidelity SVG
│   │   ├── SpeechBubble.tsx  # pet speech balloon
│   │   ├── RarityBadge.tsx   # animated rarity badge
│   │   ├── StatBar.tsx       # stat bar with fill animation
│   │   ├── MarkdownRenderer.tsx # markdown → JSX for chat responses
│   │   ├── ProjectPicker.tsx # directory selector with multi-folder checkbox
│   │   ├── PermissionDialog.tsx # shell command approval dialog
│   │   └── PixelLoader.tsx   # pixel art style loading animation
│   ├── sprites/
│   │   ├── Dragon.tsx        # DragonBody SVG with walk/idle/sleep animations
│   │   └── index.tsx         # sprite registry by species
│   ├── backgrounds/
│   │   └── DragonBackground.tsx  # animated SVG background (night castle)
│   ├── hooks/
│   │   ├── useBuddy.ts       # fetch and polling for buddy data
│   │   ├── useChat.ts        # ChatContext wrapper
│   │   ├── useBreakpoint.ts  # mobile/desktop detection
│   │   ├── useSpriteAnimation.ts # frame timing
│   │   ├── useLoadAtlas.ts   # sprite atlas preloading
│   │   └── useT.ts           # translation shorthand
│   └── utils/
│       └── color.ts          # darken / lighten / shiftHue
├── tests/
│   ├── buddy.test.ts         # unit: generateBones, detectSpecies
│   ├── sessions.test.ts      # unit: XP, streak, last7Days
│   ├── conversations.test.ts # unit: conversation CRUD
│   ├── i18n.test.ts          # unit: PT/EN translations
│   ├── chat.test.ts          # unit: buildSystemPrompt, compressHistory
│   └── *.spec.ts             # E2E Playwright: navigation, garden, chat, stats, etc.
├── cli/
│   └── chat.ts               # direct CLI chat (no UI)
├── public/
│   └── favicon.ico
├── package.json
├── vite.config.ts
├── playwright.config.ts
└── tsconfig.json
```

---

## API reference

```
GET  /api/buddy                          → { bones, soul, xp, level, sessionCount }
GET  /api/sessions                       → { today, total, streak, last7Days, claude, buddy }
POST /api/chat                           → SSE stream of pet response

GET  /api/conversations                  → conversation list
POST /api/conversations                  → create conversation
DELETE /api/conversations                → bulk delete (body: { ids })
GET  /api/conversations/:id              → messages + meta
PATCH /api/conversations/:id             → update title or projectDirs
DELETE /api/conversations/:id            → delete one conversation
POST /api/conversations/:id/messages     → append messages
POST /api/conversations/:id/fork         → export as Claude Code session

GET  /api/claude-sessions                → list Claude Code sessions
GET  /api/claude-sessions/:hash/:id      → messages from a session

GET  /api/project                        → configured directory
POST /api/project                        → set directory (or null to remove)
GET  /api/project/browse?path=...        → filesystem browser

GET  /api/config                         → provider, apiKey, lang
POST /api/config                         → update config
POST /api/config/always-allow            → whitelist a command

POST /api/exec                           → run shell command (requires approval)

WS   /ws/mood                            → mood event stream (every 30s)
```

---

## Local data

Everything stays in `~/.buddy-land/` — never sent to external servers:

```
~/.buddy-land/
├── config.json          # provider, apiKey, claudeModel, lang, alwaysAllowed
├── progress.json        # { xp, lastUpdated }
└── conversations/
    ├── index.json       # all conversation metadata
    └── {uuid}.jsonl     # messages for each conversation
```

---

## Tests

```bash
# Unit tests (Bun)
bun test

# E2E tests (Playwright, requires server running)
bun run test:e2e

# E2E with interactive UI
bun run test:e2e:ui

# View last E2E report
bun run test:e2e:report
```

---

## Roadmap

| Version | Scope |
|---------|-------|
| v0.1 | Reads ~/.claude.json, generates bones, renders sprite, shows name and rarity |
| v0.2 | 3-frame idle animation, basic garden, pet moves |
| v0.3 | Working chat with Anthropic API + soul as system prompt |
| v0.4 | Sessions → XP, stats page, evolution progress |
| v0.5 | Mood system, day/night variation, WebSocket reactions |
| v0.6 | Conversation history sidebar, multi-model, fork to Claude Code |
| v0.7 | Project context injection, multi-folder |
| v0.8 | Command execution with approval, Buddy Mode, Playground |
| v0.9 | PT/EN i18n, global font, animated loading, custom scrollbar |
| v1.0 | All 18 sprites complete, shiny, achievements, general polish |

---

## License

MIT
