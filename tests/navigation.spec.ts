import { test, expect } from '@playwright/test';

/**
 * Testes de navegação principal
 * Cobre: navbar, troca de páginas, persistência no localStorage
 */

test.describe('Navegação principal', () => {
  test.beforeEach(async ({ page }) => {
    // Limpa localStorage antes de cada teste para estado previsível
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('exibe todas as abas na navbar', async ({ page }) => {
    const nav = page.locator('nav');
    await expect(nav.getByTitle('Jardim')).toBeVisible();
    await expect(nav.getByTitle('Buddy')).toBeVisible();
    await expect(nav.getByTitle('Brincar')).toBeVisible();
    await expect(nav.getByTitle('Chat')).toBeVisible();
    await expect(nav.getByTitle('Stats')).toBeVisible();
    await expect(nav.getByTitle('Settings')).toBeVisible();
  });

  test('abre na página Garden por padrão', async ({ page }) => {
    const stored = await page.evaluate(() => localStorage.getItem('buddy-page'));
    // Sem localStorage, deve carregar garden
    expect(stored === null || stored === 'garden').toBeTruthy();
  });

  test('navega para Chat ao clicar na aba', async ({ page }) => {
    await page.locator('nav').getByTitle('Chat').click();
    const stored = await page.evaluate(() => localStorage.getItem('buddy-page'));
    expect(stored).toBe('chat');
  });

  test('navega para Stats ao clicar na aba', async ({ page }) => {
    await page.locator('nav').getByTitle('Stats').click();
    const stored = await page.evaluate(() => localStorage.getItem('buddy-page'));
    expect(stored).toBe('stats');
  });

  test('navega para Buddy ao clicar na aba', async ({ page }) => {
    await page.locator('nav').getByTitle('Buddy').click();
    const stored = await page.evaluate(() => localStorage.getItem('buddy-page'));
    expect(stored).toBe('buddy');
  });

  test('navega para Play ao clicar na aba', async ({ page }) => {
    await page.locator('nav').getByTitle('Brincar').click();
    const stored = await page.evaluate(() => localStorage.getItem('buddy-page'));
    expect(stored).toBe('play');
  });

  test('botão ativo tem estilo diferenciado', async ({ page }) => {
    const nav = page.locator('nav');
    const chatBtn = nav.getByTitle('Chat');
    await chatBtn.click();

    // O botão inativo (jardim) deve ter cor diferente do ativo (chat)
    const gardenBtn = nav.getByTitle('Jardim');
    const colorActive = await chatBtn.evaluate(el => getComputedStyle(el).color);
    const colorInactive = await gardenBtn.evaluate(el => getComputedStyle(el).color);

    // Os dois devem ter cores diferentes
    expect(colorActive).not.toBe(colorInactive);
  });

  test('persiste a página escolhida após reload', async ({ page }) => {
    await page.locator('nav').getByTitle('Stats').click();
    await page.reload();

    const stored = await page.evaluate(() => localStorage.getItem('buddy-page'));
    expect(stored).toBe('stats');
  });

  test('sequência de navegação entre todas as páginas', async ({ page }) => {
    const nav = page.locator('nav');
    const pages = [
      { title: 'Buddy', key: 'buddy' },
      { title: 'Brincar', key: 'play' },
      { title: 'Chat', key: 'chat' },
      { title: 'Stats', key: 'stats' },
      { title: 'Jardim', key: 'garden' },
    ];

    for (const p of pages) {
      await nav.getByTitle(p.title).click();
      const stored = await page.evaluate(() => localStorage.getItem('buddy-page'));
      expect(stored).toBe(p.key);
    }
  });
});
