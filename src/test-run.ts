import dotenv from 'dotenv';
dotenv.config();

import { launchBrowser, login } from './auth';
import { scrapeAttendeeDetail } from './scrape-detail';
import { initCsv, appendRecord } from './csv-writer';
import { AttendeeListItem } from './types';
import { log, logError, sleep } from './utils';

async function testRun() {
  log('=== TEST RUN: Scrape 3 attendees ===');

  initCsv();
  const { browser, context, page } = await launchBrowser();

  try {
    // Login
    await login(page, context);

    // Navigate to list and get first few attendees
    log('Getting attendees from page 1...');
    await page.goto('https://matchmaking.grip.events/manifestvegas2026/app/home/network/list/121246?page=1&sort=name', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await sleep(3000);

    const attendees: AttendeeListItem[] = await page.evaluate(() => {
      const results: { id: string; name: string; profileUrl: string }[] = [];
      const links = document.querySelectorAll('a[href*="/app/profile/"]');
      const seen = new Set<string>();

      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const name = link.textContent?.trim() || '';
        const match = href.match(/\/profile\/(\d+)/);

        if (match && name && !seen.has(match[1])) {
          seen.add(match[1]);
          results.push({ id: match[1], name, profileUrl: href });
        }
      }
      return results;
    });

    log(`Found ${attendees.length} attendees on page 1. Testing first 3...`);

    // Scrape first 3 attendees
    for (let i = 0; i < Math.min(3, attendees.length); i++) {
      const att = attendees[i];
      log(`\n--- Scraping ${i + 1}/3: ${att.name} ---`);

      try {
        const record = await scrapeAttendeeDetail(page, context, att);
        appendRecord(record);

        // Print extracted data
        log('Extracted data:');
        log(`  Name: ${record.name}`);
        log(`  Role: ${record.role}`);
        log(`  Badge: ${record.badgeNumber}`);
        log(`  Title: ${record.title}`);
        log(`  Company: ${record.company}`);
        log(`  Location: ${record.location}`);
        log(`  Summary: ${record.summary.substring(0, 100)}...`);
        log(`  Services: ${record.companyServicesProvided}`);
        log(`  Regions: ${record.regions}`);
        log(`  Interested In: ${record.interestedIn}`);
        log(`  Sponsor Company: ${record.sponsorCompanyName}`);
        log(`  Sponsor Level: ${record.sponsorLevel}`);
        log(`  Website: ${record.sponsorWebsite}`);
      } catch (error) {
        logError(`Failed: ${error}`);
      }

      await sleep(2000);
    }

    log('\n=== TEST COMPLETE ===');
    log('Check data/attendees.csv for output');
  } finally {
    await browser.close();
  }
}

testRun().catch(console.error);
