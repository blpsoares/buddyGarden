import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// --- Types ---
export interface SessionStats {
  today: number;
  total: number;
  streak: number;
  xp: number;
  level: LevelTier;
  levelProgress: number; // 0..1 dentro do tier atual
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  last7Days: number[]; // sessões por dia (mais recente = index 6)
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

function getLevel(xp: number): { tier: LevelTier; progress: number; current: number; next: number } {
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

// --- Scan JSONL logs ---
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

function scanLogs(): { sessions: Map<string, string>; totalTokens: number } {
  const projectsDir = getClaudeProjectsDir();
  const sessions = new Map<string, string>(); // sessionId → date (YYYY-MM-DD)
  let totalTokens = 0;
  const buddyTmpDir = getBuddyTmpDirName();

  if (!existsSync(projectsDir)) return { sessions, totalTokens };

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
  return { sessions, totalTokens };
}

// --- Compute streak ---
function computeStreak(dates: Set<string>): number {
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

// --- Main export ---
export function computeSessionStats(): SessionStats {
  const { sessions, totalTokens } = scanLogs();

  const todayStr = new Date().toISOString().slice(0, 10);
  const uniqueDates = new Set<string>(sessions.values());

  const total = sessions.size;
  const today = [...sessions.values()].filter(d => d === todayStr).length;
  const streak = computeStreak(uniqueDates);
  const streakMultiplier = 1.0 + Math.min(streak - 1, 6) * (1.0 / 6.0); // 1.0 to 2.0

  // XP: tokens * 0.001 + sessions * 50, multiplied by streak
  const rawXp = totalTokens * 0.001 + total * 50;
  const xp = Math.floor(rawXp * streakMultiplier);

  // Save progress
  const prog = readProgress();
  const finalXp = Math.max(prog.xp, xp);
  saveProgress({ xp: finalXp, lastUpdated: new Date().toISOString() });

  const lvl = getLevel(finalXp);

  // Last 7 days
  const last7Days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    last7Days.push([...sessions.values()].filter(v => v === ds).length);
  }

  return {
    today,
    total,
    streak,
    xp: finalXp,
    level: lvl.tier,
    levelProgress: lvl.progress,
    xpForCurrentLevel: lvl.current,
    xpForNextLevel: lvl.next,
    last7Days,
  };
}
