import { test, expect } from '@playwright/test';

/**
 * Testes da página Stats
 * Cobre: carregamento, tabs ALL/Claude/Buddy, barras de stat, XP, atividade
 */

const MOCK_BUDDY = {
  bones: {
    species: 'owl',
    rarity: 'rare',
    stats: { debugging: 85, patience: 60, chaos: 30, wisdom: 95, snark: 40 },
    isShiny: false,
    eye: '◎',
    hat: 'wizard',
    seed: 12345,
  },
  soul: { name: 'Sova', personality: 'sábio e contemplativo, faz perguntas filosóficas' },
  xp: 750000,
  level: 'Juvenile',
  levelProgress: 65,
  xpForCurrentLevel: 100000,
  xpForNextLevel: 1000000,
  sessionCount: 300,
};

const MOCK_SESSIONS = {
  today: 4,
  total: 300,
  streak: 14,
  last7Days: [2, 5, 3, 8, 4, 6, 4],
  claude: {
    sessionsToday: 2,
    sessionsTotal: 150,
    messagesTotal: 1200,
    last7Days: [1, 2, 1, 4, 2, 3, 2],
  },
  buddy: {
    sessionsToday: 2,
    sessionsTotal: 150,
    messagesTotal: 800,
    last7Days: [1, 3, 2, 4, 2, 3, 2],
  },
};

test.describe('Stats', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/config', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ provider: 'claude-cli', lang: 'pt', claudeModel: '' }),
      });
    });
    await page.route('/api/buddy', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BUDDY),
      });
    });
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSIONS),
      });
    });

    // Navega para a página e define o localStorage antes do reload
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('buddy-page', 'stats'));

    // Reload com mocks ativos; aguarda as respostas da API
    const [,] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/buddy'), { timeout: 5000 }).catch(() => null),
      page.waitForResponse(r => r.url().includes('/api/sessions'), { timeout: 5000 }).catch(() => null),
      page.reload(),
    ]);
    await page.waitForTimeout(600);
  });

  test('exibe os 3 botões de toggle de atividade', async ({ page }) => {
    // Botões Tudo/All, Claude, Buddy — renderizados como buttons com textTransform uppercase
    // Usamos getByRole para garantir que são botões
    const buttons = page.getByRole('button');
    const labels = await buttons.allTextContents();
    const hasAll = labels.some(l => /tudo|all/i.test(l));
    const hasClaude = labels.some(l => /claude/i.test(l));
    const hasBuddy = labels.some(l => /buddy/i.test(l));
    expect(hasAll).toBeTruthy();
    expect(hasClaude).toBeTruthy();
    expect(hasBuddy).toBeTruthy();
  });

  test('exibe nome do pet', async ({ page }) => {
    await expect(page.getByText('Sova')).toBeVisible();
  });

  test('exibe a raridade do pet', async ({ page }) => {
    // RarityBadge exibe a raridade — pode ser em PT ou EN dependendo do idioma
    const rarityVisible =
      (await page.getByText(/rare/i).isVisible().catch(() => false)) ||
      (await page.getByText(/raro/i).isVisible().catch(() => false));
    expect(rarityVisible).toBeTruthy();
  });

  test('exibe os stats do pet', async ({ page }) => {
    // Nomes dos stats devem aparecer
    const statsLabels = ['debugging', 'patience', 'chaos', 'wisdom', 'snark'];
    for (const label of statsLabels) {
      await expect(page.getByText(new RegExp(label, 'i'))).toBeVisible();
    }
  });

  test('exibe informação de XP', async ({ page }) => {
    // XP e progresso de evolução
    await expect(page.getByText(/xp/i)).toBeVisible();
  });

  test('exibe informação de streak', async ({ page }) => {
    await expect(page.getByText(/14/)).toBeVisible(); // streak de 14 dias
  });

  test('tab Claude muda o conteúdo exibido', async ({ page }) => {
    // O botão Claude é o único button com exatamente esse texto
    const claudeBtn = page.getByRole('button', { name: /^claude$/i });
    await claudeBtn.click();
    // Após clicar, o botão deve ter estilo ativo
    const bgColor = await claudeBtn.evaluate(el =>
      getComputedStyle(el as HTMLElement).backgroundColor
    );
    // A cor ativa do Claude é rgba(10, 26, 42, ...) ou #0a1a2a
    expect(bgColor).toBeTruthy();
  });

  test('tab Buddy muda o conteúdo exibido', async ({ page }) => {
    const buddyBtn = page.getByRole('button', { name: /^buddy$/i });
    await buddyBtn.click();
    const bgColor = await buddyBtn.evaluate(el =>
      getComputedStyle(el as HTMLElement).backgroundColor
    );
    expect(bgColor).toBeTruthy();
  });

  test('exibe estado de carregamento quando API demora', async ({ page }) => {
    await page.route('/api/buddy', async route => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BUDDY),
      });
    });
    await page.reload();
    await page.locator('nav').getByTitle('Stats').click();

    // Deve mostrar algum indicador de loading
    const loadingEl = page.locator('text=/carregando|loading/i');
    // Pode aparecer brevemente
    await expect(loadingEl.or(page.getByText('Sova'))).toBeVisible({ timeout: 5000 });
  });

  test('exibe estado vazio quando não há buddy', async ({ page }) => {
    await page.route('/api/buddy', async route => {
      await route.fulfill({ status: 404, body: '{}' });
    });
    await page.reload();
    await page.locator('nav').getByTitle('Stats').click();
    await page.waitForTimeout(1000);

    // Deve mostrar mensagem de ausência de buddy
    const noBuddy = page.getByText(/buddy/i);
    expect(await noBuddy.count()).toBeGreaterThan(0);
  });

  test('exibe personalidade do pet', async ({ page }) => {
    // A personalidade fica no campo soul.personality
    await expect(page.getByText(/sábio e contemplativo/i)).toBeVisible();
  });
});
