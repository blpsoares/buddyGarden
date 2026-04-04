import { describe, it, expect } from 'bun:test';
import { generateBones, detectSpeciesFromPersonality } from '../server/buddy.ts';
import { SPECIES_LIST } from '../server/sprites.ts';

const VALID_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const VALID_EYES = ['·', 'o', '•', '◉', '◎', '✦', '⊙', '◦', '◈', '◉'];
const VALID_HATS = ['none', 'wizard', 'cowboy', 'crown', 'party', 'chef', 'top', 'flower', 'halo'];

describe('generateBones', () => {
  it('é determinístico — mesmo userId gera mesmos bones', () => {
    const a = generateBones('user-123');
    const b = generateBones('user-123');
    expect(a).toEqual(b);
  });

  it('userIds diferentes geram bones diferentes', () => {
    const a = generateBones('alice');
    const b = generateBones('bob');
    expect(a).not.toEqual(b);
  });

  it('retorna species válida', () => {
    const bones = generateBones('user-abc');
    expect(SPECIES_LIST).toContain(bones.species);
  });

  it('retorna rarity válida', () => {
    const bones = generateBones('user-abc');
    expect(VALID_RARITIES).toContain(bones.rarity);
  });

  it('stats ficam entre 0 e 100', () => {
    const bones = generateBones('user-xyz');
    for (const val of Object.values(bones.stats)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it('stats contém todas as 5 chaves', () => {
    const bones = generateBones('user-stats');
    expect(bones.stats).toHaveProperty('debugging');
    expect(bones.stats).toHaveProperty('patience');
    expect(bones.stats).toHaveProperty('chaos');
    expect(bones.stats).toHaveProperty('wisdom');
    expect(bones.stats).toHaveProperty('snark');
  });

  it('eye é um dos valores válidos', () => {
    const bones = generateBones('user-eye');
    expect(VALID_EYES).toContain(bones.eye);
  });

  it('hat é um dos valores válidos', () => {
    const bones = generateBones('user-hat');
    expect(VALID_HATS).toContain(bones.hat);
  });

  it('isShiny é boolean', () => {
    const bones = generateBones('user-shiny');
    expect(typeof bones.isShiny).toBe('boolean');
  });

  it('seed é number', () => {
    const bones = generateBones('user-seed');
    expect(typeof bones.seed).toBe('number');
  });

  it('string vazia não quebra', () => {
    const bones = generateBones('');
    expect(SPECIES_LIST).toContain(bones.species);
    expect(VALID_RARITIES).toContain(bones.rarity);
  });

  it('userId muito longo não quebra', () => {
    const bones = generateBones('a'.repeat(10_000));
    expect(SPECIES_LIST).toContain(bones.species);
  });

  it('distribuição de raridade — amostra de 200 userIds', () => {
    const counts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < 200; i++) {
      const bones = generateBones(`sample-user-${i}`);
      counts[bones.rarity]++;
    }
    // common deve ser a mais frequente
    expect(counts.common).toBeGreaterThan(counts.uncommon);
    expect(counts.common).toBeGreaterThan(counts.rare);
  });
});

describe('detectSpeciesFromPersonality', () => {
  it('detecta espécie no texto em minúsculas', () => {
    expect(detectSpeciesFromPersonality('I am a dragon')).toBe('dragon');
  });

  it('detecta case-insensitive (maiúsculas)', () => {
    expect(detectSpeciesFromPersonality('I am a DUCK')).toBe('duck');
  });

  it('detecta mixed case', () => {
    expect(detectSpeciesFromPersonality('A mighty Capybara')).toBe('capybara');
  });

  it('retorna null se não encontrar espécie', () => {
    expect(detectSpeciesFromPersonality('just a regular buddy')).toBeNull();
  });

  it('retorna null para string vazia', () => {
    expect(detectSpeciesFromPersonality('')).toBeNull();
  });

  it('detecta todas as espécies válidas', () => {
    for (const species of SPECIES_LIST) {
      const result = detectSpeciesFromPersonality(`I am a ${species}`);
      expect(result).not.toBeNull();
      expect(result!).toBe(species);
    }
  });

  it('detecta a primeira espécie quando há múltiplas no texto', () => {
    // O loop em SPECIES_LIST é ordenado — primeiro match ganha
    const result = detectSpeciesFromPersonality('duck and a ghost');
    expect(result).not.toBeNull();
    if (result !== null) expect(SPECIES_LIST).toContain(result);
  });
});
