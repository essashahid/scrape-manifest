import dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';
import fs from 'fs';

async function debug() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ storageState: 'data/auth-state.json' });
  const page = await context.newPage();

  await page.goto('https://matchmaking.grip.events/manifestvegas2026/app/profile/16002500', {
    waitUntil: 'networkidle', timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Click all Show more
  for (let i = 0; i < 5; i++) {
    try {
      const btn = page.locator('button:has-text("Show more")').first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        console.log(`Clicked Show more #${i + 1}`);
        await page.waitForTimeout(1500);
      } else break;
    } catch { break; }
  }

  // Get the sponsor section complete HTML
  const sponsorHtml = await page.evaluate(() => {
    const container = document.querySelector('[data-test="companyContainer"]');
    return container?.innerHTML || 'NOT FOUND';
  });

  fs.writeFileSync('data/debug-sponsor-full.html', sponsorHtml);
  console.log('Full sponsor HTML saved (' + sponsorHtml.length + ' chars)');

  // All RTM displays
  const rtmData = await page.evaluate(() => {
    const rtms = document.querySelectorAll('app-profile-rtm-display');
    return Array.from(rtms).map(rtm => {
      const label = rtm.querySelector('span.has-text-color-primary')?.textContent?.trim() || '';
      const tags = Array.from(rtm.querySelectorAll('.metadata-value-tag'))
        .map(t => t.textContent?.trim()).filter(Boolean);
      return { label, tags };
    });
  });
  console.log('\n=== All RTM displays ===');
  console.log(JSON.stringify(rtmData, null, 2));

  // Extract the complete textual content of the sponsor company section
  const sponsorText = await page.evaluate(() => {
    const container = document.querySelector('[data-test="companyContainer"]');
    if (!container) return 'NOT FOUND';

    // Get company name
    const companyLink = container.querySelector('a.is-header');
    const companyName = companyLink?.textContent?.trim() || '';

    // Get all text in the container
    const allText = (container as HTMLElement).innerText;

    return { companyName, allText };
  });
  console.log('\n=== Sponsor section text ===');
  console.log(JSON.stringify(sponsorText, null, 2));

  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
}

debug().catch(console.error);
