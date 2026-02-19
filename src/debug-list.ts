import dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';
import fs from 'fs';

async function debug() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login first
  const url = 'https://matchmaking.grip.events/manifestvegas2026/event-login';
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Accept cookies
  try {
    const acceptAll = page.locator('button:has-text("Accept All")');
    if (await acceptAll.isVisible({ timeout: 3000 })) {
      await acceptAll.click();
      await page.waitForTimeout(1000);
    }
  } catch {}

  // Login flow
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(2000);
  await page.locator('input#email').fill(process.env.GRIP_EMAIL || '');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(2000);
  await page.locator('input#password').fill(process.env.GRIP_PASSWORD || '');
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle');

  console.log('Logged in. URL:', page.url());

  // Navigate to All Attendees
  console.log('Navigating to All Attendees...');
  await page.goto('https://matchmaking.grip.events/manifestvegas2026/app/home/network/list/121246?page=1&sort=name', {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(3000);

  console.log('URL:', page.url());
  await page.screenshot({ path: 'data/debug-list.png', fullPage: true });

  // Analyze the attendee cards
  const pageData = await page.evaluate(() => {
    // Find all links
    const allLinks = document.querySelectorAll('a');
    const attendeeLinks: any[] = [];
    for (const link of allLinks) {
      const href = link.getAttribute('href') || '';
      const text = link.textContent?.trim() || '';
      if (text.length > 2 && text.length < 100) {
        attendeeLinks.push({ href, text: text.substring(0, 60), className: link.className });
      }
    }

    // Find all buttons
    const allButtons = document.querySelectorAll('button');
    const buttons: any[] = [];
    for (const btn of allButtons) {
      const text = btn.textContent?.trim() || '';
      if (text.length > 0 && text.length < 100) {
        buttons.push({ text: text.substring(0, 60), className: btn.className });
      }
    }

    // Find card-like elements
    const possibleCards = document.querySelectorAll('[class*="card"], [class*="person"], [class*="attendee"], [class*="network"], [class*="item"]');
    const cards: any[] = [];
    for (const card of possibleCards) {
      cards.push({
        tag: card.tagName,
        className: card.className,
        childCount: card.children.length,
        textPreview: card.textContent?.trim().substring(0, 100),
      });
    }

    return { attendeeLinks: attendeeLinks.slice(0, 30), buttons: buttons.slice(0, 20), cards: cards.slice(0, 20) };
  });

  console.log('\n=== ATTENDEE LINKS ===');
  console.log(JSON.stringify(pageData.attendeeLinks, null, 2));

  console.log('\n=== BUTTONS ===');
  console.log(JSON.stringify(pageData.buttons, null, 2));

  console.log('\n=== CARD ELEMENTS ===');
  console.log(JSON.stringify(pageData.cards, null, 2));

  // Save HTML
  const html = await page.content();
  fs.writeFileSync('data/debug-list.html', html);
  console.log('\nHTML saved to data/debug-list.html');

  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
}

debug().catch(console.error);
