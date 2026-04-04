import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../test-results/sidebar-conversas');

test('final sidebar state with Claude sessions enabled', async ({ page }) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  await page.goto('http://localhost:7892/');
  await page.waitForTimeout(1200);

  // Go to Chat
  const chatTabBtn = page.locator('button[title="Chat"]');
  await chatTabBtn.click();
  await page.waitForTimeout(1200);

  // Check current state of Claude sessions (don't open menu yet)
  const pageText = await page.evaluate(() => document.body.innerText);
  const hasConversas = pageText.includes('CONVERSAS');
  const hasProjetos = pageText.includes('PROJETOS');
  console.log(`Initial state: PROJETOS=${hasProjetos}, CONVERSAS=${hasConversas}`);

  // If Claude sessions not yet enabled, enable them
  const menuBtn = page.locator('button[title="Mais opções"]');
  await menuBtn.click();
  await page.waitForTimeout(400);

  const claudeBtn = page.locator('button').filter({ hasText: /Sessões do Claude/ });
  const btnText = await claudeBtn.first().textContent();
  console.log(`Claude sessions menu text: "${btnText}"`);

  if (btnText?.includes('oculto')) {
    await claudeBtn.first().click();
    console.log('Enabled Claude sessions');
    await page.waitForTimeout(500);
    // Now close menu by clicking outside
    await page.mouse.click(600, 300);
    await page.waitForTimeout(400);
  } else {
    // Already enabled — close menu
    await page.mouse.click(600, 300);
    await page.waitForTimeout(400);
  }

  // Screenshot: clean state with both sections
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '08-both-sections-clean.png'),
    fullPage: false,
  });
  console.log('Screenshot 08 - both sections clean');

  // Now: open menu again, take screenshot showing menu state
  await menuBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '09-menu-with-claude-enabled.png'),
    fullPage: false,
  });
  console.log('Screenshot 09 - menu showing Claude as enabled');

  // Close menu
  await page.mouse.click(600, 300);
  await page.waitForTimeout(400);

  // Click › chevron next to PROJETOS to toggle all projects
  const projetosRow = page.locator('div').filter({ hasText: /^PROJETOS$/ });
  const chevronBtn = projetosRow.locator('button').first();
  if (await chevronBtn.count() > 0) {
    await chevronBtn.click();
    console.log('Toggled PROJETOS expand/collapse');
    await page.waitForTimeout(400);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '10-projetos-toggled.png'),
    fullPage: false,
  });
  console.log('Screenshot 10 - PROJETOS toggled');

  // Scroll sidebar to show CONVERSAS section
  await page.evaluate(() => {
    const scrollables = Array.from(document.querySelectorAll('div')).filter(el =>
      el.scrollHeight > el.clientHeight && el.scrollHeight > 200
    );
    // Find the one that has the sidebar content
    const sidebar = scrollables.find(el =>
      el.textContent?.includes('CONVERSAS') && el.textContent?.includes('PROJETOS')
    );
    if (sidebar) {
      // Find CONVERSAS label and scroll to it
      const els = sidebar.querySelectorAll('*');
      for (const el of els) {
        if (el.textContent?.trim() === 'CONVERSAS' && el.tagName !== 'SPAN') {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
          return;
        }
      }
      sidebar.scrollTop += 400;
    }
  });
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '11-conversas-visible.png'),
    fullPage: false,
  });
  console.log('Screenshot 11 - scrolled to show CONVERSAS section');

  // Final analysis
  const finalInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const conversasIdx = lines.findIndex(l => l === 'CONVERSAS');
    const projetosIdx = lines.findIndex(l => l === 'PROJETOS');

    const claudeIcons = document.querySelectorAll('img[alt="Claude"]').length;
    const buddyIcons = document.querySelectorAll('img[alt="Buddy"]').length;

    // Look for flat items in CONVERSAS — items after CONVERSAS label
    const conversasItems = conversasIdx >= 0 ? lines.slice(conversasIdx + 1, conversasIdx + 20) : [];

    return {
      projetosIdx,
      conversasIdx,
      claudeIcons,
      buddyIcons,
      conversasItems,
      // Check if "Você é Crux" or other buddy items appear in CONVERSAS
      buddyInConversas: conversasItems.some(l => l.includes('Crux') || l.includes('msgs')),
      claudeInConversas: conversasItems.some(l => l.includes('msgs') || l.includes(':')),
    };
  });

  console.log('\n=== FINAL ANALYSIS ===');
  console.log(`PROJETOS at text line: ${finalInfo.projetosIdx}`);
  console.log(`CONVERSAS at text line: ${finalInfo.conversasIdx}`);
  console.log(`Claude icons total: ${finalInfo.claudeIcons}`);
  console.log(`Buddy icons total: ${finalInfo.buddyIcons}`);
  console.log(`Items after CONVERSAS label:`, finalInfo.conversasItems.slice(0, 8));
  console.log(`Buddy items in CONVERSAS: ${finalInfo.buddyInConversas}`);
  console.log(`Claude items in CONVERSAS: ${finalInfo.claudeInConversas}`);

  console.log('\n=== PASS/FAIL REPORT ===');
  console.log(`[${finalInfo.projetosIdx >= 0 ? 'PASS' : 'FAIL'}] PROJETOS section rendered`);
  console.log(`[${finalInfo.conversasIdx >= 0 ? 'PASS' : 'FAIL'}] CONVERSAS section rendered`);
  console.log(`[${finalInfo.claudeIcons > 0 ? 'PASS' : 'FAIL'}] Claude sessions visible in sidebar (${finalInfo.claudeIcons} icons)`);
  console.log(`[${finalInfo.buddyIcons > 0 ? 'PASS' : 'FAIL'}] Buddy sessions visible (${finalInfo.buddyIcons} icons)`);
  console.log(`[${finalInfo.buddyInConversas || finalInfo.claudeInConversas ? 'PASS' : 'FAIL'}] CONVERSAS section has items`);
  console.log(`[${finalInfo.conversasIdx > finalInfo.projetosIdx ? 'PASS' : 'FAIL'}] CONVERSAS appears AFTER PROJETOS in DOM order`);

  console.log(`\nAll screenshots: ${SCREENSHOT_DIR}`);
});
