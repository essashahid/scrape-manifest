import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import dotenv from 'dotenv';
import { CONFIG } from './config';
import { log, sleep } from './utils';

dotenv.config();

export async function launchBrowser(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.launch({
    headless: !CONFIG.HEADED,
    slowMo: CONFIG.HEADED ? 100 : 0,
  });

  let context: BrowserContext;

  // Try to reuse saved session
  if (fs.existsSync(CONFIG.PATHS.AUTH_STATE)) {
    log('Loading saved session...');
    context = await browser.newContext({ storageState: CONFIG.PATHS.AUTH_STATE });
  } else {
    context = await browser.newContext();
  }

  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.TIMING.PAGE_LOAD_TIMEOUT);

  return { browser, context, page };
}

export async function login(page: Page, context: BrowserContext): Promise<void> {
  const email = process.env.GRIP_EMAIL;
  const password = process.env.GRIP_PASSWORD;

  if (!email || !password) {
    throw new Error('GRIP_EMAIL and GRIP_PASSWORD must be set in .env');
  }

  log('Navigating to attendee list...');
  await page.goto(CONFIG.LIST_URL, { waitUntil: 'networkidle' });

  // Check if we're already logged in
  if (page.url().includes('/app/') && !page.url().includes('event-login')) {
    log('Already logged in with saved session.');
    return;
  }

  log('Not logged in. Performing 2-step login...');

  // Accept cookies if present
  try {
    const acceptAll = page.locator('button:has-text("Accept All")');
    if (await acceptAll.isVisible({ timeout: 3000 })) {
      await acceptAll.click();
      await sleep(1000);
      log('Accepted cookies.');
    }
  } catch {}

  // Step 1: Click initial "Login" button on landing page
  await page.locator('button:has-text("Login")').click();
  await sleep(2000);

  // Step 2: Fill email
  await page.locator('input#email').fill(email);
  await sleep(500);
  await page.locator('button:has-text("Login")').click();
  await sleep(2000);

  // Step 3: Fill password
  await page.locator('input#password').fill(password);
  await sleep(500);
  await page.locator('button:has-text("Login")').click();

  // Wait for navigation to complete
  log('Waiting for login to complete...');
  await page.waitForURL(/.*\/app\/.*/, { timeout: 30000 });
  await page.waitForLoadState('networkidle');

  // Save session for reuse
  fs.mkdirSync(CONFIG.PATHS.DATA_DIR, { recursive: true });
  await context.storageState({ path: CONFIG.PATHS.AUTH_STATE });
  log('Login successful. Session saved.');
}

export async function ensureLoggedIn(page: Page, context: BrowserContext): Promise<void> {
  const url = page.url();
  if (!url.includes('/app/') || url.includes('event-login')) {
    log('Session expired. Re-authenticating...');
    await login(page, context);
  }
}
