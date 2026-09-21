# AI Offer Tracker / Free AI Tracker

Automated scanner for free AI models, time-allowed promos, and platform updates. Runs as a Vercel cron job every Monday at 08:00 UTC. Multi-user: any visitor can subscribe via the dashboard to receive the weekly AI digest by email.

## Features

- **GitHub Releases Monitor** - Tracks major AI model repositories
- **Social/Platform Monitor** - HuggingFace, Vercel, OpenAI blog updates
- **Free Tier Scanner** - Detects free models on OpenRouter, Replicate
- **AI Filtering** - Keyword-based scoring for relevance
- **Email Notifications** - Structured HTML emails via Resend to all subscribers
- **Subscription API** - Visitors subscribe via the dashboard; emails stored in Upstash Redis

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (copy `.env.example` to `.env`):
```bash
cp .env.example .env
```

3. Add your Resend API key and Upstash Redis credentials

4. Deploy to Vercel:
```bash
vercel deploy
```

## Project Structure

```
├── api/
│   ├── check-updates.js          # Cron job entrypoint
│   └── subscribe.js              # Subscription endpoint (POST /api/subscribe)
├── src/
│   ├── scrapers/
│   │   ├── github-rss.js         # GitHub releases
│   │   ├── social-monitor.js     # Platform blogs
│   │   └── free-tier-scanner.js  # Free model APIs
│   ├── services/
│   │   ├── ai-filter.js          # Relevance scoring
│   │   └── email-notifier.js     # Resend email client
│   └── utils/
│       ├── kv.js                 # Upstash Redis wrapper (in-memory fallback)
│       └── logger.js             # Structured logging
├── vercel.json                   # Cron schedule (weekly, Mon 08:00 UTC)
└── package.json
```

## Data Model (Upstash Redis)

- `subscribers` — Set of subscriber email addresses
- `latest_ai_offers` — Most recent aggregated scan results

## Local Development

```bash
npm run dev
```

## Testing

```bash
npm test
```