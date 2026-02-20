import dotenv from 'dotenv';
dotenv.config();

import { CONFIG } from './config';
import { launchBrowser, login } from './auth';
import { scrapeAttendeeList } from './scrape-list';
import { scrapeAttendeeDetail } from './scrape-detail';
import { loadProgress, saveProgress, createInitialProgress, markCompleted, markFailed, setAttendeeList } from './progress';
import { initCsv, appendRecord } from './csv-writer';
import { log, logError, randomDelay } from './utils';

async function main() {
  log('=== Manifest Vegas 2026 Attendee Scraper ===');
  log(`Running in ${CONFIG.HEADED ? 'HEADED' : 'HEADLESS'} mode`);

  // Initialize
  initCsv();
  let progress = loadProgress() || createInitialProgress();

  // Launch browser
  const { browser, context, page } = await launchBrowser();

  try {
    // Step 1: Login
    log('--- Phase 1: Authentication ---');
    await login(page, context);

    // Step 2: Collect attendee list (if not already done)
    if (progress.phase === 'list_collection' || progress.attendeeList.length === 0) {
      log('--- Phase 2: Collecting all attendees ---');
      const attendees = await scrapeAttendeeList(page, context);
      setAttendeeList(progress, attendees);
      log(`Collected ${attendees.length} attendees total.`);
    } else {
      log(`Resuming with ${progress.attendeeList.length} attendees already collected.`);
    }

    // Step 3: Scrape each attendee detail (parallel worker pool)
    log('--- Phase 3: Scraping attendee details ---');
    const total = progress.attendeeList.length;
    let scraped = progress.completed.length;

    // Build list of pending attendees (skip already completed / max-failed)
    const pending = progress.attendeeList.filter(attendee => {
      if (progress.completed.includes(attendee.id)) return false;
      const failedEntry = progress.failed.find(f => f.id === attendee.id);
      if (failedEntry && failedEntry.attempts >= CONFIG.MAX_RETRIES) {
        logError(`Skipping ${attendee.name} - failed ${failedEntry.attempts} times: ${failedEntry.error}`);
        return false;
      }
      return true;
    });

    log(`Workers: ${CONFIG.CONCURRENCY} | Pending: ${pending.length}`);

    // Shared queue index — each worker atomically claims the next item
    let queueIndex = 0;

    // Spin up N pages from the same authenticated context
    const workerPages = await Promise.all(
      Array.from({ length: CONFIG.CONCURRENCY }, () => context.newPage())
    );

    async function worker(workerPage: typeof page): Promise<void> {
      while (true) {
        const i = queueIndex++;
        if (i >= pending.length) break;
        const attendee = pending[i];
        try {
          const record = await scrapeAttendeeDetail(workerPage, context, attendee);
          appendRecord(record);
          markCompleted(progress, attendee.id);
          scraped++;
          log(`[${scraped}/${total}] Scraped: ${record.name} (${record.role || 'N/A'})`);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          logError(`Failed to scrape ${attendee.name}: ${errMsg}`);
          markFailed(progress, attendee.id, errMsg);
        }
        await randomDelay(CONFIG.TIMING.DETAIL_DELAY_MIN, CONFIG.TIMING.DETAIL_DELAY_MAX);
      }
    }

    await Promise.all(workerPages.map(wp => worker(wp)));
    await Promise.all(workerPages.map(wp => wp.close()));

    // Mark complete
    progress.phase = 'complete';
    saveProgress(progress);

    log('=== Scraping Complete ===');
    log(`Total attendees: ${total}`);
    log(`Successfully scraped: ${progress.completed.length}`);
    log(`Failed: ${progress.failed.length}`);
    log(`Output saved to: ${CONFIG.PATHS.OUTPUT_CSV}`);

    // Log failed entries if any
    if (progress.failed.length > 0) {
      log('\nFailed attendees:');
      for (const f of progress.failed) {
        const att = progress.attendeeList.find(a => a.id === f.id);
        log(`  - ${att?.name || f.id}: ${f.error} (${f.attempts} attempts)`);
      }
    }
  } catch (error) {
    logError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    saveProgress(progress);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  logError(`Scraper crashed: ${error}`);
  process.exit(1);
});
