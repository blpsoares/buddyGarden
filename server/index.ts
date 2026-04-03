import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { buildProjectContext, browseDir } from './project-context.ts';

const BUDDY_LAND_DIR = join(homedir(), '.buddy-garden');
const CONFIG_PATH = join(BUDDY_LAND_DIR, 'config.json');
import { generateBones, readSoul, readUserId, detectSpeciesFromPersonality } from './buddy.ts';
import { readChatConfig } from './chat.ts';
import { computeSessionStats } from './sessions.ts';
import { streamChat } from './chat.ts';
import {
  listConversations,
  getConversation,
  createConversation,
  appendMessages,
  deleteConversation,
  renameConversation,
  exportConversationToFile,
} from './conversations.ts';

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

    // ── Conversations ───────────────────────────────────────────────────────────
    if (url.pathname === '/api/conversations' && req.method === 'GET') {
      return json(listConversations());
    }

    if (url.pathname === '/api/conversations' && req.method === 'POST') {
      type CreateBody = { firstMessage: string };
      const body = (await req.json()) as CreateBody;
      if (!body.firstMessage?.trim()) return json({ error: 'firstMessage obrigatório' }, 400);
      return json(createConversation(body.firstMessage.trim()));
    }

    const convMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)$/);
    if (convMatch) {
      const id = convMatch[1]!;
      if (req.method === 'GET') {
        return json(getConversation(id));
      }
      if (req.method === 'DELETE') {
        deleteConversation(id);
        return json({ ok: true });
      }
      if (req.method === 'PATCH') {
        const body = (await req.json()) as { title?: string };
        if (body.title) renameConversation(id, body.title.trim());
        return json({ ok: true });
      }
    }

    // Bulk-append messages to a conversation (used by garden balloon save)
    const convMsgMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/);
    if (convMsgMatch && req.method === 'POST') {
      const id = convMsgMatch[1]!;
      type MsgsBody = { messages: Array<{ role: 'user' | 'assistant'; content: string }> };
      const body = (await req.json()) as MsgsBody;
      if (!Array.isArray(body.messages)) return json({ error: 'messages must be array' }, 400);
      const now = Date.now();
      appendMessages(id, body.messages.map(m => ({ role: m.role, content: m.content, ts: now })));
      return json({ ok: true });
    }

    // Export conversation to a file for use with Claude CLI
    const convExportMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)\/export-to-claude$/);
    if (convExportMatch && req.method === 'POST') {
      const id = convExportMatch[1]!;
      const result = exportConversationToFile(id);
      if (!result) return json({ error: 'conversa não encontrada ou vazia' }, 404);
      return json(result);
    }

    // ── Project context ──────────────────────────────────────────────────────────
    if (url.pathname === '/api/project' && req.method === 'GET') {
      try {
        const cfg = existsSync(CONFIG_PATH)
          ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
          : {};
        const dir = cfg['projectDir'] as string | undefined;
        return json({ dir: dir ?? null });
      } catch { return json({ dir: null }); }
    }

    if (url.pathname === '/api/project' && req.method === 'POST') {
      type ProjBody = { dir: string | null };
      const body = (await req.json()) as ProjBody;
      if (!existsSync(BUDDY_LAND_DIR)) mkdirSync(BUDDY_LAND_DIR, { recursive: true });
      const existing = existsSync(CONFIG_PATH)
        ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        : {};
      if (body.dir === null) {
        const { projectDir: _, ...rest } = existing as Record<string, unknown> & { projectDir?: string };
        writeFileSync(CONFIG_PATH, JSON.stringify(rest, null, 2));
        return json({ ok: true, dir: null });
      }
      if (!existsSync(body.dir)) return json({ error: 'Diretório não encontrado' }, 400);
      writeFileSync(CONFIG_PATH, JSON.stringify({ ...existing, projectDir: body.dir }, null, 2));
      return json({ ok: true, dir: body.dir });
    }

    if (url.pathname === '/api/project/browse' && req.method === 'GET') {
      const path = url.searchParams.get('path') ?? homedir();
      const result = browseDir(path);
      return json(result);
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      type ChatBody = { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; conversationId?: string; lang?: 'pt' | 'en' };
      const body = (await req.json()) as ChatBody;
      const { message, history = [], conversationId } = body;

      const userId = readUserId();
      const soul = readSoul();
      const bones = userId ? generateBones(userId) : generateBones('anonymous');
      const stats = computeSessionStats();

      // Project context (opcional — lido da config)
      let projectContextStr: string | undefined;
      try {
        const cfg = existsSync(CONFIG_PATH)
          ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
          : {};
        const projectDir = cfg['projectDir'] as string | undefined;
        if (projectDir && existsSync(projectDir)) {
          const ctx = await buildProjectContext(projectDir);
          projectContextStr = ctx.summary;
        }
      } catch { /* projeto opcional, nunca bloqueia o chat */ }

      // Resolve lang: body override > config file > default 'pt'
      const configLang = (() => {
        try {
          if (existsSync(CONFIG_PATH)) {
            const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>;
            return (cfg['lang'] as 'pt' | 'en' | undefined) ?? 'pt';
          }
        } catch { /* ignore */ }
        return 'pt';
      })();
      const chatLang: 'pt' | 'en' = body.lang ?? configLang;

      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(controller) {
          let closed = false;
          let assistantText = '';
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

          const now = Date.now();
          streamChat(
            message, history, soul, bones, stats,
            (text) => { assistantText += text; safeEnqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)); },
            () => {
              if (conversationId && assistantText.trim()) {
                appendMessages(conversationId, [
                  { role: 'user', content: message, ts: now },
                  { role: 'assistant', content: assistantText, ts: Date.now() },
                ]);
              }
              safeEnqueue(encoder.encode('data: [DONE]\n\n'));
              safeClose();
            },
            (err) => {
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ error: err })}\n\n`));
              safeClose();
            },
            chatLang,
            projectContextStr,
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
      const configLang = (() => {
        try {
          if (existsSync(CONFIG_PATH)) {
            const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>;
            return (cfg['lang'] as 'pt' | 'en' | undefined) ?? 'pt';
          }
        } catch { /* ignore */ }
        return 'pt';
      })();
      return json({ provider: config.provider, hasApiKey: !!config.apiKey, claudeModel: config.claudeModel ?? 'claude-haiku-4-5', lang: configLang });
    }

    if (url.pathname === '/api/config' && req.method === 'POST') {
      type ConfigBody = { provider?: string; apiKey?: string; claudeModel?: string; lang?: 'pt' | 'en' };
      const body = (await req.json()) as ConfigBody;
      if (!existsSync(BUDDY_LAND_DIR)) mkdirSync(BUDDY_LAND_DIR, { recursive: true });
      const existing = existsSync(CONFIG_PATH)
        ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        : {};

      // Permite patch parcial (só lang, por exemplo)
      if (body.provider !== undefined) {
        const validProviders = ['claude-cli', 'anthropic', 'gemini'];
        if (!validProviders.includes(body.provider)) {
          return json({ error: 'Provider inválido' }, 400);
        }
        if (body.provider !== 'claude-cli' && (!body.apiKey || body.apiKey.length < 10)) {
          return json({ error: 'API key necessária para este provider' }, 400);
        }
      }

      const updated: Record<string, unknown> = { ...existing };
      if (body.provider !== undefined) updated['provider'] = body.provider;
      if (body.apiKey !== undefined) updated['apiKey'] = body.apiKey;
      if (body.claudeModel !== undefined) updated['claudeModel'] = body.claudeModel;
      if (body.lang !== undefined) updated['lang'] = body.lang;
      if (!updated['claudeModel']) updated['claudeModel'] = 'claude-haiku-4-5';

      writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
      return json({ ok: true });
    }

    // Adiciona comando à lista de sempre-permitidos
    if (url.pathname === '/api/config/always-allow' && req.method === 'POST') {
      type AllowBody = { command: string };
      const body = (await req.json()) as AllowBody;
      if (!body.command?.trim()) return json({ error: 'command obrigatório' }, 400);
      if (!existsSync(BUDDY_LAND_DIR)) mkdirSync(BUDDY_LAND_DIR, { recursive: true });
      const existing = existsSync(CONFIG_PATH)
        ? JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>
        : {};
      const alwaysAllowed = Array.isArray(existing['alwaysAllowed'])
        ? (existing['alwaysAllowed'] as string[])
        : [];
      if (!alwaysAllowed.includes(body.command.trim())) {
        alwaysAllowed.push(body.command.trim());
      }
      writeFileSync(CONFIG_PATH, JSON.stringify({ ...existing, alwaysAllowed }, null, 2));
      return json({ ok: true });
    }

    // Executa um comando shell (requer aprovação prévia no cliente)
    if (url.pathname === '/api/exec' && req.method === 'POST') {
      type ExecBody = { command: string };
      const body = (await req.json()) as ExecBody;
      if (!body.command?.trim()) return json({ error: 'command obrigatório' }, 400);

      const command = body.command.trim();
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        start(controller) {
          let closed = false;
          const safeClose = () => {
            if (!closed) { closed = true; try { controller.close(); } catch { /* ok */ } }
          };
          const enq = (data: string) => {
            if (!closed) { try { controller.enqueue(encoder.encode(data)); } catch { closed = true; } }
          };

          const proc = Bun.spawn(['bash', '-c', command], {
            stdout: 'pipe',
            stderr: 'pipe',
            stdin: 'inherit',
          });

          const decoder = new TextDecoder();

          // Stream stdout
          void (async () => {
            for await (const chunk of proc.stdout) {
              enq(`data: ${JSON.stringify({ text: decoder.decode(chunk, { stream: true }) })}\n\n`);
            }
          })();

          // Stream stderr como texto também
          void (async () => {
            for await (const chunk of proc.stderr) {
              enq(`data: ${JSON.stringify({ text: decoder.decode(chunk, { stream: true }) })}\n\n`);
            }
          })();

          void proc.exited.then(code => {
            enq(`data: ${JSON.stringify({ exitCode: code })}\n\n`);
            enq('data: [DONE]\n\n');
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
