import fs from 'fs';
import { stringify } from 'csv-stringify/sync';
import { CONFIG } from './config';
import { AttendeeRecord, CSV_HEADERS } from './types';

export function initCsv(): void {
  fs.mkdirSync(CONFIG.PATHS.DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG.PATHS.OUTPUT_CSV)) {
    fs.writeFileSync(CONFIG.PATHS.OUTPUT_CSV, CSV_HEADERS.join(',') + '\n');
  }
}

export function appendRecord(record: AttendeeRecord): void {
  const row = [
    record.id,
    record.name,
    record.role,
    record.badgeNumber,
    record.title,
    record.company,
    record.location,
    record.summary,
    record.companyServicesProvided,
    record.regions,
    record.interestedIn,
    record.sponsorCompanyName,
    record.sponsorCompanySummary,
    record.sponsorLevel,
    record.sponsorWebsite,
    record.profileUrl,
    record.scrapedAt,
  ];

  const csv = stringify([row], { quoted: true });
  fs.appendFileSync(CONFIG.PATHS.OUTPUT_CSV, csv);
}
