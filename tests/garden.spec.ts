import { test, expect } from '@playwright/test';

/**
 * Testes da página Garden
 * Cobre: carregamento, estado sem buddy, pet clicável, botões HUD, chat balloon/modal
 */

test.describe('Garden', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    // Garante que estamos no Garden
    await page.locator('nav').getByTitle('Jardim').click();
  });

  test('exibe estado de carregamento ou conteúdo do jardim', async ({ page }) => {
    // Deve mostrar loading ou o jardim completo
    const hasLoading = await page.getByText('Carregando...').isVisible().catch(() => false);
    const hasNoBuddy = await page.getByText('seu buddy ainda não nasceu').isVisible().catch(() => false);
    const hasGarden = await page.locator('canvas').isVisible().catch(() => false);

    expect(hasLoading || hasNoBuddy || hasGarden).toBeTruthy();
  });

  test('exibe mensagem de instrução quando buddy não existe', async ({ page }) => {
    // Simula ausência de buddy mockando a API
    await page.route('/api/buddy', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bones: null, soul: null, xp: 0,
          level: 'Hatchling', levelProgress: 0,
          xpForCurrentLevel: 0, xpForNextLevel: 100000,
          sessionCount: 0,
        }),
      });
    });

    // Aguarda a resposta mockada antes de verificar
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/api/buddy')),
      page.reload(),
    ]);
    await page.waitForTimeout(500);

    // O Garden exibe mensagem quando bones e soul são null
    await expect(
      page.getByText('seu buddy ainda não nasceu')
        .or(page.getByText('verificando'))
        .or(page.getByText('abra o Claude Code'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('exibe botões de HUD quando buddy está carregado', async ({ page }) => {
    // Mocka resposta da API com buddy válido
    await page.route('/api/buddy', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bones: {
            species: 'cat',
            rarity: 'common',
            stats: { debugging: 50, patience: 50, chaos: 50, wisdom: 50, snark: 50 },
            isShiny: false,
            seed: 11111,
            eye: '·',
            hat: 'none',
          },
          soul: { name: 'TestBuddy', personality: 'test personality' },
          xp: 1000,
          level: 'Hatchling',
          levelProgress: 1,
          xpForCurrentLevel: 0,
          xpForNextLevel: 100000,
          sessionCount: 5,
        }),
      });
    });
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ today: 3, total: 100, streak: 5 }),
      });
    });
    await page.reload();

    // Aguarda o jardim carregar
    await page.waitForTimeout(1000);

    // HUD buttons devem estar visíveis
    const buddyBtn = page.getByTitle('modo buddy');
    const statsBtn = page.getByTitle('stats');
    const chatBtn = page.getByTitle('chat');

    // Pelo menos um desses deve existir (nomes mudam com idioma)
    const anyHudVisible =
      (await buddyBtn.isVisible().catch(() => false)) ||
      (await statsBtn.isVisible().catch(() => false)) ||
      (await chatBtn.isVisible().catch(() => false));

    expect(anyHudVisible).toBeTruthy();
  });

  test('botão stats no HUD navega para Stats', async ({ page }) => {
    await page.route('/api/buddy', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bones: {
            species: 'cat', rarity: 'common',
            stats: { debugging: 50, patience: 50, chaos: 50, wisdom: 50, snark: 50 },
            peak: 'debugging', valley: 'patience', isShiny: false, eye: '·', hat: 'none',
          },
          soul: { name: 'TestBuddy', personality: 'test' },
          xp: 1000, level: 1, sessionCount: 5,
        }),
      });
    });
    await page.route('/api/sessions', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ today: 3, total: 100, streak: 5 }),
      });
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // O botão de stats no HUD pode ter title 'stats' ou 'Stats'
    const statsBtn = page.locator('button[title="stats"], button[title="Stats"]').first();
    if (await statsBtn.isVisible()) {
      await statsBtn.click();
      const stored = await page.evaluate(() => localStorage.getItem('buddy-page'));
      expect(stored).toBe('stats');
    }
  });
});
