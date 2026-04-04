import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const GARDEN_DIR = join(homedir(), '.buddy-garden');
const CONV_DIR = join(GARDEN_DIR, 'conversations');
const INDEX_PATH = join(CONV_DIR, 'index.json');

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  projectDirs?: string[];     // pastas de contexto desta conversa (múltiplas)
  projectDir?: string;        // DEPRECATED: mantido para compat com dados antigos
  forkedSessionId?: string;   // se fork para Claude: sessionId
  forkedProjectDir?: string;  // se fork para Claude: cwd do projeto
}

/** Retorna as pastas de contexto de uma conversa, migrando o campo antigo se necessário. */
export function getConversationProjectDirs(meta: ConversationMeta | null): string[] {
  if (!meta) return [];
  if (meta.projectDirs?.length) return meta.projectDirs;
  if (meta.projectDir) return [meta.projectDir]; // migração de dados antigos
  return [];
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

export function createConversation(firstMessage: string, projectDirs?: string[]): ConversationMeta {
  ensureDir();
  const id = randomUUID();
  const now = Date.now();
  const title = firstMessage.length > 60 ? firstMessage.slice(0, 57) + '...' : firstMessage;
  const validDirs = (projectDirs ?? []).filter(d => existsSync(d));
  const meta: ConversationMeta = {
    id, title, createdAt: now, updatedAt: now, messageCount: 0,
    ...(validDirs.length ? { projectDirs: validDirs } : {}),
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

export function setConversationProjectDirs(id: string, dirs: string[]) {
  const index = readIndex();
  const meta = index.find(m => m.id === id);
  if (!meta) return;
  const validDirs = dirs.filter(d => existsSync(d));
  if (validDirs.length > 0) {
    meta.projectDirs = validDirs;
  } else {
    delete meta.projectDirs;
  }
  delete meta.projectDir; // migra campo legado
  meta.updatedAt = Date.now();
  writeIndex(index);
}

// ── Auto-open terminal (WSL2 / Linux) ────────────────────────────────────────

async function openInTerminal(sessionId: string, cwd: string): Promise<boolean> {
  const safeDir = cwd.replace(/'/g, "'\\''");
  const cmd = `cd '${safeDir}' && claude --resume ${sessionId}`;

  // Tentativa 1: x-terminal-emulator (Linux desktop)
  try {
    Bun.spawn(
      ['x-terminal-emulator', '-e', `bash -c "${cmd.replace(/"/g, '\\"')}"`],
      { stdout: 'pipe', stderr: 'pipe', stdin: null },
    );
    return true;
  } catch { /* ignora */ }

  // Tentativa 2: gnome-terminal
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

  // Lê projectDirs desta conversa específica (ou homedir como fallback)
  const meta = getConversationMeta(id);
  const projectDirs = getConversationProjectDirs(meta);
  const cwd = projectDirs[0] ?? homedir();

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
