import { Page, BrowserContext } from 'playwright';
import { CONFIG } from './config';
import { AttendeeListItem } from './types';
import { log, randomDelay, sleep } from './utils';
import { ensureLoggedIn } from './auth';

export async function scrapeAttendeeList(page: Page, context: BrowserContext): Promise<AttendeeListItem[]> {
  const allAttendees: AttendeeListItem[] = [];
  const seen = new Set<string>();
  let pageNum = 1;
  let emptyPages = 0;

  log('Starting to collect all attendees via URL pagination...');

  while (true) {
    const url = `${CONFIG.BASE_URL}/app/home/network/list/121246?page=${pageNum}&sort=name`;
    log(`Loading page ${pageNum}...`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000);

    // Check if still logged in
    if (page.url().includes('event-login')) {
      await ensureLoggedIn(page, context);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await sleep(2000);
    }

    // Extract attendees from this page
    const attendees = await page.evaluate(() => {
      const results: { id: string; name: string; profileUrl: string }[] = [];
      const links = document.querySelectorAll('a[href*="/app/profile/"]');
      const seenIds = new Set<string>();

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const name = link.textContent?.trim() || '';
        const match = href.match(/\/profile\/(\d+)/);

        if (match && name && name.length > 1 && !seenIds.has(match[1])) {
          seenIds.add(match[1]);
          results.push({
            id: match[1],
            name,
            profileUrl: href,
          });
        }
      }

      return results;
    });

    // Filter out already seen
    let newCount = 0;
    for (const att of attendees) {
      if (!seen.has(att.id)) {
        seen.add(att.id);
        allAttendees.push(att);
        newCount++;
      }
    }

    log(`Page ${pageNum}: found ${attendees.length} attendees (${newCount} new). Total: ${allAttendees.length}`);

    if (newCount === 0) {
      emptyPages++;
      if (emptyPages >= 2) {
        log('No new attendees found for 2 consecutive pages. Done collecting.');
        break;
      }
    } else {
      emptyPages = 0;
    }

    pageNum++;
    await randomDelay(CONFIG.TIMING.LOAD_MORE_DELAY_MIN, CONFIG.TIMING.LOAD_MORE_DELAY_MAX);
  }

  log(`Collected ${allAttendees.length} unique attendees across ${pageNum} pages.`);
  return allAttendees;
}
