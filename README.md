# AI Offer Tracker / Free AI Tracker

Automated scanner for free AI models, time-allowed promos, and platform updates. Runs as a hosted cron job (weekly, Mon 08:00 UTC via `vercel.json`). Multi-user: any visitor can subscribe via the dashboard to receive the weekly AI digest by email.

## Features

- **GitHub Releases** - Tracks major AI model repositories (`src/scrapers/social-monitor.js`)
- **GitHub Search** - Trending repos matching AI/free-tier queries (`src/scrapers/github-rss.js`)
- **Social/Platform Monitor** - HuggingFace blog + Reddit (OAuth with RSS fallback) (`src/scrapers/social-monitor.js`)
- **Free Tier Scanner** - Detects $0 models on OpenRouter, HuggingFace serverless, Groq, Together AI, Google AI Studio (`src/scrapers/free-tier-scanner.js`)
- **Curated Feeds** - aifree.dev RSS (`src/scrapers/aifree-rss.js`), GitHub Student Pack (`src/scrapers/student-pack.js`)
- **AI Filtering** - Keyword-based relevance scoring with source boosts and dedup (`src/services/ai-filter.js`)
- **Email Notifications** - Structured HTML digests via Brevo (`src/services/email-notifier.js`), idempotent under retries (AbortController timeout, `subscribers:pending` welcome state). Designed with robust Outlook/MSO ghost tables, solid background fallbacks, structured content hierarchy (top 3 weekly picks, category grouping by source, and dedicated signup credit section), responsive `prefers-color-scheme` dark mode, touch-friendly $\ge 44\text{px}$ CTA buttons, and strict clipping resilience (<90KB).
- **Subscription API** - Visitors subscribe via the dashboard; emails stored in Upstash Redis (`api/subscribe.js`)
- **Unsubscribe / Manage** - One-click token-based unsubscribe + manage pages (`api/unsubscribe.js`, `api/manage.js`)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (copy `.env.example` to `.env`):
```bash
cp .env.example .env
```

Required:
- `BREVO_API_KEY` - Brevo SMTP API key
- Upstash Redis REST URL + token (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, or `KV_REST_API_URL` + `KV_REST_API_TOKEN`)
- `EMAIL_FROM` - sender, e.g. `Free AI Tracker <you@gmail.com>`
- `EMAIL_TO` - default digest recipient (when `EMAIL_TO_SELF` path used)

Optional:
- `GITHUB_TOKEN` - raises GitHub API rate limits
- `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` - Reddit OAuth (RSS fallback is heavily rate-limited)
- `GOOGLE_AI_STUDIO_KEY` - Google AI Studio key (sent via `x-goog-api-key` header to prevent URL leakage)
- `GROQ_API_KEY`, `TOGETHER_API_KEY`, `CEREBRAS_API_KEY`, `COHERE_API_KEY` - enable respective provider scanners
- `CRON_SECRET` - authorization bearer token for `/api/check-updates` (required in production, fails closed with 500 if unset)
- `EMAIL_TIMEOUT_MS` - mail provider request timeout (default `10000`)
- `UNSUBSCRIBE_TOKEN_TTL_DAYS` - unsubscribe token lifetime (default `30`)

3. Deploy to Vercel:
```bash
vercel deploy
```

## Project Structure

```
├── api/
│   ├── check-updates.js          # Cron job entrypoint (collects, filters, emails)
│   ├── get-offers.js             # GET /api/get-offers (latest digest)
│   ├── subscribe.js              # POST /api/subscribe
│   ├── unsubscribe.js            # One-click token unsubscribe
│   └── manage.js                 # POST /api/manage (sends manage link)
├── src/
│   ├── scrapers/
│   │   ├── github-rss.js         # GitHub search
│   │   ├── social-monitor.js     # GitHub releases, HuggingFace blog, Reddit
│   │   ├── free-tier-scanner.js  # OpenRouter / HF / Groq / Together / Google
│   │   ├── aifree-rss.js         # aifree.dev feed
│   │   └── student-pack.js       # GitHub Student Pack
│   ├── services/
│   │   ├── ai-filter.js          # Relevance scoring + dedup
│   │   └── email-notifier.js     # Brevo email client (digest/welcome/manage)
│   └── utils/
│       ├── kv.js                 # Upstash Redis wrapper (in-memory fallback)
│       ├── unsubscribe.js        # HMAC token generation/validation
│       └── logger.js             # Structured logging
├── public/
│   └── index.html                # Dashboard (subscribe form, offer grid)
├── tests/                        # Node test suites (.mjs)
├── vercel.json                   # Cron schedule (weekly, Mon 08:00 UTC)
└── package.json
```

## Data Model (Upstash Redis)

- `subscribers` — Set of confirmed subscriber email addresses
- `subscribers:pending` — Welcome pending state (stored-before-confirm guard)
- `latest_ai_offers` — Most recent aggregated scan results

## Local Development

```bash
npm run dev
```

## Testing & Security Hardening

- **Hermetic Test Suite**: `npm test` runs 8 automated test suites (email templates, AI scoring, email regex validation, unsubscribe token verification, frontend DOM assertions, subscribe hardening, unsubscribe E2E with mock provider, and get-offers endpoint check).
- **Scraper Timeouts**: Scraper fetches wrap Node native `fetch` with `fetchWithTimeout` enforcing a 10s default `AbortSignal.timeout`.
- **Fail-Closed Cron**: `/api/check-updates` rejects unauthorized requests and fails closed (HTTP 500) if `CRON_SECRET` is unset in production. Function `maxDuration` is set to 60s in `vercel.json`.
- **Separate Rate-Limiting**: IP rate limits are differentiated per endpoint (`ratelimit:subscribe:${ip}:${day}` and `ratelimit:manage:${ip}:${day}`).
- **Tailwind CDN Note**: Production dashboard uses Tailwind CDN with inline config; future build step can replace this with precompiled static CSS if strict CSP header is added.

```bash
npm test              # full test suite (hermetic + hardening + e2e + endpoint check)
npm run test:scrapers # live scraper integration validation (GitHub, HF, OpenRouter, DeepInfra, Ollama, etc.)
node --check api/*.js src/*.js src/**/*.js scripts/*.js

# Integration suites with running server or real credentials:
npm run test:integration # runs subscribe, subscribe-idempotency, unsubscribe, kv suites
# Live-cron smoke: npm run test:smoke (triggers check-updates cron; emails real subscribers — never run casually)
```

Hermetic suites run completely offline and in-memory with zero network dependency. Integration suites automatically skip gracefully when the target server or Upstash Redis credentials are not configured.