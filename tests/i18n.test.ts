import { describe, it, expect } from 'bun:test';
import { t, type TKey } from '../client/src/i18n.ts';

// ── t() — função de tradução ────────────────────────────────────────────────────

describe('t — idioma pt', () => {
  it('retorna tradução correta para chave existente em pt', () => {
    expect(t('pt', 'navGarden')).toBe('Jardim');
  });

  it('retorna tradução correta para chave de chat em pt', () => {
    expect(t('pt', 'chatPlaceholder')).toBe('mensagem...');
  });

  it('retorna tradução de stat em pt', () => {
    expect(t('pt', 'statsDebugging')).toBe('DEBUGGING');
  });

  it('retorna tradução de tier Hatchling em pt', () => {
    expect(t('pt', 'tierHatchling')).toBe('🥚 Hatchling');
  });

  it('retorna tradução de loading em pt', () => {
    expect(t('pt', 'loading')).toBe('Carregando...');
  });
});

describe('t — idioma en', () => {
  it('retorna tradução correta para chave existente em en', () => {
    expect(t('en', 'navGarden')).toBe('Garden');
  });

  it('retorna tradução correta para chave de chat em en', () => {
    expect(t('en', 'chatPlaceholder')).toBe('message...');
  });

  it('loading em en', () => {
    expect(t('en', 'loading')).toBe('Loading...');
  });

  it('tier Juvenile diferente entre pt e en', () => {
    expect(t('pt', 'tierJuvenile')).toBe('🐣 Jovem');
    expect(t('en', 'tierJuvenile')).toBe('🐣 Juvenile');
  });

  it('statsDebugging igual nos dois idiomas (sigla)', () => {
    expect(t('pt', 'statsDebugging')).toBe(t('en', 'statsDebugging'));
  });
});

describe('t — cobertura de chaves', () => {
  const allKeys: TKey[] = [
    'navGarden', 'navBuddy', 'navPlay', 'navChat', 'navStats',
    'loading', 'noBuddyTitle', 'statsBtn', 'chatBtn', 'buddyModeBtn',
    'chatPlaceholder', 'chatWaiting', 'chatSendBtn',
    'statsTitle', 'statsSpecies', 'statsRarity', 'statsShiny',
    'statsPeak', 'statsValley', 'statsXP', 'statsLevel',
    'tierHatchling', 'tierJuvenile', 'tierAdult', 'tierElder', 'tierAncient',
    'archetypeDetective', 'archetypeWise', 'archetypeTrickster',
    'archetypeOracle', 'archetypeCritic',
    'providerClaudeCli', 'providerAnthropic', 'providerGemini',
    'playPet', 'playFetch', 'playTrick',
  ];

  it('todas as chaves têm valor em pt (não retorna undefined/vazio)', () => {
    for (const key of allKeys) {
      const val = t('pt', key);
      expect(val).toBeTruthy();
    }
  });

  it('todas as chaves têm valor em en (não retorna undefined/vazio)', () => {
    for (const key of allKeys) {
      const val = t('en', key);
      expect(val).toBeTruthy();
    }
  });

  it('pt e en têm valores distintos em pelo menos alguns casos de UI', () => {
    // Se os dois idiomas fossem idênticos em tudo, algo estaria errado
    const ptGarden = t('pt', 'navGarden');
    const enGarden = t('en', 'navGarden');
    expect(ptGarden).not.toBe(enGarden);
  });
});

describe('t — consistência de pares pt/en', () => {
  const pairedKeys: Array<[TKey, string, string]> = [
    ['navChat', 'Chat', 'Chat'],                      // mesmo nos dois
    ['navStats', 'Stats', 'Stats'],                    // mesmo nos dois
    ['chatSendBtn', '▶', '▶'],                         // mesmo nos dois
    ['statsBack', '← jardim', '← garden'],
    ['statsStreak', 'sequência', 'streak'],
    ['gardenChatSaveYes', 'Sim', 'Yes'],
    ['gardenChatSaveNo', 'Não', 'No'],
    ['exportTitle', 'Exportado!', 'Exported!'],
  ];

  for (const [key, ptExpected, enExpected] of pairedKeys) {
    it(`${key}: pt="${ptExpected}" | en="${enExpected}"`, () => {
      expect(t('pt', key)).toBe(ptExpected);
      expect(t('en', key)).toBe(enExpected);
    });
  }
});
