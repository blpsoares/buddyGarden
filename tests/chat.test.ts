import { describe, it, expect } from 'bun:test';
import { buildSystemPrompt, compressHistory } from '../server/chat.ts';
import type { Soul, BuddyBones } from '../server/buddy.ts';
import type { SessionStats } from '../server/sessions.ts';

// ── Fixtures ────────────────────────────────────────────────────────────────────

const mockSoul: Soul = {
  name: 'Drako',
  personality: 'sarcástico e caótico, ama resolver bugs impossíveis',
};

const mockBones: BuddyBones = {
  species: 'dragon',
  rarity: 'epic',
  eye: '◉',
  hat: 'wizard',
  stats: { debugging: 85, patience: 30, chaos: 90, wisdom: 70, snark: 95 },
  isShiny: true,
  seed: 42,
};

const mockStats: SessionStats = {
  today: 3,
  total: 50,
  streak: 7,
  xp: 5_000,
  level: 'Hatchling',
  levelProgress: 0.05,
  xpForCurrentLevel: 0,
  xpForNextLevel: 100_000,
  last7Days: [1, 2, 3, 1, 2, 3, 3],
  claude: { sessionsToday: 2, sessionsTotal: 40, messagesTotal: 200, last7Days: [1, 1, 2, 1, 2, 2, 2] },
  buddy: { sessionsToday: 1, sessionsTotal: 10, messagesTotal: 50, last7Days: [0, 1, 1, 0, 0, 1, 1] },
};

// ── buildSystemPrompt ───────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('inclui o nome do buddy no prompt', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats);
    expect(prompt).toContain('Drako');
  });

  it('inclui a espécie', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats);
    expect(prompt).toContain('dragon');
  });

  it('inclui a raridade', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats);
    expect(prompt).toContain('epic');
  });

  it('inclui os valores dos stats', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats);
    expect(prompt).toContain('85');  // debugging
    expect(prompt).toContain('30');  // patience
    expect(prompt).toContain('90');  // chaos
  });

  it('menciona shiny quando isShiny=true', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats);
    expect(prompt.toLowerCase()).toContain('shiny');
  });

  it('não menciona shiny quando isShiny=false', () => {
    const bonesNoShiny = { ...mockBones, isShiny: false };
    const prompt = buildSystemPrompt(mockSoul, bonesNoShiny, mockStats);
    expect(prompt.toLowerCase()).not.toContain('shiny');
  });

  it('inclui hat quando não é "none"', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats);
    expect(prompt).toContain('wizard');
  });

  it('não menciona hat quando é "none"', () => {
    const bonesNoHat = { ...mockBones, hat: 'none' };
    const prompt = buildSystemPrompt(mockSoul, bonesNoHat, mockStats);
    expect(prompt).not.toContain('chapéu none');
  });

  it('instrução de idioma pt', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats, 'anthropic', 'pt');
    expect(prompt).toContain('português');
  });

  it('instrução de idioma en', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats, 'anthropic', 'en');
    expect(prompt).toContain('English');
  });

  it('inclui contexto de project dirs quando fornecido', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats, 'anthropic', 'pt', undefined, ['/home/user/proj']);
    expect(prompt).toContain('/home/user/proj');
  });

  it('inclui contexto de projeto quando fornecido', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats, 'anthropic', 'pt', 'contexto_especial_xyz');
    expect(prompt).toContain('contexto_especial_xyz');
  });

  it('instrução de bash block para claude-cli', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats, 'claude-cli');
    expect(prompt).toContain('bash');
  });

  it('sem instrução de bash block para anthropic', () => {
    const promptA = buildSystemPrompt(mockSoul, mockBones, mockStats, 'anthropic');
    const promptC = buildSystemPrompt(mockSoul, mockBones, mockStats, 'claude-cli');
    // claude-cli tem instruções extras de bash; anthropic não tem
    expect(promptC.length).toBeGreaterThan(promptA.length);
  });

  it('funciona sem soul (soul=null)', () => {
    const prompt = buildSystemPrompt(null, mockBones, mockStats);
    expect(prompt).toContain('Buddy'); // nome padrão
    expect(prompt).toContain('dragon');
  });

  it('personalidade da soul aparece no prompt', () => {
    const prompt = buildSystemPrompt(mockSoul, mockBones, mockStats);
    expect(prompt).toContain('sarcástico e caótico');
  });
});

// ── compressHistory ─────────────────────────────────────────────────────────────

type Msg = { role: 'user' | 'assistant'; content: string };

function makeHistory(n: number, longContent = false): Msg[] {
  return Array.from({ length: n }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: longContent
      ? `Mensagem longa número ${i} — ${'x'.repeat(200)}`
      : `msg ${i}`,
  }));
}

describe('compressHistory', () => {
  it('histórico curto retorna sem alteração', () => {
    const history = makeHistory(5);
    const result = compressHistory(history);
    expect(result).toEqual(history);
  });

  it('histórico com poucos tokens não comprime (≤ KEEP_TAIL)', () => {
    const history = makeHistory(10);
    const result = compressHistory(history);
    expect(result).toEqual(history);
  });

  it('histórico longo e volumoso é comprimido', () => {
    // 30 mensagens com conteúdo longo (~200 chars cada) → ~1500 tokens estimados > 3000? Não.
    // Precisamos de conteúdo > 3000 tokens estimados (chars/4 > 3000 → chars > 12000)
    // 30 mensagens com 500 chars cada = 15000 chars / 4 = 3750 tokens > 3000
    const history = Array.from({ length: 30 }, (_, i): Msg => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i} — ${'y'.repeat(500)}`,
    }));
    const result = compressHistory(history);
    // Deve ter menos mensagens que o original
    expect(result.length).toBeLessThan(history.length);
  });

  it('após compressão, tail de KEEP_TAIL (6) mensagens é preservado', () => {
    const history = Array.from({ length: 30 }, (_, i): Msg => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg-${i} ${'z'.repeat(500)}`,
    }));
    const result = compressHistory(history);
    // As últimas 6 mensagens do original devem aparecer no final do resultado
    const tail = history.slice(-6);
    const resultTail = result.slice(-6);
    expect(resultTail).toEqual(tail);
  });

  it('primeira mensagem após compressão é o resumo (role=user)', () => {
    const history = Array.from({ length: 30 }, (_, i): Msg => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg-${i} ${'z'.repeat(500)}`,
    }));
    const result = compressHistory(history);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toContain('Resumo');
  });

  it('resumo contém trechos das mensagens antigas', () => {
    const history = Array.from({ length: 25 }, (_, i): Msg => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `mensagem_especial_${i} ${'w'.repeat(500)}`,
    }));
    const result = compressHistory(history);
    // Resumo deve conter pelo menos algo das primeiras mensagens
    expect(result[0].content).toContain('mensagem_especial_0');
  });

  it('array vazio retorna array vazio', () => {
    expect(compressHistory([])).toEqual([]);
  });

  it('1 mensagem retorna sem alteração', () => {
    const history: Msg[] = [{ role: 'user', content: 'olá' }];
    expect(compressHistory(history)).toEqual(history);
  });
});
