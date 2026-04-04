import { test, expect } from '@playwright/test';

test('debug: screenshot do chat', async ({ page }) => {
  await page.route('/api/config', async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ provider: 'claude-cli', lang: 'pt', claudeModel: '' }),
    });
  });
  await page.route('/api/conversations', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    } else { await route.continue(); }
  });

  await page.goto('/');
  await page.locator('nav').getByTitle('Chat').click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'tests/debug-chat.png', fullPage: true });

  const html = await page.locator('nav ~ main').innerHTML();
  console.log('Main HTML snippet:', html.substring(0, 500));
});
