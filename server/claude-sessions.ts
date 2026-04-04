import { existsSync, readdirSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

export interface ClaudeSessionMeta {
  sessionId: string;
  projectHash: string;
  projectDir: string;   // cwd real do projeto
  title: string;        // primeira mensagem do usuário
  messageCount: number;
  lastActivity: number; // timestamp ms da última mensagem
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

function extractTextContent(raw: string | Array<{ type: string; text?: string }>): string {
  if (typeof raw === 'string') return raw;
  return (raw as Array<{ type: string; text?: string }>)
    .filter(c => c.type === 'text' && c.text)
    .map(c => c.text!)
    .join('');
}

export function listClaudeSessions(): ClaudeSessionMeta[] {
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return [];

  const sessions: ClaudeSessionMeta[] = [];

  let projectHashes: string[];
  try {
    projectHashes = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch { return []; }

  for (const projectHash of projectHashes) {
    const projectDir = join(CLAUDE_PROJECTS_DIR, projectHash);
    let files: string[];
    try {
      files = readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
    } catch { continue; }

    for (const file of files) {
      const sessionId = file.replace('.jsonl', '');
      const filePath = join(projectDir, file);

      let lines: string[];
      try {
        lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);
      } catch { continue; }

      if (lines.length === 0) continue;

      let resolvedCwd = '';
      let title = '';
      let lastTs = 0;
      let messageCount = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as {
            type?: string;
            cwd?: string;
            timestamp?: string;
            message?: { role?: string; content?: string | Array<{ type: string; text?: string }> };
          };

          if (entry.cwd && !resolvedCwd) resolvedCwd = entry.cwd;

          if (entry.timestamp) {
            const ts = new Date(entry.timestamp).getTime();
            if (!isNaN(ts) && ts > lastTs) lastTs = ts;
          }

          if (entry.type === 'user' || entry.type === 'assistant') {
            messageCount++;
            if (!title && entry.type === 'user' && entry.message?.content) {
              const text = extractTextContent(entry.message.content as string | Array<{ type: string; text?: string }>);
              title = text.length > 60 ? text.slice(0, 57) + '...' : text;
            }
          }
        } catch { /* pula linha malformada */ }
      }

      if (messageCount === 0) continue;

      sessions.push({
        sessionId,
        projectHash,
        projectDir: resolvedCwd || projectHash,
        title: title || '(sem título)',
        messageCount,
        lastActivity: lastTs,
      });
    }
  }

  return sessions.sort((a, b) => b.lastActivity - a.lastActivity);
}

export function getClaudeSessionMessages(projectHash: string, sessionId: string): ClaudeMessage[] {
  const filePath = join(CLAUDE_PROJECTS_DIR, projectHash, `${sessionId}.jsonl`);
  if (!existsSync(filePath)) return [];

  const messages: ClaudeMessage[] = [];
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as {
        type?: string;
        timestamp?: string;
        message?: { role?: string; content?: string | Array<{ type: string; text?: string }> };
      };
      if (entry.type !== 'user' && entry.type !== 'assistant') continue;
      if (!entry.message?.content) continue;

      const content = extractTextContent(entry.message.content as string | Array<{ type: string; text?: string }>);
      if (!content.trim()) continue; // pula tool_use, tool_result e msgs vazias
      const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now();
      messages.push({ role: entry.message.role as 'user' | 'assistant', content, ts });
    } catch { /* pula */ }
  }

  return messages;
}
