import path from 'path';

export const CONFIG = {
  BASE_URL: 'https://matchmaking.grip.events/manifestvegas2026',
  LIST_URL: 'https://matchmaking.grip.events/manifestvegas2026/app/home/network/list/121246?page=1&sort=name',

  SELECTORS: {
    // Login page
    EMAIL_INPUT: 'input[type="email"], input[name="email"], input[placeholder*="email" i]',
    PASSWORD_INPUT: 'input[type="password"]',
    LOGIN_BUTTON: 'button[type="submit"], button:has-text("Log in"), button:has-text("Login"), button:has-text("Sign in")',

    // List page
    ATTENDEE_CARD: '[class*="network-card"], [class*="attendee"], [class*="person-card"], .card',
    ATTENDEE_NAME_LINK: 'a[href*="/people/"], a[href*="/profile/"], [class*="name"] a',
    LOAD_MORE_BUTTON: 'button:has-text("Load More"), button:has-text("Load more"), button:has-text("Show More"), a:has-text("Load More")',

    // Detail page
    SHOW_MORE_BUTTON: ':text("Show more"), :text("Show More"), button:has-text("Show more")',
    BACK_BUTTON: 'button:has-text("Back"), [class*="back"], a:has-text("Back")',
    DETAIL_NAME: 'h1, h2, [class*="name"]',
  },

  TIMING: {
    LOAD_MORE_DELAY_MIN: 1500,
    LOAD_MORE_DELAY_MAX: 2500,
    DETAIL_DELAY_MIN: 500,
    DETAIL_DELAY_MAX: 1000,
    PAGE_LOAD_TIMEOUT: 30000,
  },

  CONCURRENCY: parseInt(process.env.CONCURRENCY || '5'),

  PATHS: {
    AUTH_STATE: path.join(process.cwd(), 'data', 'auth-state.json'),
    PROGRESS: path.join(process.cwd(), 'data', 'progress.json'),
    OUTPUT_CSV: path.join(process.cwd(), 'data', 'attendees.csv'),
    ERRORS: path.join(process.cwd(), 'data', 'errors.json'),
    DATA_DIR: path.join(process.cwd(), 'data'),
  },

  MAX_RETRIES: 3,
  HEADED: process.env.HEADED === 'true',
};
