import fs from 'fs';
import { CONFIG } from './config';
import { Progress, AttendeeListItem } from './types';

export function loadProgress(): Progress | null {
  if (!fs.existsSync(CONFIG.PATHS.PROGRESS)) return null;
  const raw = fs.readFileSync(CONFIG.PATHS.PROGRESS, 'utf-8');
  return JSON.parse(raw) as Progress;
}

export function saveProgress(progress: Progress): void {
  fs.mkdirSync(CONFIG.PATHS.DATA_DIR, { recursive: true });
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.PATHS.PROGRESS, JSON.stringify(progress, null, 2));
}

export function createInitialProgress(): Progress {
  return {
    phase: 'list_collection',
    totalAttendees: 0,
    attendeeList: [],
    completed: [],
    failed: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function markCompleted(progress: Progress, id: string): void {
  if (!progress.completed.includes(id)) {
    progress.completed.push(id);
  }
  // Remove from failed if it was there
  progress.failed = progress.failed.filter(f => f.id !== id);
  saveProgress(progress);
}

export function markFailed(progress: Progress, id: string, error: string): void {
  const existing = progress.failed.find(f => f.id === id);
  if (existing) {
    existing.attempts += 1;
    existing.error = error;
  } else {
    progress.failed.push({ id, error, attempts: 1 });
  }
  saveProgress(progress);
}

export function setAttendeeList(progress: Progress, list: AttendeeListItem[]): void {
  progress.attendeeList = list;
  progress.totalAttendees = list.length;
  progress.phase = 'detail_scraping';
  saveProgress(progress);
}
