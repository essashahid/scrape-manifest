import { Page, BrowserContext } from 'playwright';
import { CONFIG } from './config';
import { AttendeeRecord, AttendeeListItem } from './types';
import { log, sleep, withRetry } from './utils';
import { ensureLoggedIn } from './auth';

export async function scrapeAttendeeDetail(
  page: Page,
  context: BrowserContext,
  attendee: AttendeeListItem
): Promise<AttendeeRecord> {
  return withRetry(async () => {
    const fullUrl = attendee.profileUrl.startsWith('http')
      ? attendee.profileUrl
      : `https://matchmaking.grip.events${attendee.profileUrl}`;

    await page.goto(fullUrl, { waitUntil: 'networkidle' });

    // Check if redirected to login
    if (page.url().includes('event-login')) {
      await ensureLoggedIn(page, context);
      await page.goto(fullUrl, { waitUntil: 'networkidle' });
    }

    // Wait for profile content to fully render
    await page.waitForSelector('p[data-test^="thingName"]', { timeout: 15000 });
    // Extra wait for metadata sections (role, tags, etc.) to load
    await sleep(1500);

    // Click all "Show more" buttons to expand details
    await clickAllShowMore(page);

    // Extract all data
    const data = await extractProfileData(page);

    // Parse title and company
    let title = '';
    let company = '';
    if (data.titleCompany.includes(' at ')) {
      const parts = data.titleCompany.split(' at ');
      title = parts[0].trim();
      company = parts.slice(1).join(' at ').trim();
    } else {
      title = data.titleCompany;
    }

    return {
      id: attendee.id,
      name: data.name || attendee.name,
      role: data.role,
      badgeNumber: data.badgeNumber,
      title,
      company,
      location: data.location,
      summary: data.summary,
      companyServicesProvided: data.companyServices,
      regions: data.regions,
      interestedIn: data.interestedIn,
      sponsorCompanyName: data.sponsorCompanyName,
      sponsorCompanySummary: data.sponsorCompanySummary,
      sponsorLevel: data.sponsorLevel,
      sponsorWebsite: data.sponsorWebsite,
      profileUrl: attendee.profileUrl,
      scrapedAt: new Date().toISOString(),
    };
  }, CONFIG.MAX_RETRIES);
}

async function clickAllShowMore(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    try {
      const showMore = page.locator('button:has-text("Show more")').first();
      if (await showMore.isVisible({ timeout: 1000 })) {
        await showMore.click();
        await sleep(1000);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}

async function extractProfileData(page: Page) {
  return await page.evaluate(() => {
    let name = '';
    let role = '';
    let badgeNumber = '';
    let titleCompany = '';
    let location = '';
    let summary = '';
    let companyServices = '';
    let regions = '';
    let interestedIn = '';
    let sponsorCompanyName = '';
    let sponsorCompanySummary = '';
    let sponsorLevel = '';
    let sponsorWebsite = '';

    // === NAME ===
    // The name p element contains child elements (role, badge). Get only direct text nodes.
    const nameEl = document.querySelector('p[data-test^="thingName"]');
    if (nameEl) {
      // Get only direct text node children
      const directText = Array.from(nameEl.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent?.trim())
        .filter(Boolean)
        .join(' ');
      name = directText.replace(/\s+/g, ' ').trim();
    }

    // === ROLE & BADGE ===
    const smallEls = document.querySelectorAll('small');
    for (const small of smallEls) {
      const text = small.textContent?.trim() || '';
      const roleMatch = text.match(/(Sponsor|Speaker|Attendee)\s*[•·]?/);
      if (roleMatch) {
        role = roleMatch[1];
        // Badge number in sibling <a>
        const badgeLink = small.querySelector('a.is-underlined');
        if (badgeLink) {
          badgeNumber = badgeLink.textContent?.trim() || '';
        }
        // Location may also be here for Attendees: "Attendee • Singapore, Singapore"
        const locMatch = text.match(/[•·]\s*([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+)/);
        if (locMatch) {
          location = locMatch[1].trim();
        }
        break;
      }
    }

    // === TITLE/COMPANY ===
    // The element immediately following the name header div
    const nameHeader = document.querySelector('p[data-test^="thingName"]');
    if (nameHeader) {
      const parentDiv = nameHeader.closest('.is-fullwidth');
      if (parentDiv) {
        const allPs = parentDiv.querySelectorAll('p');
        for (const p of allPs) {
          const text = p.textContent?.trim() || '';
          if (text.includes(' at ') && text.length < 300 && !p.hasAttribute('data-test')) {
            titleCompany = text;
            break;
          }
        }
      }
    }

    // === METADATA SECTIONS ===
    // Structure: <app-profile-rtm-display> contains label span and tag container span as siblings
    // Go up to the component level to find both label and tags together
    const rtmDisplays = document.querySelectorAll('app-profile-rtm-display');
    for (const rtm of rtmDisplays) {
      const labelEl = rtm.querySelector('span.has-text-color-primary');
      if (!labelEl) continue;
      const labelText = labelEl.textContent?.trim() || '';

      const tagContainer = rtm.querySelector('.metadata-field-tag-container');
      const tags: string[] = [];
      if (tagContainer) {
        const tagEls = tagContainer.querySelectorAll('.metadata-value-tag');
        for (const tag of tagEls) {
          const v = tag.textContent?.trim();
          if (v) tags.push(v);
        }
      }

      // For Website, the URL might be plain text not in a tag
      let rtmText = '';
      if (tags.length === 0) {
        rtmText = rtm.textContent?.replace(labelText, '').trim() || '';
      }

      if (labelText.includes('Company Services')) {
        companyServices = tags.join('; ');
      } else if (labelText === 'Region') {
        regions = tags.join('; ');
      } else if (labelText === 'Interested In') {
        interestedIn = tags.join('; ');
      } else if (labelText.includes('Sponsor Level')) {
        sponsorLevel = tags.join('; ');
      } else if (labelText.includes('Sponsor Business Category')) {
        const val = tags.join('; ');
        companyServices = companyServices ? companyServices + '; ' + val : val;
      } else if (labelText === 'Website') {
        sponsorWebsite = tags.join('') || rtmText;
      } else if (labelText === 'Summary') {
        // Summary text is in the RTM display but not in tags
        const text = rtm.textContent?.replace('Summary', '').trim() || '';
        if (text.length > 10) {
          // Check if this summary is for the sponsor or the attendee
          const inSponsor = rtm.closest('[data-test="companyContainer"]');
          if (inSponsor) {
            sponsorCompanySummary = text;
          } else {
            summary = text;
          }
        }
      }
    }

    // === SUMMARY ===
    // The attendee summary is plain text, not in RTM displays
    // It appears in the main info container (not the sponsor company container)
    if (!summary) {
      // Get full page text and extract summary section
      const infoContainer = document.querySelector('[data-test="infoContainer"]');
      if (infoContainer) {
        const text = (infoContainer as HTMLElement).innerText || '';
        const summaryMatch = text.match(/Summary\n([\s\S]+?)(?=\n(?:Company Services|Region|Interested|Sponsor|Details|Show less|Show more|$))/);
        if (summaryMatch) {
          summary = summaryMatch[1].trim();
        }
      }
      // Fallback: try from full page but exclude sponsor section
      if (!summary) {
        const fullText = document.body.innerText;
        const summaryMatch = fullText.match(/Summary\n([\s\S]+?)(?=\n(?:Company Services|Region|Interested|Sponsor Business|Details|Show less|$))/);
        if (summaryMatch) {
          summary = summaryMatch[1].trim();
        }
      }
    }

    // === SPONSOR COMPANY SECTION ===
    const companyContainer = document.querySelector('[data-test="companyContainer"]');
    if (companyContainer) {
      // Company name
      const companyLink = companyContainer.querySelector('a.is-header');
      if (companyLink) {
        sponsorCompanyName = companyLink.textContent?.trim() || '';
      }

      // Sponsor Level and Website are already captured via RTM displays above
      // (since RTM displays inside companyContainer are also iterated)

      // If sponsorCompanySummary wasn't captured via RTM, try parsing from text
      if (!sponsorCompanySummary) {
        const containerText = (companyContainer as HTMLElement).innerText || '';
        const summaryMatch = containerText.match(/Summary\s*\n\s*([\s\S]+?)(?=\n\s*(Sponsor Level|Website|Show more|Show less|$))/);
        if (summaryMatch) {
          sponsorCompanySummary = summaryMatch[1].trim();
        }
      }
    }

    // Fallback: website from any external link on page
    if (!sponsorWebsite) {
      const allLinks = document.querySelectorAll('a[href^="http"]');
      for (const link of allLinks) {
        const href = link.getAttribute('href') || '';
        if (!href.includes('grip.events') && !href.includes('manife.st') && !href.includes('apple.com') && !href.includes('play.google.com')) {
          sponsorWebsite = href;
          break;
        }
      }
    }

    return {
      name,
      role,
      badgeNumber,
      titleCompany,
      location,
      summary,
      companyServices,
      regions,
      interestedIn,
      sponsorCompanyName,
      sponsorCompanySummary,
      sponsorLevel,
      sponsorWebsite,
    };
  });
}
