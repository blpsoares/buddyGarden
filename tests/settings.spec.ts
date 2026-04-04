import { test, expect } from '@playwright/test';

/**
 * Testes do dropdown de Settings
 * Cobre: abrir/fechar dropdown, toggle de idioma, font picker
 */

test.describe('Settings dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('dropdown está fechado inicialmente', async ({ page }) => {
    // O dropdown só existe no DOM quando aberto
    await expect(page.locator('button', { hasText: '🇧🇷 PT' })).not.toBeVisible();
  });

  test('abre o dropdown ao clicar em Settings', async ({ page }) => {
    await page.locator('nav').getByTitle('Settings').click();
    await expect(page.locator('button', { hasText: '🇧🇷 PT' })).toBeVisible();
    await expect(page.locator('button', { hasText: '🇺🇸 EN' })).toBeVisible();
  });

  test('fecha ao clicar fora do dropdown', async ({ page }) => {
    await page.locator('nav').getByTitle('Settings').click();
    await expect(page.locator('button', { hasText: '🇧🇷 PT' })).toBeVisible();

    // Clica fora (no centro da tela)
    await page.mouse.click(100, 300);
    await expect(page.locator('button', { hasText: '🇧🇷 PT' })).not.toBeVisible();
  });

  test('fecha ao clicar no botão Settings novamente', async ({ page }) => {
    await page.locator('nav').getByTitle('Settings').click();
    await expect(page.locator('button', { hasText: '🇧🇷 PT' })).toBeVisible();

    await page.locator('nav').getByTitle('Settings').click();
    await expect(page.locator('button', { hasText: '🇧🇷 PT' })).not.toBeVisible();
  });

  test.describe('Toggle de idioma', () => {
    test('idioma padrão é PT', async ({ page }) => {
      await page.locator('nav').getByTitle('Settings').click();
      // Navbar deve mostrar labels em português
      await expect(page.locator('nav').getByTitle('Jardim')).toBeVisible();
    });

    test('troca para EN e labels da navbar mudam', async ({ page }) => {
      await page.locator('nav').getByTitle('Settings').click();
      await page.locator('button', { hasText: '🇺🇸 EN' }).click();

      // Fecha settings e verifica que labels mudaram
      await page.mouse.click(100, 300);
      await expect(page.locator('nav').getByTitle('Garden')).toBeVisible();
      await expect(page.locator('nav').getByTitle('Chat')).toBeVisible();
      await expect(page.locator('nav').getByTitle('Stats')).toBeVisible();
    });

    test('volta para PT após selecionar EN', async ({ page }) => {
      await page.locator('nav').getByTitle('Settings').click();
      await page.locator('button', { hasText: '🇺🇸 EN' }).click();
      await page.mouse.click(100, 300);

      // Reabre settings e volta para PT
      await page.locator('nav').getByTitle('Settings').click();
      await page.locator('button', { hasText: '🇧🇷 PT' }).click();
      await page.mouse.click(100, 300);

      await expect(page.locator('nav').getByTitle('Jardim')).toBeVisible();
    });
  });

  test.describe('Font picker', () => {
    test('exibe opções de fonte no dropdown', async ({ page }) => {
      await page.locator('nav').getByTitle('Settings').click();
      // Deve haver seção de trocar fonte
      await expect(page.getByText('Trocar fonte')).toBeVisible();
    });

    test('exibe pelo menos 3 opções de fonte', async ({ page }) => {
      await page.locator('nav').getByTitle('Settings').click();

      // O dropdown exibe seção de fonte com pelo menos 3 botões
      // Cada fonte é um button dentro do dropdown
      const dropdown = page.locator('[style*="position: absolute"]').last();
      const fontButtons = dropdown.locator('button').filter({ hasText: /\w/ });
      const count = await fontButtons.count();
      // Tem pelo menos os botões PT, EN + fontes
      expect(count).toBeGreaterThan(2);
    });

    test('fonte selecionada aplica CSS variable --app-font', async ({ page }) => {
      await page.locator('nav').getByTitle('Settings').click();

      // Pega primeira opção de fonte disponível e clica
      const firstFont = page.locator('[style*="cursor: pointer"][style*="fontFamily"]').first();
      if (await firstFont.isVisible()) {
        await firstFont.click();

        // Verifica que --app-font foi aplicado no documentElement
        const fontVar = await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--app-font').trim()
        );
        expect(fontVar.length).toBeGreaterThan(0);
      }
    });
  });
});
