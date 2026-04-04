import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../test-results/sidebar-conversas');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

test.describe('Sidebar CONVERSAS section', () => {
  test.beforeAll(() => {
    ensureDir(SCREENSHOT_DIR);
  });

  test('verifica CONVERSAS e PROJETOS no sidebar do chat', async ({ page }) => {
    // Step 1: Navigate to the app root
    await page.goto('http://localhost:7892/');
    await page.waitForTimeout(1500);

    // Navigate to Chat tab — look for button with title "Chat"
    const chatTabBtn = page.locator('button[title="Chat"]');
    if (await chatTabBtn.count() > 0) {
      await chatTabBtn.click();
    } else {
      // Fallback: click button containing "Chat" text
      await page.locator('button').filter({ hasText: /^Chat$/ }).first().click();
    }
    await page.waitForTimeout(1500);

    // Step 2: Screenshot initial state
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-initial.png'),
      fullPage: false,
    });
    console.log('Screenshot 01 - initial chat state taken');

    // Step 3: Find and click the ··· menu button (title="Mais opções")
    const menuBtn = page.locator('button[title="Mais opções"]');
    const menuBtnCount = await menuBtn.count();
    console.log(`Menu button (Mais opções) found: ${menuBtnCount} times`);

    if (menuBtnCount > 0) {
      await menuBtn.first().click();
      console.log('Clicked ··· menu button');
    } else {
      // Dump all buttons for debugging
      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button')).map(b => ({
          text: b.textContent?.trim().substring(0, 40),
          title: b.title,
          ariaLabel: b.getAttribute('aria-label'),
        }));
      });
      console.log('All buttons:', JSON.stringify(buttons, null, 2));
    }

    await page.waitForTimeout(500);

    // Step 4: Screenshot of open menu
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-menu-open.png'),
      fullPage: false,
    });
    console.log('Screenshot 02 - menu open taken');

    // Check current state of Sessões do Claude before clicking
    const claudeSessionText = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent?.includes('Sessões do Claude'));
      if (!btn) return null;
      return {
        text: btn.textContent?.trim(),
        visible: btn.offsetParent !== null,
      };
    });
    console.log('Sessões do Claude button state:', JSON.stringify(claudeSessionText));

    // Step 5: Click "Sessões do Claude" to enable Claude sessions
    const sessionBtn = page.locator('button').filter({ hasText: /Sess.*Claude|Claude.*Sess/i });
    const sessionBtnCount = await sessionBtn.count();
    console.log(`"Sessões do Claude" button count: ${sessionBtnCount}`);

    if (sessionBtnCount > 0) {
      // Check if it shows "oculto" (disabled) — we want to enable it if off
      const btnText = await sessionBtn.first().textContent();
      console.log(`Current button state text: "${btnText}"`);

      if (btnText?.includes('oculto')) {
        await sessionBtn.first().click();
        console.log('Clicked to ENABLE Sessões do Claude (was hidden)');
      } else if (btnText?.includes('visível')) {
        console.log('Sessões do Claude is already visible — no click needed');
        // Close menu without changing
        await page.keyboard.press('Escape');
        // Reopen to take a proper screenshot
        await page.waitForTimeout(300);
      } else {
        await sessionBtn.first().click();
        console.log('Clicked Sessões do Claude (unknown state)');
      }
    } else {
      console.log('WARNING: Could not find "Sessões do Claude" button in menu');
      await page.keyboard.press('Escape');
    }

    await page.waitForTimeout(500);

    // Step 6: Close the menu (press Escape or click elsewhere)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Step 7: Screenshot of sidebar with sections
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-sidebar-with-sections.png'),
      fullPage: false,
    });
    console.log('Screenshot 03 - sidebar after enabling Claude sessions');

    // Verify PROJETOS and CONVERSAS sections
    const projetosCount = await page.locator('text=PROJETOS').count();
    const conversasCount = await page.locator('text=CONVERSAS').count();

    console.log(`\n=== SIDEBAR SECTIONS ===`);
    console.log(`PROJETOS section: ${projetosCount > 0 ? 'VISIBLE' : 'NOT FOUND'}`);
    console.log(`CONVERSAS section: ${conversasCount > 0 ? 'VISIBLE' : 'NOT FOUND'}`);

    // Extract sidebar HTML for detailed inspection
    const sidebarInfo = await page.evaluate(() => {
      // Try to find the conversation list area
      const sections: string[] = [];
      const allText = document.body.innerText;

      // Look for PROJETOS and CONVERSAS labels
      const hasProjetos = allText.includes('PROJETOS');
      const hasConversas = allText.includes('CONVERSAS');

      // Count conversation items (items with image titles containing 'Buddy Garden' or 'Claude Code')
      const items = Array.from(document.querySelectorAll('div[style*="overflow: hidden"]'));
      const convItems = items.filter(el => {
        const img = el.querySelector('img');
        return img?.title?.includes('Buddy Garden') || img?.title?.includes('Claude Code');
      });

      // Look for project folder items
      const folderItems = document.querySelectorAll('img[title*="Claude Code"]');

      // Look for items in CONVERSAS section (flat list)
      // All items in the flat list
      const allConvDivs = Array.from(document.querySelectorAll('div')).filter(d => {
        const img = d.querySelector('img');
        return img && (img.getAttribute('alt') === 'Buddy' || img.getAttribute('alt') === 'Claude');
      });

      return {
        hasProjetos,
        hasConversas,
        conversationItemCount: convItems.length,
        claudeItemCount: folderItems.length,
        allConvDivCount: allConvDivs.length,
        // Extract text from CONVERSAS section area
        textSample: allText.substring(0, 2000),
      };
    });

    console.log('\n=== DETAILED SIDEBAR INFO ===');
    console.log(`Has PROJETOS: ${sidebarInfo.hasProjetos}`);
    console.log(`Has CONVERSAS: ${sidebarInfo.hasConversas}`);
    console.log(`Conversation items found: ${sidebarInfo.conversationItemCount}`);
    console.log(`Claude icon items: ${sidebarInfo.claudeItemCount}`);
    console.log(`All conv div count: ${sidebarInfo.allConvDivCount}`);

    // Step 8: Click the ChevronRight button next to PROJETOS to toggle expand/collapse
    if (projetosCount > 0) {
      // The PROJETOS label has a chevron button next to it
      const projetosLabel = page.locator('text=PROJETOS');
      const projetosParent = projetosLabel.locator('..');
      const chevronInProjetos = projetosParent.locator('button').first();

      if (await chevronInProjetos.count() > 0) {
        await chevronInProjetos.click();
        console.log('Clicked chevron button next to PROJETOS');
      } else {
        console.log('Could not find chevron button in PROJETOS section');
        // Try clicking in the container that has PROJETOS
        const projetosContainer = page.locator('div').filter({ hasText: /^PROJETOS$/ }).first();
        const chevronBtn = projetosContainer.locator('button').first();
        if (await chevronBtn.count() > 0) {
          await chevronBtn.click();
          console.log('Clicked chevron (alt method)');
        }
      }
    } else {
      console.log('PROJETOS not visible — skipping chevron click');
    }

    await page.waitForTimeout(500);

    // Step 9: Screenshot after chevron click
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-after-chevron.png'),
      fullPage: false,
    });
    console.log('Screenshot 04 - after chevron toggle');

    // Step 10: Final full page screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-full-page.png'),
      fullPage: true,
    });

    // Final summary
    const finalState = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasProjetos: text.includes('PROJETOS'),
        hasConversas: text.includes('CONVERSAS'),
        text: text.substring(0, 3000),
      };
    });

    console.log('\n=== FINAL REPORT ===');
    console.log(`PROJETOS section visible: ${finalState.hasProjetos}`);
    console.log(`CONVERSAS section visible: ${finalState.hasConversas}`);
    console.log(`\nPage text (first 1000 chars):\n${finalState.text.substring(0, 1000)}`);
    console.log(`\nAll screenshots saved to: ${SCREENSHOT_DIR}`);
  });
});
