import dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';

async function debug() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ storageState: 'data/auth-state.json' });
  const page = await context.newPage();

  // Aadithya V has a summary
  await page.goto('https://matchmaking.grip.events/manifestvegas2026/app/profile/13008592', {
    waitUntil: 'networkidle', timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Click all Show more
  for (let i = 0; i < 5; i++) {
    try {
      const btn = page.locator('button:has-text("Show more")').first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        await page.waitForTimeout(1500);
      } else break;
    } catch { break; }
  }

  // Check for summary text
  const summaryData = await page.evaluate(() => {
    // Check all RTMs for Summary
    const rtms = document.querySelectorAll('app-profile-rtm-display');
    const rtmSummaries: any[] = [];
    for (const rtm of rtms) {
      const label = rtm.querySelector('span.has-text-color-primary')?.textContent?.trim() || '';
      if (label === 'Summary') {
        rtmSummaries.push({
          label,
          fullText: rtm.textContent?.trim().substring(0, 200),
          inSponsor: !!rtm.closest('[data-test="companyContainer"]'),
          html: rtm.innerHTML.substring(0, 500),
        });
      }
    }

    // Check the info container for summary-like text
    const infoContainer = document.querySelector('[data-test="infoContainer"]');
    let infoSummary = '';
    if (infoContainer) {
      const text = (infoContainer as HTMLElement).innerText;
      // Look for summary text (non-structured biographical text)
      const lines = text.split('\n').filter(l => l.trim().length > 50);
      infoSummary = lines.join('\n');
    }

    // Check the "Summary" visible on the page
    const allText = document.body.innerText;
    const summaryMatch = allText.match(/Summary\n([\s\S]+?)(?=\n(?:Company Services|Region|Interested|Sponsor|Details|Show less|$))/);

    return {
      rtmSummaries,
      infoSummaryPreview: infoSummary.substring(0, 300),
      summaryMatchText: summaryMatch?.[1]?.trim().substring(0, 300) || 'NO MATCH',
    };
  });

  console.log('\n=== Summary debug ===');
  console.log(JSON.stringify(summaryData, null, 2));

  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
}

debug().catch(console.error);
