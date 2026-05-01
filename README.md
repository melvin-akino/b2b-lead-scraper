# High-Precision Lead Scraper & Researcher

> B2B prospect research on autopilot. Give it a name, a URL, and a LinkedIn — it comes back with pain points, business focus, and three ready-to-send email icebreakers.

---

## How It Works

```
CLI input
    │
    ▼
[Scraper]        Playwright visits the company website + LinkedIn (stealth mode)
    │
    ▼
[Researcher]     Claude analyzes raw text → extracts pain_points[] + business_focus
    │
    ▼
[Personalizer]   Claude writes 3 email icebreaker hooks (pain-led / aspiration-led / curiosity-led)
    │
    ▼
[Store]          Saves enriched lead to data/leads.json
    │
    ▼
[Exporter]       Writes output/leads_<timestamp>.csv
```

---

## One-Stop Setup

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Bundled with Node |
| Anthropic API key | — | [console.anthropic.com](https://console.anthropic.com) |

### 1. Clone / navigate to the project

```bash
cd C:\Projects\high-precision-leads-generation
```

### 2. Install dependencies

```bash
npm install
```

### 3. Install Playwright browsers

```bash
npx playwright install chromium
```

### 4. Configure environment

```bash
# Copy the example file
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional — set to "false" to watch the browser scrape in real time
SCRAPE_HEADLESS=true

# Optional — override the default output directory
OUTPUT_DIR=./output
```

### 5. Verify the setup (dry run)

```bash
npx ts-node src/cli.ts --help
```

You should see the command list. If that works, you're ready.

---

## Usage

### Scrape a single lead

```bash
npx ts-node src/cli.ts scrape \
  --name "Maria Santos" \
  --role "CEO" \
  --company "Kumu" \
  --website "https://www.kumu.live" \
  --linkedin "https://www.linkedin.com/company/kumu-ph"
```

Add `--context` to guide the AI with your campaign focus:

```bash
npx ts-node src/cli.ts scrape \
  --name "Maria Santos" \
  --role "CEO" \
  --company "Kumu" \
  --website "https://www.kumu.live" \
  --context "SaaS Founders in Manila struggling with user retention"
```

### Scrape a batch from a JSON file

Create a file (see [`examples/leads-input.json`](examples/leads-input.json) for the format):

```json
[
  {
    "prospect_name": "Maria Santos",
    "role": "CEO",
    "company_name": "Kumu",
    "website_url": "https://www.kumu.live",
    "linkedin_url": "https://www.linkedin.com/company/kumu-ph"
  },
  {
    "prospect_name": "Juan dela Cruz",
    "role": "Founder",
    "company_name": "PayMongo",
    "website_url": "https://www.paymongo.com"
  }
]
```

Then run:

```bash
npx ts-node src/cli.ts scrape \
  --file examples/leads-input.json \
  --context "SaaS Founders in Manila"
```

### Export stored leads to CSV

```bash
npx ts-node src/cli.ts export
```

Output file: `output/leads_<ISO-timestamp>.csv`

### List all stored leads

```bash
npx ts-node src/cli.ts list
```

### Clear the store

```bash
npx ts-node src/cli.ts clear
```

---

## Output: CSV Columns

| Column | Description |
|---|---|
| `ID` | Unique nanoid for the lead |
| `Company` | Company name |
| `Prospect Name` | Full name |
| `Role` | Title / role |
| `Website` | Company website URL |
| `LinkedIn` | LinkedIn URL (if provided) |
| `Business Focus` | 1–2 sentence AI summary of current focus |
| `Pain Points (pipe-separated)` | 3 inferred pain points joined by ` \| ` |
| `Analysis Summary` | 3–4 sentence briefing note for the sales rep |
| `Hook 1 (Pain-Point Led)` | Icebreaker opening referencing a specific pain |
| `Hook 2 (Aspiration Led)` | Icebreaker opening referencing a goal or opportunity |
| `Hook 3 (Proof/Curiosity Led)` | Icebreaker using a stat, question, or observation |
| `Scraped At` | ISO timestamp of when the page was scraped |
| `Analyzed At` | ISO timestamp of when AI analysis completed |

---

## Project Structure

```
high-precision-leads-generation/
│
├── src/
│   ├── schema.ts          Zod Lead type — single source of truth for the data shape
│   ├── scraper.ts         Playwright engine with stealth tactics (UA rotation, delays)
│   ├── researcher.ts      Claude API call: extracts pain points + business focus
│   ├── personalizer.ts    Claude API call: generates 3 icebreaker email hooks
│   ├── store.ts           JSON flat-file data store (data/leads.json)
│   ├── exporter.ts        CSV writer — outputs to output/
│   ├── pipeline.ts        Orchestrator: runs Scrape → Research → Personalize → Store
│   ├── cli.ts             Commander CLI (scrape / export / list / clear)
│   └── index.ts           Programmatic entry point — re-exports public API
│
├── examples/
│   └── leads-input.json   Sample batch input file
│
├── data/
│   └── leads.json         Auto-created by the store on first run
│
├── output/                CSV exports land here (auto-created)
│
├── .env                   Your secrets (not committed)
├── .env.example           Template for .env
├── package.json
└── tsconfig.json
```

---

## Architecture Decisions

### Why prompt caching?
Both `researcher.ts` and `personalizer.ts` use a large, static system prompt. By marking it `cache_control: { type: "ephemeral" }`, the Anthropic API caches it for 5 minutes. On a batch of 10 leads, this cuts API costs by ~80% — you only pay full price for the first call in the window.

### Why sequential scraping?
The pipeline processes leads one at a time with a 3–7 second random inter-lead delay. This mimics human browsing patterns and reduces the risk of IP-level rate limiting. Parallel scraping is faster but dramatically increases detection risk.

### Why JSON store instead of a database?
For Phase 1, a flat JSON file is zero-dependency and inspectable with any text editor. The store's public API (`upsertLead`, `getAllLeads`, etc.) is designed so you can swap it for a Prisma + SQLite/PostgreSQL implementation later without changing any callers.

### Why save raw_scraped_content?
Re-running AI analysis on the same lead is cheap once the content is cached locally. You can tweak your prompts and re-analyze without re-scraping, which preserves your stealth budget and keeps the feedback loop fast.

---

## Stealth Tactics (Scraper)

| Tactic | Implementation |
|---|---|
| User-agent rotation | 4 real-world UA strings, picked randomly per request |
| Viewport randomization | Width ±200px, height ±100px from a 1280×800 baseline |
| Random delays | 800–2500ms between page interactions; 3–7s between leads |
| navigator.webdriver masking | Injected via `addInitScript` before any page load |
| Locale + timezone spoofing | `en-US` locale, `America/New_York` timezone |
| No automation flags | `--disable-blink-features=AutomationControlled` launch arg |

> **Note on LinkedIn:** LinkedIn's authenticated feed requires a logged-in session. The scraper targets public-facing pages only. For authenticated scraping, inject session cookies via `context.addCookies()` before navigating.

---

## Extending the System

### Add a new data source (e.g. Crunchbase, Twitter/X)

1. Add a new method to `LeadScraper` in `scraper.ts`.
2. Call it in `scrapeAll()` and append the text to the combined result.
3. No other files need to change.

### Swap the JSON store for a real database

1. Replace the implementation in `store.ts` with Prisma calls.
2. The public function signatures (`upsertLead`, `getAllLeads`, etc.) stay the same.
3. No other files need to change.

### Change the AI model or prompts

- Prompts live entirely in `researcher.ts` (`SYSTEM_PROMPT`) and `personalizer.ts` (`SYSTEM_PROMPT`).
- Swap `claude-sonnet-4-6` for any other model in those two files.

### Run as a scheduled job

Use the programmatic API from `index.ts` inside any scheduler (cron, Temporal, etc.):

```typescript
import { runPipeline, exportToCSV, getAllLeads } from './src/index';

// Called by your scheduler
async function runDailyBatch() {
  await runPipeline(myLeads, { searchContext: 'SaaS Founders in Manila' });
  await exportToCSV(getAllLeads());
}
```

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `ANTHROPIC_API_KEY is missing` | `.env` not loaded | Copy `.env.example` → `.env` and add your key |
| Playwright browser not found | Browser not installed | Run `npx playwright install chromium` |
| Scrape returns empty text | Site uses heavy JS / SSR | Try setting `SCRAPE_HEADLESS=false` to debug visually |
| LinkedIn returns no about text | Unauthenticated scraping limit | Expected — the scraper falls back to paragraph text |
| JSON parse error from Claude | Model returned markdown | Check your API key; the prompts explicitly forbid markdown output |

---

## License

MIT
