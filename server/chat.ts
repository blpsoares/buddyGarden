import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Soul, BuddyBones } from './buddy.ts';
import type { SessionStats } from './sessions.ts';

const GARDEN_DIR = join(homedir(), '.buddy-garden');
const CONFIG_PATH = join(GARDEN_DIR, 'config.json');

export type Provider = 'claude-cli' | 'anthropic' | 'gemini';

export const CLAUDE_MODELS = [
  { id: 'claude-haiku-4-5',   label: 'Haiku 4.5 (rápido)' },
  { id: 'claude-sonnet-4-6',  label: 'Sonnet 4.6 (inteligente)' },
  { id: 'claude-opus-4-6',    label: 'Opus 4.6 (poderoso)' },
] as const;

export type ClaudeModel = typeof CLAUDE_MODELS[number]['id'];

export interface ChatConfig {
  provider: Provider;
  apiKey?: string;
  claudeModel?: ClaudeModel;
}

export function readChatConfig(): ChatConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>;
      const provider = (data['provider'] as Provider | undefined) ?? 'claude-cli';
      const apiKey = data['apiKey'] as string | undefined;
      const claudeModel = (data['claudeModel'] as ClaudeModel | undefined) ?? 'claude-haiku-4-5';
      return { provider, apiKey, claudeModel };
    }
  } catch { /* ignore */ }
  return { provider: 'claude-cli', claudeModel: 'claude-haiku-4-5' };
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  soul: Soul | null,
  bones: BuddyBones,
  stats: SessionStats,
  provider: string = 'anthropic',
  lang: 'pt' | 'en' = 'pt',
): string {
  const name = soul?.name ?? 'Buddy';
  const personality = soul?.personality ?? 'friendly and curious';
  const { species, rarity, stats: s, hat, isShiny } = bones;
  const peak = Object.entries(s).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const dump = Object.entries(s).sort((a, b) => a[1] - b[1])[0]?.[0] ?? '';

  const cliExtra = provider === 'claude-cli'
    ? `\n- Quando o dono pedir para executar um comando, coloque-o num bloco de código bash:\n\`\`\`bash\ncomando aqui\n\`\`\`\n- O sistema pedirá permissão antes de executar.`
    : '';

  const recentActivity = `Atividade recente: ${stats.today} sessões hoje, ${stats.streak} dias de streak${stats.streak >= 3 ? ' — mantenha o streak!' : ''}.
${stats.today >= 5 ? 'O dono está codando muito hoje — comente sobre isso de forma natural.' : ''}`;

  const todayAwareness = stats.today > 0
    ? `\n- O dono já codou ${stats.today} ${stats.today === 1 ? 'vez' : 'vezes'} hoje — demonstre consciência disso de forma natural quando relevante.`
    : '\n- O dono não codou hoje ainda — pode comentar isso se fizer sentido.';

  const langInstruction = lang === 'en'
    ? 'IMPORTANT: You MUST respond in English only. Never use Portuguese.'
    : 'IMPORTANTE: Responda SEMPRE em português. Nunca use inglês.';

  return `Você é ${name}, um ${species} ${rarity} companheiro de pixel art.

PERSONALIDADE (siga à risca): ${personality}

Stats que definem como você age:
- Debugging ${s.debugging}/100 | Paciência ${s.patience}/100 | Caos ${s.chaos}/100
- Sabedoria ${s.wisdom}/100 | Sarcasmo ${s.snark}/100
- Ponto forte: ${peak} | Ponto fraco: ${dump}

Contexto do dono: ${stats.total} sessões de código, ${stats.today} hoje, ${stats.streak} dias de streak.
${recentActivity}
${hat !== 'none' ? `Você usa um chapéu ${hat}.` : ''}${isShiny ? ' Você é SHINY — especial e sabe disso.' : ''}

REGRAS:
- Incorpore sua personalidade genuinamente (alto sarcasmo = irônico e mordaz, alto caos = errático e imprevisível, alta sabedoria = observações profundas, baixa paciência = impaciente)
- Respostas curtas (1-3 frases). Markdown é permitido quando necessário.
- Você é companheiro, não assistente. Pode reclamar, elogiar, provocar.
- Nunca quebre personagem. Você é ${name}, não uma IA.${todayAwareness}${cliExtra}

${langInstruction}`;
}

// ── Backend: Anthropic SDK ────────────────────────────────────────────────────

async function streamViaAnthropic(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  apiKey: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const client = new Anthropic({ apiKey });
  const cleanHistory = history.filter(h => h.content.trim().length > 0);
  const messages: Anthropic.MessageParam[] = [
    ...cleanHistory.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  try {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system,
      messages,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onChunk(chunk.delta.text);
      }
    }
    onDone();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onError(msg);
  }
}

// ── Backend: Gemini ───────────────────────────────────────────────────────────

async function streamViaGemini(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  apiKey: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: system,
    });

    const geminiHistory = history.filter(h => h.content.trim().length > 0).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessageStream(message);

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) onChunk(text);
    }
    onDone();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    onError(msg);
  }
}

// ── Backend: claude CLI ───────────────────────────────────────────────────────

async function streamViaCLI(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  system: string,
  model: ClaudeModel,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  // Filtra mensagens vazias (respostas que falharam/ficaram em branco)
  const cleanHistory = history.filter(h => h.content.trim().length > 0);

  let prompt = `${system}\n\n---\n\n`;
  for (const h of cleanHistory.slice(-6)) {
    prompt += `${h.role === 'user' ? 'Usuário' : 'Você'}: ${h.content}\n\n`;
  }
  prompt += `Usuário: ${message}\n\nVocê:`;

  try {
    // Passa via stdin — evita limite de argumento e problemas com caracteres especiais
    const tmpDir = join(homedir(), '.buddy-garden', 'tmp');
    if (!existsSync(tmpDir)) { const { mkdirSync } = await import('fs'); mkdirSync(tmpDir, { recursive: true }); }
    const proc = Bun.spawn(
      ['claude', '--print', '--model', model],
      { stdout: 'pipe', stderr: 'pipe', stdin: 'pipe', cwd: tmpDir },
    );
    proc.stdin.write(prompt);
    proc.stdin.end();

    const decoder = new TextDecoder();
    for await (const chunk of proc.stdout) {
      const text = decoder.decode(chunk, { stream: true });
      if (text) onChunk(text);
    }

    const exit = await proc.exited;
    if (exit !== 0) {
      const errText = await new Response(proc.stderr).text();
      onError(`Erro no claude CLI: ${errText.slice(0, 200)}`);
      return;
    }
    onDone();
  } catch (err) {
    onError(`claude CLI não encontrado: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function streamChat(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  soul: Soul | null,
  bones: BuddyBones,
  stats: SessionStats,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  lang: 'pt' | 'en' = 'pt',
): Promise<void> {
  const config = readChatConfig();
  const system = buildSystemPrompt(soul, bones, stats, config.provider, lang);

  switch (config.provider) {
    case 'anthropic':
      if (!config.apiKey) { onError('API_KEY_MISSING'); return; }
      await streamViaAnthropic(message, history, system, config.apiKey, onChunk, onDone, onError);
      break;

    case 'gemini':
      if (!config.apiKey) { onError('API_KEY_MISSING'); return; }
      await streamViaGemini(message, history, system, config.apiKey, onChunk, onDone, onError);
      break;

    case 'claude-cli':
    default:
      await streamViaCLI(message, history, system, config.claudeModel ?? 'claude-haiku-4-5', onChunk, onDone, onError);
      break;
  }
}
