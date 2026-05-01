import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(min = 800, max = 2500): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min) + min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ScrapeResult {
  url: string;
  title: string;
  text: string;
  linkedinAbout?: string;
  recentActivity?: string[];
}

export class LeadScraper {
  private browser: Browser | null = null;
  private headless: boolean;

  constructor() {
    this.headless = process.env.SCRAPE_HEADLESS !== 'false';
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
      ],
    });
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  private async createStealthContext(): Promise<BrowserContext> {
    if (!this.browser) throw new Error('Browser not initialized. Call init() first.');

    const context = await this.browser.newContext({
      userAgent: randomUserAgent(),
      viewport: { width: 1280 + Math.floor(Math.random() * 200), height: 800 + Math.floor(Math.random() * 100) },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
      },
    });

    // Mask navigator.webdriver
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });

    return context;
  }

  async scrapeWebsite(url: string): Promise<ScrapeResult> {
    const context = await this.createStealthContext();
    const page = await context.newPage();

    try {
      await randomDelay(500, 1200);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await randomDelay(800, 2000);

      const title = await page.title();

      // Extract meaningful text: headings, paragraphs, about sections
      const text = await page.evaluate(() => {
        const selectors = ['h1', 'h2', 'h3', 'p', '[class*="about"]', '[class*="mission"]', '[class*="vision"]'];
        const seen = new Set<string>();
        const parts: string[] = [];

        for (const sel of selectors) {
          document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
            const t = el.innerText?.trim();
            if (t && t.length > 20 && !seen.has(t)) {
              seen.add(t);
              parts.push(t);
            }
          });
        }
        return parts.slice(0, 60).join('\n');
      });

      return { url, title, text };
    } finally {
      await context.close();
    }
  }

  async scrapeLinkedIn(linkedinUrl: string): Promise<ScrapeResult> {
    const context = await this.createStealthContext();
    const page = await context.newPage();

    try {
      await randomDelay(1000, 2500);
      await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await randomDelay(1500, 3000);

      const title = await page.title();

      // Extract public-facing About section and recent posts from unauthenticated view
      const linkedinAbout = await this.extractLinkedInAbout(page);
      const recentActivity = await this.extractRecentActivity(page);

      const text = [linkedinAbout, ...recentActivity].filter(Boolean).join('\n\n');

      return { url: linkedinUrl, title, text, linkedinAbout, recentActivity };
    } finally {
      await context.close();
    }
  }

  private async extractLinkedInAbout(page: Page): Promise<string> {
    return page.evaluate(() => {
      const aboutSelectors = [
        '.core-section-container__content',
        '.about-section',
        '[data-test-id="about-section"]',
        'section[data-section="summary"]',
        '.pv-about__summary-text',
      ];
      for (const sel of aboutSelectors) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el?.innerText?.trim()) return el.innerText.trim();
      }
      // Fallback: grab all visible paragraphs
      const paras = Array.from(document.querySelectorAll<HTMLElement>('p'))
        .map((p) => p.innerText?.trim())
        .filter((t) => t && t.length > 30)
        .slice(0, 10);
      return paras.join('\n');
    });
  }

  private async extractRecentActivity(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const posts = Array.from(document.querySelectorAll<HTMLElement>(
        '.feed-shared-text, .update-components-text, [class*="post-text"]'
      ));
      return posts
        .map((el) => el.innerText?.trim())
        .filter((t) => t && t.length > 20)
        .slice(0, 5);
    });
  }

  async scrapeAll(websiteUrl: string, linkedinUrl?: string): Promise<ScrapeResult> {
    const websiteResult = await this.scrapeWebsite(websiteUrl);

    if (!linkedinUrl) return websiteResult;

    await randomDelay(2000, 4000);
    const linkedinResult = await this.scrapeLinkedIn(linkedinUrl);

    return {
      url: websiteUrl,
      title: websiteResult.title,
      text: `=== Company Website ===\n${websiteResult.text}\n\n=== LinkedIn ===\n${linkedinResult.text}`,
      linkedinAbout: linkedinResult.linkedinAbout,
      recentActivity: linkedinResult.recentActivity,
    };
  }
}
