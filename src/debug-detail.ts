import dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';
import fs from 'fs';

async function debug() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('https://matchmaking.grip.events/manifestvegas2026/event-login', { waitUntil: 'networkidle', timeout: 30000 });
  try { await page.locator('button:has-text("Accept All")').click({ timeout: 3000 }); } catch {}
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(2000);
  await page.locator('input#email').fill(process.env.GRIP_EMAIL || '');
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(2000);
  await page.locator('input#password').fill(process.env.GRIP_PASSWORD || '');
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');
  console.log('Logged in');

  // Go to list and scroll to find Load More
  await page.goto('https://matchmaking.grip.events/manifestvegas2026/app/home/network/list/121246?page=1&sort=name', {
    waitUntil: 'networkidle', timeout: 30000,
  });
  await page.waitForTimeout(3000);

  // Scroll down to check for "Load More"
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('End');
    await page.waitForTimeout(1000);
  }

  // Check for Load More or pagination
  const loadMoreCheck = await page.evaluate(() => {
    const allText = document.body.innerText;
    const hasLoadMore = allText.includes('Load More') || allText.includes('Load more');
    const hasShowMore = allText.includes('Show more');

    // Check for any pagination-like buttons
    const buttons = document.querySelectorAll('button');
    const buttonTexts: string[] = [];
    for (const btn of buttons) {
      const text = btn.textContent?.trim() || '';
      if (text) buttonTexts.push(text);
    }

    // Count profile links
    const profileLinks = document.querySelectorAll('a[href*="/app/profile/"]');
    const uniqueIds = new Set<string>();
    for (const link of profileLinks) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/profile\/(\d+)/);
      if (match) uniqueIds.add(match[1]);
    }

    return { hasLoadMore, hasShowMore, buttonTexts, uniqueAttendees: uniqueIds.size };
  });

  console.log('\nLoad more check:', JSON.stringify(loadMoreCheck, null, 2));

  // Now check the page parameter - try page=2
  console.log('\n--- Trying page=2 ---');
  await page.goto('https://matchmaking.grip.events/manifestvegas2026/app/home/network/list/121246?page=2&sort=name', {
    waitUntil: 'networkidle', timeout: 30000,
  });
  await page.waitForTimeout(3000);

  const page2Data = await page.evaluate(() => {
    const profileLinks = document.querySelectorAll('a[href*="/app/profile/"]');
    const attendees: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const link of profileLinks) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/profile\/(\d+)/);
      const name = link.textContent?.trim() || '';
      if (match && !seen.has(match[1]) && name) {
        seen.add(match[1]);
        attendees.push({ id: match[1], name });
      }
    }
    return { count: attendees.length, first3: attendees.slice(0, 3), last3: attendees.slice(-3) };
  });

  console.log('Page 2 data:', JSON.stringify(page2Data, null, 2));

  // Now visit one attendee profile
  console.log('\n--- Visiting profile ---');
  await page.goto('https://matchmaking.grip.events/manifestvegas2026/app/profile/16002500', {
    waitUntil: 'networkidle', timeout: 30000,
  });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'data/debug-profile.png', fullPage: true });

  // Click "Show more" if available
  try {
    const showMore = page.locator('text="Show more"').first();
    if (await showMore.isVisible({ timeout: 3000 })) {
      await showMore.click();
      await page.waitForTimeout(2000);
      console.log('Clicked Show more');
    }
  } catch {}

  await page.screenshot({ path: 'data/debug-profile-expanded.png', fullPage: true });

  // Extract ALL text content from the profile
  const profileData = await page.evaluate(() => {
    // Get structured data
    const sections: Record<string, string> = {};

    // Get all text nodes with their parent context
    const elements = document.querySelectorAll('*');
    const data: { tag: string; className: string; text: string }[] = [];

    for (const el of elements) {
      // Only direct text content (not children's text)
      const directText = Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim())
        .filter(Boolean)
        .join(' ');

      if (directText && directText.length > 1 && directText.length < 500) {
        data.push({
          tag: el.tagName,
          className: el.className?.toString().substring(0, 80) || '',
          text: directText,
        });
      }
    }

    return data;
  });

  console.log('\n=== PROFILE DATA ===');
  for (const item of profileData) {
    console.log(`[${item.tag}] ${item.className ? `(${item.className})` : ''} => ${item.text}`);
  }

  // Save HTML
  const html = await page.content();
  fs.writeFileSync('data/debug-profile.html', html);
  console.log('\nProfile HTML saved');

  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
}

debug().catch(console.error);
