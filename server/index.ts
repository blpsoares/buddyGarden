import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const BUDDY_LAND_DIR = join(homedir(), '.buddy-land');
const CONFIG_PATH = join(BUDDY_LAND_DIR, 'config.json');
import { generateBones, readSoul, readUserId, detectSpeciesFromPersonality } from './buddy.ts';
import { readChatConfig } from './chat.ts';
import { computeSessionStats } from './sessions.ts';
import { streamChat } from './chat.ts';

const PORT = 7892;
const CLIENT_DIST = join(import.meta.dir, '..', 'client', 'dist');

// --- CORS headers ---
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function corsOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// --- Mood calculation ---
type Mood = 'happy' | 'excited' | 'tired' | 'bored' | 'focused' | 'chaotic';

function calcMood(
  chaos: number,
  debugging: number,
  streak: number,
  todaySessions: number,
): Mood {
  const hour = new Date().getHours();
  if (chaos > 80) return 'chaotic';
  if (todaySessions === 0) return 'bored';
  if (streak >= 7 || todaySessions >= 5) return 'excited';
  if (hour >= 22 || hour < 6) return 'tired';
  if (debugging > 70) return 'focused';
  return 'happy';
}

// --- WebSocket clients ---
const wsClients = new Set<ServerWebSocket<unknown>>();

// --- Serve static files from dist ---
function serveStatic(url: URL): Response | null {
  if (!existsSync(CLIENT_DIST)) return null;
  let filePath = join(CLIENT_DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!existsSync(filePath)) {
    filePath = join(CLIENT_DIST, 'index.html');
  }
  try {
    const content = readFileSync(filePath);
    const ext = filePath.split('.').pop() ?? '';
    const mimeMap: Record<string, string> = {
      html: 'text/html',
      js: 'application/javascript',
      css: 'text/css',
      svg: 'image/svg+xml',
      png: 'image/png',
      ico: 'image/x-icon',
      json: 'application/json',
    };
    return new Response(content, {
      headers: { 'Content-Type': mimeMap[ext] ?? 'application/octet-stream' },
    });
  } catch {
    return null;
  }
}

// --- HTTP Server ---
import type { ServerWebSocket } from 'bun';

Bun.serve({
  port: PORT,
  idleTimeout: 120, // SSE precisa de conexão longa
  async fetch(req, server) {
    const url = new URL(req.url);

    // OPTIONS preflight
    if (req.method === 'OPTIONS') return corsOptions();

    // WebSocket upgrade
    if (url.pathname === '/ws/mood') {
      const upgraded = server.upgrade(req);
      if (upgraded) return undefined as unknown as Response;
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    // --- API routes ---
    if (url.pathname === '/api/buddy' && req.method === 'GET') {
      const userId = readUserId();
      const soul = readSoul();
      let bones = userId ? generateBones(userId) : null;
      const sessionStats = computeSessionStats();

      // Se a personalidade menciona uma espécie conhecida, usa ela
      if (bones && soul?.personality) {
        const detected = detectSpeciesFromPersonality(soul.personality);
        if (detected) bones = { ...bones, species: detected };
      }

      if (!userId && !soul) {
        return json({ bones: null, soul: null, xp: 0, level: 'Hatchling', sessionCount: 0 });
      }

      return json({
        bones,
        soul,
        xp: sessionStats.xp,
        level: sessionStats.level,
        levelProgress: sessionStats.levelProgress,
        xpForCurrentLevel: sessionStats.xpForCurrentLevel,
        xpForNextLevel: sessionStats.xpForNextLevel,
        sessionCount: sessionStats.total,
      });
    }

    if (url.pathname === '/api/sessions' && req.method === 'GET') {
      const stats = computeSessionStats();
      return json({
        today: stats.today,
        total: stats.total,
        streak: stats.streak,
        last7Days: stats.last7Days,
      });
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      type ChatBody = { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> };
      const body = (await req.json()) as ChatBody;
      const { message, history = [] } = body;

      const userId = readUserId();
      const soul = readSoul();
      const bones = userId ? generateBones(userId) : generateBones('anonymous');
      const stats = computeSessionStats();

      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(controller) {
          let closed = false;
          const safeClose = () => {
            if (!closed) {
              closed = true;
              try { controller.close(); } catch { /* client disconnected */ }
            }
          };
          const safeEnqueue = (data: Uint8Array) => {
            if (!closed) {
              try { controller.enqueue(data); } catch { closed = true; }
            }
          };

          streamChat(
            message, history, soul, bones, stats,
            (text) => safeEnqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)),
            () => { safeEnqueue(encoder.encode('data: [DONE]\n\n')); safeClose(); },
            (err) => {
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ error: err })}\n\n`));
              safeClose();
            },
          ).catch((e: unknown) => {
            console.error('Chat error:', e);
            safeClose();
          });
        },
      });

      return new Response(stream, {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    if (url.pathname === '/api/config' && req.method === 'GET') {
      const config = readChatConfig();
      return json({ provider: config.provider, hasApiKey: !!config.apiKey });
    }

    if (url.pathname === '/api/config' && req.method === 'POST') {
      type ConfigBody = { provider: string; apiKey?: string };
      const body = (await req.json()) as ConfigBody;
      const validProviders = ['claude-cli', 'anthropic', 'gemini'];
      if (!validProviders.includes(body.provider)) {
        return json({ error: 'Provider inválido' }, 400);
      }
      if (body.provider !== 'claude-cli' && (!body.apiKey || body.apiKey.length < 10)) {
        return json({ error: 'API key necessária para este provider' }, 400);
      }
      if (!existsSync(BUDDY_LAND_DIR)) mkdirSync(BUDDY_LAND_DIR, { recursive: true });
      const existing = existsSync(CONFIG_PATH)
        ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        : {};
      writeFileSync(CONFIG_PATH, JSON.stringify({ ...existing, provider: body.provider, apiKey: body.apiKey ?? existing['apiKey'] }, null, 2));
      return json({ ok: true });
    }

    // Static files in production
    const staticResponse = serveStatic(url);
    if (staticResponse) return staticResponse;

    return new Response('Not found', { status: 404 });
  },

  websocket: {
    open(ws) {
      wsClients.add(ws);
    },
    close(ws) {
      wsClients.delete(ws);
    },
    message(_ws, _msg) {
      // no-op, mood is push-only
    },
  },
});

console.log(`🌱 buddy.land server running on http://localhost:${PORT}`);

// Broadcast mood events every 30s
setInterval(() => {
  const userId = readUserId();
  const bones = userId ? generateBones(userId) : null;
  const stats = computeSessionStats();
  const mood = bones
    ? calcMood(bones.stats.chaos, bones.stats.debugging, stats.streak, stats.today)
    : 'bored';

  const payload = JSON.stringify({ type: 'mood', mood });
  for (const ws of wsClients) {
    ws.send(payload);
  }
}, 30_000);
