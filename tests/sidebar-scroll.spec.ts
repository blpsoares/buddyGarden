import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../test-results/sidebar-conversas');

test('scroll sidebar to see CONVERSAS section', async ({ page }) => {
  // Navigate and go to chat
  await page.goto('http://localhost:7892/');
  await page.waitForTimeout(1000);

  const chatTabBtn = page.locator('button[title="Chat"]');
  if (await chatTabBtn.count() > 0) {
    await chatTabBtn.click();
  }
  await page.waitForTimeout(1000);

  // Enable Claude sessions if needed
  const menuBtn = page.locator('button[title="Mais opções"]');
  if (await menuBtn.count() > 0) {
    await menuBtn.click();
    await page.waitForTimeout(400);
    const claudeBtn = page.locator('button').filter({ hasText: /Sessões do Claude/ });
    if (await claudeBtn.count() > 0) {
      const btnText = await claudeBtn.first().textContent();
      if (btnText?.includes('oculto')) {
        await claudeBtn.first().click();
        console.log('Enabled Claude sessions');
      } else {
        console.log('Claude sessions already visible');
        await page.keyboard.press('Escape');
      }
    }
  }
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Screenshot with sidebar visible - full state
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '06-clean-state.png'),
    fullPage: false,
  });
  console.log('Screenshot 06 - clean state with sections');

  // Scroll the sidebar down to see CONVERSAS
  const sidebarScrollArea = page.locator('div').filter({ hasText: /PROJETOS/ }).first();
  await page.evaluate(() => {
    // Find scrollable element containing PROJETOS
    const els = Array.from(document.querySelectorAll('div'));
    for (const el of els) {
      if (el.scrollHeight > el.clientHeight && el.textContent?.includes('PROJETOS') && el.textContent?.includes('CONVERSAS')) {
        el.scrollTop = 500;
        return;
      }
    }
    // Fallback: scroll body
    window.scrollBy(0, 300);
  });
  await page.waitForTimeout(300);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '07-scrolled-down.png'),
    fullPage: false,
  });
  console.log('Screenshot 07 - scrolled down to see CONVERSAS');

  // Verify CONVERSAS items contain Claude sessions
  const conversasSectionInfo = await page.evaluate(() => {
    const allText = document.body.innerText;
    const lines = allText.split('\n').map(l => l.trim()).filter(Boolean);

    const projetosIdx = lines.findIndex(l => l === 'PROJETOS');
    const conversasIdx = lines.findIndex(l => l === 'CONVERSAS');

    const claudeIconCount = document.querySelectorAll('img[alt="Claude"]').length;
    const buddyIconCount = document.querySelectorAll('img[alt="Buddy"]').length;

    return {
      projetosLine: projetosIdx,
      conversasLine: conversasIdx,
      claudeIconCount,
      buddyIconCount,
      textAroundConversas: conversasIdx >= 0 ? lines.slice(conversasIdx, conversasIdx + 10) : [],
      textAroundProjetos: projetosIdx >= 0 ? lines.slice(projetosIdx, projetosIdx + 5) : [],
    };
  });

  console.log('\n=== SECTION ANALYSIS ===');
  console.log(`PROJETOS at line: ${conversasSectionInfo.projetosLine}`);
  console.log(`CONVERSAS at line: ${conversasSectionInfo.conversasLine}`);
  console.log(`Claude icons in sidebar: ${conversasSectionInfo.claudeIconCount}`);
  console.log(`Buddy icons in sidebar: ${conversasSectionInfo.buddyIconCount}`);
  console.log(`Lines after PROJETOS:`, conversasSectionInfo.textAroundProjetos);
  console.log(`Lines after CONVERSAS:`, conversasSectionInfo.textAroundConversas);

  // Report pass/fail
  const projetosVisible = conversasSectionInfo.projetosLine >= 0;
  const conversasVisible = conversasSectionInfo.conversasLine >= 0;
  const hasClaudeSessions = conversasSectionInfo.claudeIconCount > 0;

  console.log('\n=== FINAL VERDICT ===');
  console.log(`[${projetosVisible ? 'PASS' : 'FAIL'}] PROJETOS section exists`);
  console.log(`[${conversasVisible ? 'PASS' : 'FAIL'}] CONVERSAS section exists`);
  console.log(`[${hasClaudeSessions ? 'PASS' : 'FAIL'}] Claude sessions shown (${conversasSectionInfo.claudeIconCount} icons)`);
  console.log(`[${conversasSectionInfo.buddyIconCount > 0 ? 'PASS' : 'FAIL'}] Buddy sessions shown (${conversasSectionInfo.buddyIconCount} icons)`);

  const conversasHasClaudeItems = conversasSectionInfo.textAroundConversas.some(l =>
    l.includes('msgs') || l.includes(':') || l.length > 5
  );
  console.log(`[${conversasHasClaudeItems ? 'PASS' : 'UNKNOWN'}] CONVERSAS shows items`);
});
