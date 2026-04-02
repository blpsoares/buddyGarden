#!/usr/bin/env bun
/**
 * buddy-land CLI — conversa com seu buddy direto no terminal
 *
 * Uso:
 *   bun run cli/chat.ts "oi crux"         → resposta única e sai
 *   bun run cli/chat.ts                   → modo REPL interativo
 *   bunx buddy-land-chat "mensagem"       (quando publicado)
 */

import Anthropic from '@anthropic-ai/sdk';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { createInterface } from 'readline';
import { generateBones, readSoul, readUserId, detectSpeciesFromPersonality } from '../server/buddy.ts';
import { computeSessionStats } from '../server/sessions.ts';
import type { BuddyBones, Soul } from '../server/buddy.ts';
import type { SessionStats } from '../server/sessions.ts';

// --- Cores ANSI ---
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  purple:  '\x1b[35m',
  cyan:    '\x1b[36m',
  yellow:  '\x1b[33m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  gray:    '\x1b[90m',
  white:   '\x1b[97m',
};

// --- Config ---
const CONFIG_PATH = join(homedir(), '.buddy-land', 'config.json');

function readApiKey(): string | null {
  try {
    if (!existsSync(CONFIG_PATH)) return null;
    const d = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, unknown>;
    return (d['apiKey'] as string | undefined) ?? null;
  } catch { return null; }
}

// --- System prompt ---
function buildSystemPrompt(soul: Soul | null, bones: BuddyBones, stats: SessionStats): string {
  const name = soul?.name ?? 'Buddy';
  const personality = soul?.personality ?? 'friendly and curious';
  const { species, rarity, stats: s, hat, isShiny } = bones;

  return `Você é ${name}, um ${species} ${rarity} que vive no buddy.land — o jardim virtual do seu dono.

Personalidade: ${personality}

Stats de RPG:
- Debugging: ${s.debugging}/100
- Paciência: ${s.patience}/100
- Caos: ${s.chaos}/100
- Sabedoria: ${s.wisdom}/100
- Sarcasmo: ${s.snark}/100

Chapéu: "${hat}"${isShiny ? ' | SHINY ✨' : ''}
Seu dono tem ${stats.total} sessões no total, ${stats.today} hoje, streak de ${stats.streak} dias.

Regras:
- Fale de acordo com seus stats. Alto sarcasmo = mais irônico. Alto caos = errático. Alta sabedoria = filosófico.
- Você é companheiro, não assistente técnico. Pode dar opiniões, reclamar, elogiar.
- Respostas curtas a médias (1-4 frases). Nunca quebre personagem.
- Estamos no terminal — sem markdown, sem formatação especial.`;
}

// --- Banner ---
function printBanner(soul: Soul | null, bones: BuddyBones, stats: SessionStats) {
  const name = soul?.name ?? 'Buddy';
  const rarityColor = {
    common: c.gray, uncommon: c.green, rare: c.cyan, epic: c.purple, legendary: c.yellow,
  }[bones.rarity] ?? c.white;

  console.log('');
  console.log(`  ${c.bold}${c.purple}buddy.land${c.reset} ${c.gray}─ terminal chat${c.reset}`);
  console.log(`  ${rarityColor}${c.bold}${name}${c.reset}  ${rarityColor}[${bones.rarity.toUpperCase()}]${c.reset}  ${c.gray}${bones.species}${c.reset}${bones.isShiny ? ` ${c.yellow}✨ shiny${c.reset}` : ''}`);
  console.log(`  ${c.gray}xp ${stats.xp.toLocaleString('pt-BR')}  ·  ${stats.level}  ·  streak ${stats.streak}d${c.reset}`);
  console.log(`  ${c.dim}─────────────────────────────────${c.reset}`);
  console.log('');
}

// --- Main ---
async function main() {
  const apiKey = readApiKey();
  if (!apiKey) {
    console.error(`\n  ${c.red}${c.bold}Sem API key configurada.${c.reset}`);
    console.error(`  Crie ${c.cyan}~/.buddy-land/config.json${c.reset} com:`);
    console.error(`  ${c.gray}{ "apiKey": "sk-ant-..." }${c.reset}\n`);
    console.error(`  Ou use o buddy.land web (${c.cyan}bun run dev${c.reset}) e configure pela UI.\n`);
    process.exit(1);
  }

  const userId = readUserId();
  const soul = readSoul();
  let bones = userId ? generateBones(userId) : generateBones('anonymous');
  if (soul?.personality) {
    const detected = detectSpeciesFromPersonality(soul.personality);
    if (detected) bones = { ...bones, species: detected };
  }
  const stats = computeSessionStats();

  const client = new Anthropic({ apiKey });
  const systemPrompt = buildSystemPrompt(soul, bones, stats);
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Modo single-shot: bun run cli/chat.ts "mensagem"
  const singleMessage = process.argv.slice(2).join(' ').trim();
  if (singleMessage) {
    printBanner(soul, bones, stats);
    await sendMessage(client, systemPrompt, history, singleMessage, soul);
    console.log('');
    return;
  }

  // Modo REPL interativo
  printBanner(soul, bones, stats);
  console.log(`  ${c.dim}ctrl+c ou "sair" para encerrar${c.reset}`);
  console.log('');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const prompt = () => {
    const name = soul?.name ?? 'buddy';
    process.stdout.write(`${c.cyan}você${c.reset} › `);
  };

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) { prompt(); return; }
    if (text.toLowerCase() === 'sair' || text.toLowerCase() === 'exit') {
      console.log(`\n  ${c.gray}até mais! o ${soul?.name ?? 'buddy'} fica aqui te esperando.${c.reset}\n`);
      process.exit(0);
    }

    rl.pause();
    await sendMessage(client, systemPrompt, history, text, soul);
    console.log('');
    rl.resume();
    prompt();
  });

  rl.on('close', () => {
    console.log(`\n  ${c.gray}tchau!${c.reset}\n`);
    process.exit(0);
  });

  prompt();
}

async function sendMessage(
  client: Anthropic,
  system: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  text: string,
  soul: Soul | null,
) {
  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: text },
  ];

  const name = soul?.name ?? 'buddy';
  process.stdout.write(`\n${c.purple}${c.bold}${name}${c.reset} › `);

  let fullResponse = '';
  try {
    const stream = client.messages.stream({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system,
      messages,
    });

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        process.stdout.write(chunk.delta.text);
        fullResponse += chunk.delta.text;
      }
    }
  } catch (e) {
    process.stdout.write(`${c.red}[erro: ${e instanceof Error ? e.message : String(e)}]${c.reset}`);
    return;
  }

  // Salva no histórico
  history.push({ role: 'user', content: text });
  history.push({ role: 'assistant', content: fullResponse });

  // Limita histórico a 20 mensagens (10 trocas)
  while (history.length > 20) history.splice(0, 2);
}

await main();
