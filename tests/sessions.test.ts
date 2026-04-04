import { describe, it, expect } from 'bun:test';
import { getLevel, computeStreak, buildLast7Days } from '../server/sessions.ts';

// Helpers
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// ── getLevel ────────────────────────────────────────────────────────────────────

describe('getLevel', () => {
  it('0 XP → Hatchling', () => {
    expect(getLevel(0).tier).toBe('Hatchling');
  });

  it('100k XP exatos → Juvenile', () => {
    expect(getLevel(100_000).tier).toBe('Juvenile');
  });

  it('1M XP exatos → Adult', () => {
    expect(getLevel(1_000_000).tier).toBe('Adult');
  });

  it('10M XP exatos → Elder', () => {
    expect(getLevel(10_000_000).tier).toBe('Elder');
  });

  it('100M XP exatos → Ancient', () => {
    expect(getLevel(100_000_000).tier).toBe('Ancient');
  });

  it('99_999 XP ainda é Hatchling', () => {
    expect(getLevel(99_999).tier).toBe('Hatchling');
  });

  it('XP negativo → Hatchling sem quebrar', () => {
    expect(getLevel(-1).tier).toBe('Hatchling');
  });

  it('progresso 50% no Hatchling (50k de 100k)', () => {
    const { progress } = getLevel(50_000);
    expect(progress).toBeCloseTo(0.5, 5);
  });

  it('progresso 0% no Juvenile (100k de 100k→1M)', () => {
    const { progress } = getLevel(100_000);
    expect(progress).toBeCloseTo(0.0, 5);
  });

  it('progresso não ultrapassa 1.0 no tier máximo', () => {
    const { progress } = getLevel(999_999_999);
    expect(progress).toBe(1);
  });

  it('current e next fazem sentido', () => {
    const { current, next } = getLevel(500_000);
    expect(current).toBe(100_000);
    expect(next).toBe(1_000_000);
  });

  it('current === next no tier máximo (Ancient)', () => {
    const { current, next } = getLevel(200_000_000);
    expect(current).toBe(next);
  });
});

// ── computeStreak ───────────────────────────────────────────────────────────────

describe('computeStreak', () => {
  it('conjunto vazio → streak 0', () => {
    expect(computeStreak(new Set())).toBe(0);
  });

  it('apenas hoje → streak 1', () => {
    expect(computeStreak(new Set([dateOffset(0)]))).toBe(1);
  });

  it('apenas ontem (sem hoje) → streak 1', () => {
    // Ontem conta, pois o algoritmo tolera "hoje sem sessão" (i=0 não quebra)
    expect(computeStreak(new Set([dateOffset(1)]))).toBe(1);
  });

  it('hoje + ontem → streak 2', () => {
    const dates = new Set([dateOffset(0), dateOffset(1)]);
    expect(computeStreak(dates)).toBe(2);
  });

  it('5 dias consecutivos → streak 5', () => {
    const dates = new Set(Array.from({ length: 5 }, (_, i) => dateOffset(i)));
    expect(computeStreak(dates)).toBe(5);
  });

  it('hoje + anteontem (sem ontem) → streak 1', () => {
    const dates = new Set([dateOffset(0), dateOffset(2)]);
    expect(computeStreak(dates)).toBe(1);
  });

  it('sequência quebrada no meio → conta até a quebra', () => {
    // hoje, ontem, (pula 2 dias), há 4 dias
    const dates = new Set([dateOffset(0), dateOffset(1), dateOffset(4)]);
    expect(computeStreak(dates)).toBe(2);
  });

  it('datas muito antigas sem recentes → streak 0', () => {
    const dates = new Set([dateOffset(30), dateOffset(31)]);
    expect(computeStreak(dates)).toBe(0);
  });
});

// ── buildLast7Days ──────────────────────────────────────────────────────────────

describe('buildLast7Days', () => {
  it('mapa vazio → array de 7 zeros', () => {
    const result = buildLast7Days(new Map());
    expect(result).toHaveLength(7);
    expect(result.every(v => v === 0)).toBe(true);
  });

  it('2 sessões hoje → último elemento = 2', () => {
    const today = dateOffset(0);
    const sessions = new Map([
      ['s1', today],
      ['s2', today],
    ]);
    const result = buildLast7Days(sessions);
    expect(result[6]).toBe(2);
  });

  it('1 sessão de ontem → penúltimo elemento = 1', () => {
    const yesterday = dateOffset(1);
    const sessions = new Map([['s1', yesterday]]);
    const result = buildLast7Days(sessions);
    expect(result[5]).toBe(1);
    expect(result[6]).toBe(0);
  });

  it('sessão há 6 dias → primeiro elemento = 1', () => {
    const old = dateOffset(6);
    const sessions = new Map([['s1', old]]);
    const result = buildLast7Days(sessions);
    expect(result[0]).toBe(1);
  });

  it('sessão há 7+ dias não aparece', () => {
    const tooOld = dateOffset(7);
    const sessions = new Map([['s1', tooOld]]);
    const result = buildLast7Days(sessions);
    expect(result.every(v => v === 0)).toBe(true);
  });

  it('soma correta de múltiplas sessões por dia', () => {
    const today = dateOffset(0);
    const yesterday = dateOffset(1);
    const sessions = new Map([
      ['s1', today],
      ['s2', today],
      ['s3', today],
      ['s4', yesterday],
    ]);
    const result = buildLast7Days(sessions);
    expect(result[6]).toBe(3); // hoje
    expect(result[5]).toBe(1); // ontem
  });
});
