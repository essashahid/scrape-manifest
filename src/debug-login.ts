import dotenv from 'dotenv';
dotenv.config();

import { chromium } from 'playwright';
import fs from 'fs';

async function debug() {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext();
  const page = await context.newPage();

  const url = 'https://matchmaking.grip.events/manifestvegas2026/app/home/network/list/121246?page=1&sort=name';
  console.log('Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Accept cookies
  try {
    const acceptAll = page.locator('button:has-text("Accept All")');
    if (await acceptAll.isVisible({ timeout: 3000 })) {
      await acceptAll.click();
      await page.waitForTimeout(1000);
    }
  } catch {}

  // Step 1: Click Login button on landing
  console.log('Step 1: Click Login...');
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(2000);

  // Step 2: Fill email
  console.log('Step 2: Fill email...');
  await page.locator('input#email').fill(process.env.GRIP_EMAIL || '');
  await page.waitForTimeout(500);

  // Step 3: Click Login with email
  console.log('Step 3: Click Login with email...');
  await page.locator('button:has-text("Login")').click();
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');

  console.log('URL after email submit:', page.url());
  await page.screenshot({ path: 'data/debug-after-email.png', fullPage: true });

  // Check what's on the page now
  const elements = await page.evaluate(() => {
    const allEls = document.querySelectorAll('input, button, a, [role="textbox"]');
    return Array.from(allEls).map(el => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id,
      placeholder: el.getAttribute('placeholder'),
      className: el.className,
      text: el.textContent?.trim().substring(0, 80),
    }));
  });
  console.log('\nElements after email:');
  console.log(JSON.stringify(elements, null, 2));

  // If there's a password field, fill it
  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('Found password field! Filling...');
    await passwordInput.fill(process.env.GRIP_PASSWORD || '');
    await page.waitForTimeout(500);

    // Click submit/login
    await page.locator('button:has-text("Login"), button:has-text("Submit"), button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');

    console.log('URL after password:', page.url());
    await page.screenshot({ path: 'data/debug-after-password.png', fullPage: true });
  }

  // Check final state
  const finalElements = await page.evaluate(() => {
    const allEls = document.querySelectorAll('input, button, a');
    return Array.from(allEls).slice(0, 20).map(el => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      text: el.textContent?.trim().substring(0, 80),
      href: el.getAttribute('href'),
    }));
  });
  console.log('\nFinal page elements:');
  console.log(JSON.stringify(finalElements, null, 2));

  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
}

debug().catch(console.error);
