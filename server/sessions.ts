import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// --- Types ---
export interface SourceStats {
  sessionsToday: number;
  sessionsTotal: number;
  messagesTotal: number;
  last7Days: number[]; // sessões por dia (mais recente = index 6)
}

export interface SessionStats {
  // Visão combinada (padrão)
  today: number;
  total: number;
  streak: number;
  xp: number;
  level: LevelTier;
  levelProgress: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  last7Days: number[];
  // Detalhamento por fonte
  claude: SourceStats;
  buddy: SourceStats;
}

export type LevelTier = 'Hatchling' | 'Juvenile' | 'Adult' | 'Elder' | 'Ancient';

// --- Level tiers ---
const TIERS: Array<{ name: LevelTier; minXp: number }> = [
  { name: 'Hatchling', minXp: 0 },
  { name: 'Juvenile',  minXp: 100_000 },
  { name: 'Adult',     minXp: 1_000_000 },
  { name: 'Elder',     minXp: 10_000_000 },
  { name: 'Ancient',   minXp: 100_000_000 },
];

export function getLevel(xp: number): { tier: LevelTier; progress: number; current: number; next: number } {
  let tierIdx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (xp >= (TIERS[i]?.minXp ?? 0)) {
      tierIdx = i;
      break;
    }
  }
  const current = TIERS[tierIdx]?.minXp ?? 0;
  const next = TIERS[tierIdx + 1]?.minXp ?? current;
  const tier = TIERS[tierIdx]?.name ?? 'Hatchling';
  const progress = next > current ? (xp - current) / (next - current) : 1;
  return { tier, progress: Math.min(progress, 1), current, next };
}

// --- Progress file ---
interface ProgressData {
  xp: number;
  lastUpdated: string;
}

const BUDDY_DIR = join(homedir(), '.buddy-land');
const PROGRESS_FILE = join(BUDDY_DIR, 'progress.json');

function readProgress(): ProgressData {
  try {
    if (existsSync(PROGRESS_FILE)) {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')) as ProgressData;
    }
  } catch {
    // ignore
  }
  return { xp: 0, lastUpdated: new Date().toISOString() };
}

function saveProgress(data: ProgressData): void {
  if (!existsSync(BUDDY_DIR)) {
    mkdirSync(BUDDY_DIR, { recursive: true });
  }
  writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

// --- Scan JSONL logs (Claude Code sessions) ---
interface LogLine {
  timestamp?: string;
  tokens?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  type?: string;
  sessionId?: string;
  session_id?: string;
}

function getClaudeProjectsDir(): string {
  return join(homedir(), '.claude', 'projects');
}

// Claude Code nomeia os diretórios de projeto substituindo '/' e '.' por '-'
// Ex: /home/user/.buddy-garden/tmp → -home-user--buddy-garden-tmp
// Excluímos esse dir para não contar as chamadas internas do buddy como sessões do usuário.
function getBuddyTmpDirName(): string {
  return join(homedir(), '.buddy-garden', 'tmp').replace(/[/.]/g, '-');
}

function scanClaudeLogs(): {
  sessions: Map<string, string>;   // key → date
  totalTokens: number;
  messagesTotal: number;
} {
  const projectsDir = getClaudeProjectsDir();
  const sessions = new Map<string, string>();
  let totalTokens = 0;
  let messagesTotal = 0;
  const buddyTmpDir = getBuddyTmpDirName();

  if (!existsSync(projectsDir)) return { sessions, totalTokens, messagesTotal };

  function scanDir(dir: string) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === buddyTmpDir) continue; // ignora sessões internas do buddy
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            for (const line of lines) {
              try {
                const obj = JSON.parse(line) as LogLine;
                const sid = obj.sessionId ?? obj.session_id ?? obj.type;
                const ts = obj.timestamp;
                const date = ts ? ts.slice(0, 10) : new Date().toISOString().slice(0, 10);

                if (sid && ts) {
                  sessions.set(sid + date, date);
                }

                // Count user messages (type === 'user')
                if (obj.type === 'user') {
                  messagesTotal++;
                }

                // Count tokens
                if (obj.usage) {
                  totalTokens += (obj.usage.input_tokens ?? 0)
                    + (obj.usage.output_tokens ?? 0)
                    + (obj.usage.cache_read_input_tokens ?? 0)
                    + (obj.usage.cache_creation_input_tokens ?? 0);
                } else if (obj.tokens) {
                  totalTokens += obj.tokens;
                }
              } catch {
                // skip malformed lines
              }
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    } catch {
      // skip unreadable dirs
    }
  }

  scanDir(projectsDir);
  return { sessions, totalTokens, messagesTotal };
}

// --- Scan Buddy conversations ---
interface ConvMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

const GARDEN_DIR = join(homedir(), '.buddy-garden');
const CONV_INDEX = join(GARDEN_DIR, 'conversations', 'index.json');

function scanBuddyConversations(): {
  sessions: Map<string, string>;   // convId → date (by updatedAt)
  messagesTotal: number;
} {
  const sessions = new Map<string, string>();
  let messagesTotal = 0;

  try {
    if (!existsSync(CONV_INDEX)) return { sessions, messagesTotal };
    const convs = JSON.parse(readFileSync(CONV_INDEX, 'utf-8')) as ConvMeta[];
    for (const conv of convs) {
      const date = new Date(conv.updatedAt).toISOString().slice(0, 10);
      sessions.set(conv.id + date, date);
      messagesTotal += conv.messageCount;
    }
  } catch {
    // ignore
  }

  return { sessions, messagesTotal };
}

// --- Compute streak ---
export function computeStreak(dates: Set<string>): number {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    if (dates.has(ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

// --- Build last7Days array ---
export function buildLast7Days(sessionDates: Map<string, string>): number[] {
  const last7: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    last7.push([...sessionDates.values()].filter(v => v === ds).length);
  }
  return last7;
}

// --- Main export ---
export function computeSessionStats(): SessionStats {
  const { sessions: claudeSessions, totalTokens, messagesTotal: claudeMessages } = scanClaudeLogs();
  const { sessions: buddySessions, messagesTotal: buddyMessages } = scanBuddyConversations();

  const todayStr = new Date().toISOString().slice(0, 10);

  // Claude stats
  const claudeUniqueDates = new Set<string>(claudeSessions.values());
  const claudeSessTotal = claudeSessions.size;
  const claudeSessToday = [...claudeSessions.values()].filter(d => d === todayStr).length;
  const claudeLast7 = buildLast7Days(claudeSessions);
  const streak = computeStreak(claudeUniqueDates);

  // Buddy stats
  const buddySessTotal = buddySessions.size;
  const buddySessToday = [...buddySessions.values()].filter(d => d === todayStr).length;
  const buddyLast7 = buildLast7Days(buddySessions);

  // Combined
  const combinedSessions = new Map([...claudeSessions, ...buddySessions]);
  const combinedToday = claudeSessToday + buddySessToday;
  const combinedTotal = claudeSessTotal + buddySessTotal;
  const combinedLast7 = claudeLast7.map((v, i) => v + (buddyLast7[i] ?? 0));

  // XP: tokens * 0.001 + sessions * 50, multiplied by streak
  const streakMultiplier = 1.0 + Math.min(streak - 1, 6) * (1.0 / 6.0);
  const rawXp = totalTokens * 0.001 + claudeSessTotal * 50;
  const xp = Math.floor(rawXp * streakMultiplier);

  // Save progress
  const prog = readProgress();
  const finalXp = Math.max(prog.xp, xp);
  saveProgress({ xp: finalXp, lastUpdated: new Date().toISOString() });

  const lvl = getLevel(finalXp);

  return {
    today: combinedToday,
    total: combinedTotal,
    streak,
    xp: finalXp,
    level: lvl.tier,
    levelProgress: lvl.progress,
    xpForCurrentLevel: lvl.current,
    xpForNextLevel: lvl.next,
    last7Days: combinedLast7,
    claude: {
      sessionsToday: claudeSessToday,
      sessionsTotal: claudeSessTotal,
      messagesTotal: claudeMessages,
      last7Days: claudeLast7,
    },
    buddy: {
      sessionsToday: buddySessToday,
      sessionsTotal: buddySessTotal,
      messagesTotal: buddyMessages,
      last7Days: buddyLast7,
    },
  };
}
