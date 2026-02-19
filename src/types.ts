export interface AttendeeListItem {
  id: string;
  name: string;
  profileUrl: string;
}

export interface AttendeeRecord {
  id: string;
  name: string;
  role: string;
  badgeNumber: string;
  title: string;
  company: string;
  location: string;
  summary: string;
  companyServicesProvided: string;
  regions: string;
  interestedIn: string;
  sponsorCompanyName: string;
  sponsorCompanySummary: string;
  sponsorLevel: string;
  sponsorWebsite: string;
  profileUrl: string;
  scrapedAt: string;
}

export interface Progress {
  phase: 'list_collection' | 'detail_scraping' | 'complete';
  totalAttendees: number;
  attendeeList: AttendeeListItem[];
  completed: string[];
  failed: { id: string; error: string; attempts: number }[];
  lastUpdated: string;
}

export const CSV_HEADERS = [
  'id',
  'name',
  'role',
  'badge_number',
  'title',
  'company',
  'location',
  'summary',
  'company_services_provided',
  'regions',
  'interested_in',
  'sponsor_company_name',
  'sponsor_company_summary',
  'sponsor_level',
  'sponsor_website',
  'profile_url',
  'scraped_at',
];
