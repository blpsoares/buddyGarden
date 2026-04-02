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

export function getConversation(id: string): ConversationMessage[] {
  const filePath = join(CONV_DIR, `${id}.jsonl`);
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as ConversationMessage);
}

export function createConversation(firstMessage: string): ConversationMeta {
  ensureDir();
  const id = randomUUID();
  const now = Date.now();
  const title = firstMessage.length > 60 ? firstMessage.slice(0, 57) + '...' : firstMessage;
  const meta: ConversationMeta = { id, title, createdAt: now, updatedAt: now, messageCount: 0 };
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
