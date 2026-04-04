# CLAUDE.md — buddy.land

This file describes the project's conventions, architecture, and development patterns.
It is intended for Claude Code and human contributors alike.

---

## Project overview

**buddy.land** is a local web app that brings your Claude Code buddy (`/buddy`) to life outside the terminal.  
It reads data from Claude Code's local files, renders the pet as animated pixel art, and lets you chat with it using the Anthropic API (or Google Gemini / Claude Code CLI).

Runs at `http://localhost:7892`. No database — all state lives in `~/.buddy-land/`.

---

## Running locally

```bash
bun install
bun run dev        # server (7892) + vite dev (5173) concurrently
bun run build      # production build → client/dist/
bun run start      # production server only
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Server | `Bun.serve` — HTTP + WebSocket |
| Frontend | React 18 + Vite 6 |
| Sprite rendering | Canvas 2D with `imageRendering: pixelated` |
| AI | Anthropic SDK / Google Generative AI / Claude Code CLI |
| i18n | Custom `t(lang, key)` — PT-BR + EN (see `client/src/i18n.ts`) |
| Icons | `lucide-react` |
| Unit tests | `bun test` |
| E2E tests | Playwright (`npx playwright test`) |

---

## Project structure

```
server/         Bun backend — one file per concern
client/src/     React frontend
  pages/        Top-level pages (Garden, Chat, Stats, BuddyMode, PlayMode)
  components/   Reusable UI components
  context/      React Context (ChatContext — global chat + streaming state)
  hooks/        Custom hooks
  sprites/      SVG/canvas sprite definitions
  backgrounds/  Animated backgrounds
  utils/        Pure utility functions
tests/
  *.test.ts     Unit tests (run with bun test)
  *.spec.ts     E2E tests (run with Playwright — do NOT run with bun test)
docs/           Extended documentation and specs
```

---

## Key conventions

### TypeScript
- Strict mode enabled (`"strict": true`, `"noUncheckedIndexedAccess": true`).
- Always use non-null assertion (`!`) or explicit guard when indexing arrays/records — the compiler requires it.
- Server code: plain `tsconfig.json` at root. Client code: `client/tsconfig.json` (Vite/bundler resolution).
- No `any` unless absolutely unavoidable — prefer `unknown` + type guard.

### React / Frontend
- State management via React Context (`ChatContext`). No Redux/Zustand.
- Avoid stale closures in callbacks: use `useRef` to hold mutable values accessed inside `setInterval`/`setTimeout`.
- Canvas elements: always apply `devicePixelRatio` scaling in `useEffect`; set `imageSmoothingEnabled = false` for pixel art.
- All pixel art canvas/img elements must have `imageRendering: pixelated` (+ `crisp-edges` fallback).
- Inline styles are acceptable — there is no CSS framework. Keep style objects near the component they affect.
- Default font: `'Silkscreen', sans-serif` via CSS variable `--app-font` (user-overridable from settings).

### Server
- All routes live in `server/index.ts`. Route handlers are thin — business logic lives in dedicated modules.
- Chat streaming uses SSE (`text/event-stream`). Each chunk: `data: {"text":"..."}\n\n`.
- File I/O always uses `Bun.file` or `fs` sync calls — no async file wrappers.
- Local data root: `~/.buddy-land/`. Never write user data anywhere else.
- Poll `~/.claude.json` and session logs every 10s — don't use `fs.watch` (unstable on WSL).

### i18n
- All user-facing strings go through `t(lang, key)` from `client/src/i18n.ts`.
- When adding a new string, add both `pt` and `en` keys — a missing key will surface as `undefined` at runtime.
- Language is stored in `~/.buddy-land/config.json` and synced to `ChatContext`.

### Buddy generation
The buddy is generated **deterministically** — same `userId` always produces the same result.  
Do not change the seed formula (`FNV-1a(userId + 'friend-2026-401')`) or the PRNG (`Mulberry32`) — it would change every user's existing buddy.

```
seed  = FNV-1a(userId + 'friend-2026-401')
rand  = Mulberry32(seed)
order = rarity → species → stats → shiny → eye → hat
```

---

## Git workflow

### Branches
- `main` — stable, always passing tests.
- Feature branches: `feat/<name>`, fix branches: `fix/<name>`.

### Commits
Conventional Commits are enforced. Commit message format:

```
<type>(<scope>): <short description>

[optional body]
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `chore`, `style`, `ci`  
Scopes (optional): `chat`, `server`, `garden`, `sprites`, `stats`, `i18n`, `font`, `release`, `typescript`, `gitignore`

Examples:
```
feat(chat): add parked stream support for background conversations
fix(garden): eliminate sleep/walk oscillation with timer chain
chore(release): bump to v0.2.0
test(sessions): add streak edge cases for consecutive-day detection
```

### Hooks (Husky)
- **pre-commit**: runs `bun test tests/*.test.ts` — unit tests only, not Playwright specs.
- **pre-push**: runs `tsc --noEmit` + unit tests + `bun run build`.

If the pre-commit hook fails, fix the failing test before committing. Do not bypass hooks with `--no-verify`.

### Releases
```bash
bun run release          # auto-detects bump from commit history
bun run release:minor    # force minor bump
bun run release:major    # force major bump
bun run release:patch    # force patch bump
```

`standard-version` reads commits since the last tag, bumps `package.json` version, generates `CHANGELOG.md`, and creates a release commit + tag.

---

## Testing

### Unit tests (`bun test`)
Files: `tests/*.test.ts`  
Cover: `generateBones`, `detectSpecies`, session XP/streak, conversation CRUD, i18n keys, `buildSystemPrompt`, `compressHistory`.

```bash
bun test                       # all unit tests
bun test tests/chat.test.ts    # single file
```

### E2E tests (Playwright)
Files: `tests/*.spec.ts`  
Require the dev server to be running (`bun run dev`).

```bash
bun run test:e2e          # headless
bun run test:e2e:ui       # interactive UI
bun run test:e2e:report   # view last report
```

**Important:** never run `bun test tests/` (without glob) — it will attempt to load Playwright spec files through the Bun runner and fail.

---

## Adding a new sprite species

1. Add the species string to the `SPECIES` array in `server/buddy.ts`.
2. Add its palette to `SPECIES_PALETTES` in `server/sprites.ts`.
3. Implement `draw<Species>(ctx, pal, by, blink, expr)` in `client/src/components/BuddySprite.tsx` following the existing pattern.
4. Register it in the `switch` inside `drawSpecies()`.
5. Optionally add a matching SVG sprite in `client/src/sprites/` and a background in `client/src/backgrounds/`.
6. Add a `detectSpeciesFromPersonality` mapping in `server/buddy.ts` if the species name can appear in soul personality strings.

---

## Local data layout

```
~/.buddy-land/
├── config.json        # { provider, apiKey, claudeModel, lang, alwaysAllowed[] }
├── progress.json      # { xp, lastUpdated }
└── conversations/
    ├── index.json     # ConversationMeta[]
    └── {uuid}.jsonl   # { role, content, ts } per message
```

Claude Code session logs (read-only):
```
~/.claude/projects/{projectHash}/{sessionId}.jsonl
```

---

## API reference (quick)

```
GET  /api/buddy                    → bones, soul, xp, level
GET  /api/sessions                 → today, total, streak, last7Days, claude, buddy
POST /api/chat                     → SSE stream (message, history, conversationId, lang)

GET  /api/conversations            → list
POST /api/conversations            → create (firstMessage, projectDirs)
GET  /api/conversations/:id        → messages + meta
PATCH /api/conversations/:id       → update title or projectDirs
DELETE /api/conversations/:id      → delete
POST /api/conversations/:id/messages → append
POST /api/conversations/:id/fork   → export as Claude Code session

GET  /api/claude-sessions          → list Claude Code sessions
GET  /api/claude-sessions/:hash/:id → messages

GET  /api/config                   → provider, apiKey, lang
POST /api/config                   → update
POST /api/config/always-allow      → whitelist a command
POST /api/exec                     → run shell command (requires approval or whitelist)

GET  /api/project                  → configured directory
POST /api/project                  → set directory
GET  /api/project/browse?path=     → filesystem browser

WS   /ws/mood                      → mood push events (every 30s)
```

---

## Things to avoid

- Do not change the buddy generation seed/PRNG — it would reassign every user's pet.
- Do not use `fs.watch` — use polling at 10s intervals instead (WSL stability).
- Do not run `bun test tests/` without a glob — Playwright spec files will crash the Bun runner.
- Do not store user data outside `~/.buddy-land/`.
- Do not skip pre-commit/pre-push hooks (`--no-verify`).
- Do not add CSS frameworks — keep styles inline or in `<style>` blocks.
- Do not mock the filesystem in unit tests for `conversations.ts` — tests create and delete real files under `~/.buddy-land/` with `afterEach` cleanup.

---

## Further reading

- [docs/SPEC.pt.md](docs/SPEC.pt.md) — original Portuguese spec with full algorithm details
- [docs/README.en.md](docs/README.en.md) — English README
- [TODO.md](TODO.md) — pending tasks
