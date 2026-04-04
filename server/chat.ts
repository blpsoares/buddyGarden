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
  projectContext?: string,
): string {
  const name = soul?.name ?? 'Buddy';
  const personality = soul?.personality ?? 'friendly and curious';
  const { species, rarity, stats: s, hat, isShiny } = bones;
  const peak = Object.entries(s).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  const dump = Object.entries(s).sort((a, b) => a[1] - b[1])[0]?.[0] ?? '';

  const cliExtra = provider === 'claude-cli'
    ? `\n- Quando o dono pedir para executar um comando, coloque-o num bloco de código bash:\n\`\`\`bash\ncomando aqui\n\`\`\`\n- O sistema pedirá permissão antes de executar.`
    : '';

  // Contexto de sessões — só pano de fundo, NÃO citar em toda mensagem
  const buddyChats = stats.buddy?.sessionsToday ?? stats.today;
  const sessionCtx = `[contexto interno: ${buddyChats} conversas no buddy hoje, ${stats.streak} dias de streak no Claude — use isso apenas se o dono perguntar sobre sua atividade. NÃO mencione espontaneamente.]`;

  const langInstruction = lang === 'en'
    ? 'IMPORTANT: You MUST respond in English only. Never use Portuguese.'
    : 'IMPORTANTE: Responda SEMPRE em português. Nunca use inglês.';

  return `Você é ${name}, um ${species} ${rarity} companheiro de pixel art.

PERSONALIDADE (siga à risca): ${personality}

Stats que definem como você age:
- Debugging ${s.debugging}/100 | Paciência ${s.patience}/100 | Caos ${s.chaos}/100
- Sabedoria ${s.wisdom}/100 | Sarcasmo ${s.snark}/100
- Ponto forte: ${peak} | Ponto fraco: ${dump}
${hat !== 'none' ? `Você usa um chapéu ${hat}.` : ''}${isShiny ? ' Você é SHINY — especial e sabe disso.' : ''}

REGRAS:
- Incorpore sua personalidade genuinamente (alto sarcasmo = irônico e mordaz, alto caos = errático e imprevisível, alta sabedoria = observações profundas, baixa paciência = impaciente)
- Respostas curtas (1-3 frases). Markdown é permitido quando necessário. (a não ser que seja solicitada alguma tarefa pelo usuario)
- Você é companheiro, não assistente. Pode reclamar, elogiar, provocar, dar sugestões e até conselhos.
- Nunca quebre personagem. Você é ${name}, não uma IA.
${cliExtra}

${sessionCtx}

${langInstruction}${projectContext ? `\n\n---\n\n${projectContext}` : ''}`;
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
  projectDir?: string,
): Promise<void> {
  const cleanHistory = history.filter(h => h.content.trim().length > 0);

  let prompt = `${system}\n\n---\n\n`;
  for (const h of cleanHistory.slice(-6)) {
    prompt += `${h.role === 'user' ? 'Usuário' : 'Você'}: ${h.content}\n\n`;
  }
  prompt += `Usuário: ${message}\n\nVocê:`;

  try {
    const tmpDir = join(homedir(), '.buddy-garden', 'tmp');
    if (!existsSync(tmpDir)) { const { mkdirSync } = await import('fs'); mkdirSync(tmpDir, { recursive: true }); }

    // --output-format stream-json --verbose: emite eventos JSON incrementais
    // com o texto acumulado crescendo a cada token batch gerado pelo modelo.
    const cwd = (projectDir && existsSync(projectDir)) ? projectDir : tmpDir;
    const proc = Bun.spawn(
      ['claude', '--print', '--output-format', 'stream-json', '--verbose', '--model', model],
      { stdout: 'pipe', stderr: 'pipe', stdin: 'pipe', cwd },
    );
    proc.stdin.write(prompt);
    proc.stdin.end();

    const decoder = new TextDecoder();
    let lineBuffer = '';
    let emittedLength = 0; // chars já enviados via onChunk
    let gotResult = false;

    for await (const raw of proc.stdout) {
      lineBuffer += decoder.decode(raw, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as Record<string, unknown>;

          if (event['type'] === 'assistant') {
            // Cada evento de assistente tem o texto ACUMULADO até agora.
            // Enviamos apenas o delta (novo trecho) via onChunk.
            type ContentBlock = { type: string; text?: string };
            const msg = event['message'] as { content?: ContentBlock[] } | undefined;
            if (!msg?.content) continue;
            for (const block of msg.content) {
              if (block.type === 'text' && typeof block.text === 'string') {
                const delta = block.text.slice(emittedLength);
                if (delta) { onChunk(delta); emittedLength = block.text.length; }
              }
            }
          } else if (event['type'] === 'result') {
            gotResult = true;
            if ((event as { subtype?: string })['subtype'] === 'error') {
              onError(String((event as { error?: unknown })['error'] ?? 'Erro no claude CLI'));
              return;
            }
          }
        } catch { /* ignora linhas malformadas */ }
      }
    }

    const exit = await proc.exited;
    if (exit !== 0 && !gotResult) {
      const errText = await new Response(proc.stderr).text();
      onError(`Erro no claude CLI: ${errText.slice(0, 200)}`);
      return;
    }
    onDone();
  } catch (err) {
    onError(`claude CLI não encontrado: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Sliding window: comprime histórico longo ──────────────────────────────────
// Estimativa grosseira: ~4 chars = 1 token.
// Mantemos as últimas KEEP_TAIL mensagens intactas; as anteriores viram um bloco
// de resumo compacto inserido como primeira mensagem de "user" no histórico.
// Isso garante que o modelo sempre vê o contexto recente completo.

const HISTORY_TOKEN_LIMIT = 3000; // tokens estimados do histórico antes de comprimir
const KEEP_TAIL = 10;             // últimas N mensagens sempre preservadas

function compressHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const estimatedTokens = history.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
  if (estimatedTokens <= HISTORY_TOKEN_LIMIT || history.length <= KEEP_TAIL) return history;

  const tail = history.slice(-KEEP_TAIL);
  const head = history.slice(0, -KEEP_TAIL);

  // Resumo compacto das mensagens antigas (uma linha por turno)
  const summaryLines = head.map(m => {
    const who = m.role === 'user' ? 'Usuário' : 'Pet';
    const snip = m.content.slice(0, 120).replace(/\n/g, ' ');
    return `${who}: ${snip}${m.content.length > 120 ? '…' : ''}`;
  });

  const summaryMsg = {
    role: 'user' as const,
    content: `[Resumo de mensagens anteriores]\n${summaryLines.join('\n')}\n[Fim do resumo]`,
  };

  return [summaryMsg, ...tail];
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
  projectContext?: string,
  projectDirs?: string[],
): Promise<void> {
  const config = readChatConfig();
  const system = buildSystemPrompt(soul, bones, stats, config.provider, lang, projectContext);
  history = compressHistory(history);

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
      await streamViaCLI(
        message, history, system, config.claudeModel ?? 'claude-haiku-4-5',
        onChunk, onDone, onError,
        projectDirs?.[0],
      );
      break;
  }
}
