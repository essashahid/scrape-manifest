import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const INPUT = process.argv[2] || 'data/attendees.csv';
const OUTPUT = INPUT.replace('.csv', '_clean.csv');

const raw = fs.readFileSync(INPUT, 'utf-8');
const records: Record<string, string>[] = parse(raw, { columns: true, skip_empty_lines: true });

// Junk patterns to strip from text fields
const JUNK_PATTERNS = [
  /GET THE APP[\s\S]*?Copy the App Link/gi,
  /Similar Profiles[\s\S]*?Show Interest/gi,
  /Show Interest/gi,
  /Keep networking with the mobile app[\s\S]*?connections!/gi,
  /Sponsor Level\s*\n\s*\w+/gi,
  /Website\s*\n\s*\S+/gi,
];

function cleanText(text: string): string {
  if (!text) return '';
  let cleaned = text;
  for (const pattern of JUNK_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Replace newlines with spaces, collapse whitespace
  cleaned = cleaned.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return cleaned;
}

// Columns to keep (drop summary, sponsor_company_summary, scraped_at)
const KEEP_COLS = [
  'id', 'name', 'role', 'badge_number', 'title', 'company', 'location',
  'company_services_provided', 'regions', 'interested_in',
  'sponsor_company_name', 'sponsor_level', 'sponsor_website', 'profile_url',
];

const cleanRecords = records.map(row => {
  const clean: Record<string, string> = {};
  for (const col of KEEP_COLS) {
    clean[col] = cleanText(row[col] || '');
  }
  return clean;
});

const output = stringify(cleanRecords, { header: true, columns: KEEP_COLS, quoted: true });
fs.writeFileSync(OUTPUT, output);

console.log(`Wrote ${cleanRecords.length} rows to ${OUTPUT}`);
console.log(`Columns: ${KEEP_COLS.join(', ')}`);
