import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const CONFIG_PATH = join(homedir(), '.buddy-garden', 'config.json');

function readDefaultProjectDir(): string | null {
  try {
    if (existsSync(CONFIG_PATH)) {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>;
      const dir = cfg['projectDir'] as string | undefined;
      if (dir && existsSync(dir)) return dir;
    }
  } catch { /* ignore */ }
  return null;
}

const GARDEN_DIR = join(homedir(), '.buddy-garden');
const CONV_DIR = join(GARDEN_DIR, 'conversations');
const INDEX_PATH = join(CONV_DIR, 'index.json');

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  projectDir?: string;        // pasta de contexto desta conversa
  forkedSessionId?: string;   // se fork para Claude: sessionId
  forkedProjectDir?: string;  // se fork para Claude: cwd do projeto
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

function ensureDir() {
  if (!existsSync(CONV_DIR)) mkdirSync(CONV_DIR, { recursive: true });
}

function readIndex(): ConversationMeta[] {
  try {
    if (existsSync(INDEX_PATH)) {
      return JSON.parse(readFileSync(INDEX_PATH, 'utf-8')) as ConversationMeta[];
    }
  } catch { /* ignore */ }
  return [];
}

function writeIndex(index: ConversationMeta[]) {
  ensureDir();
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

export function listConversations(): ConversationMeta[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversationMeta(id: string): ConversationMeta | null {
  return readIndex().find(m => m.id === id) ?? null;
}

export function getConversation(id: string): ConversationMessage[] {
  const filePath = join(CONV_DIR, `${id}.jsonl`);
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as ConversationMessage);
}

export function createConversation(firstMessage: string, projectDir?: string | null): ConversationMeta {
  ensureDir();
  const id = randomUUID();
  const now = Date.now();
  const title = firstMessage.length > 60 ? firstMessage.slice(0, 57) + '...' : firstMessage;
  // Se não foi passado projectDir explícito, usa o default global
  const resolvedDir = projectDir !== undefined ? projectDir : readDefaultProjectDir();
  const meta: ConversationMeta = {
    id, title, createdAt: now, updatedAt: now, messageCount: 0,
    ...(resolvedDir ? { projectDir: resolvedDir } : {}),
  };
  const index = readIndex();
  index.unshift(meta);
  writeIndex(index);
  writeFileSync(join(CONV_DIR, `${id}.jsonl`), '');
  return meta;
}

export function appendMessages(id: string, messages: ConversationMessage[]) {
  ensureDir();
  const filePath = join(CONV_DIR, `${id}.jsonl`);
  if (!existsSync(filePath)) return;
  appendFileSync(filePath, messages.map(m => JSON.stringify(m)).join('\n') + '\n');
  const index = readIndex();
  const meta = index.find(m => m.id === id);
  if (meta) {
    meta.updatedAt = Date.now();
    meta.messageCount += messages.length;
    writeIndex(index);
  }
}

export function deleteConversation(id: string) {
  const filePath = join(CONV_DIR, `${id}.jsonl`);
  if (existsSync(filePath)) unlinkSync(filePath);
  writeIndex(readIndex().filter(m => m.id !== id));
}

export function renameConversation(id: string, title: string) {
  const index = readIndex();
  const meta = index.find(m => m.id === id);
  if (meta) { meta.title = title; writeIndex(index); }
}

export function setConversationProjectDir(id: string, dir: string | null) {
  const index = readIndex();
  const meta = index.find(m => m.id === id);
  if (!meta) return;
  if (dir) meta.projectDir = dir;
  else delete meta.projectDir;
  writeIndex(index);
}

// ── Auto-open terminal (WSL2 / Linux) ────────────────────────────────────────

async function openInTerminal(sessionId: string, cwd: string): Promise<boolean> {
  const safeDir = cwd.replace(/'/g, "'\\''");
  const cmd = `cd '${safeDir}' && claude --resume ${sessionId}`;

  // Tentativa 1: WSL2 → Windows Terminal
  try {
    const proc = Bun.spawn(
      ['cmd.exe', '/c', `start "" wt.exe -- wsl.exe -- bash -c "${cmd.replace(/"/g, '\\"')}"`],
      { stdout: 'pipe', stderr: 'pipe', stdin: null },
    );
    // Não esperamos a conclusão (terminal fica aberto); sucesso se não lançou exceção
    void proc.exited;
    return true;
  } catch { /* WSL2 não disponível */ }

  // Tentativa 2: x-terminal-emulator (Linux desktop)
  try {
    Bun.spawn(
      ['x-terminal-emulator', '-e', `bash -c "${cmd.replace(/"/g, '\\"')}"`],
      { stdout: 'pipe', stderr: 'pipe', stdin: null },
    );
    return true;
  } catch { /* ignora */ }

  // Tentativa 3: gnome-terminal
  try {
    Bun.spawn(
      ['gnome-terminal', '--', 'bash', '-c', `${cmd}; exec bash`],
      { stdout: 'pipe', stderr: 'pipe', stdin: null },
    );
    return true;
  } catch { /* ignora */ }

  return false;
}

// ── Fork para Claude Code ─────────────────────────────────────────────────────

export async function exportConversationToFile(
  id: string,
): Promise<{ path: string; command: string; sessionId: string; opened: boolean } | null> {
  const messages = getConversation(id);
  if (messages.length === 0) return null;

  // Lê projectDir desta conversa específica (ou homedir como fallback)
  const meta = getConversationMeta(id);
  const cwd = meta?.projectDir ?? homedir();

  // Claude nomeia dirs substituindo '/' e '.' por '-'
  const projectHash = cwd.replace(/[/.]/g, '-');
  const sessionDir = join(homedir(), '.claude', 'projects', projectHash);
  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });

  const sessionId = randomUUID();
  const sessionFile = join(sessionDir, `${sessionId}.jsonl`);

  const lines: string[] = [];
  let prevUuid: string | null = null;

  for (const msg of messages) {
    const uuid = randomUUID();
    const timestamp = new Date(msg.ts).toISOString();
    const base = {
      parentUuid: prevUuid,
      isSidechain: false,
      uuid,
      timestamp,
      permissionMode: 'default',
      userType: 'external',
      entrypoint: 'sdk-cli',
      cwd,
      sessionId,
      version: '2.1.90',
    };

    if (msg.role === 'user') {
      lines.push(JSON.stringify({ ...base, type: 'user', message: { role: 'user', content: msg.content } }));
    } else {
      lines.push(JSON.stringify({ ...base, type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: msg.content }] } }));
    }

    prevUuid = uuid;
  }

  writeFileSync(sessionFile, lines.join('\n') + '\n');

  // Salva forkedSessionId na meta da conversa
  if (meta) {
    const index = readIndex();
    const m = index.find(x => x.id === id);
    if (m) {
      m.forkedSessionId = sessionId;
      m.forkedProjectDir = cwd;
      writeIndex(index);
    }
  }

  // Tenta abrir terminal automaticamente
  const opened = await openInTerminal(sessionId, cwd);

  return {
    path: cwd,
    sessionId,
    command: `claude --resume ${sessionId}`,
    opened,
  };
}
