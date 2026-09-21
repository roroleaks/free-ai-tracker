# AI Offer Tracker

Automated scanner for free AI models, time-allowed promos, and platform updates. Runs as a Vercel cron job every 6 hours.

## Features

- **GitHub Releases Monitor** - Tracks major AI model repositories
- **Social/Platform Monitor** - HuggingFace, Vercel, OpenAI blog updates
- **Free Tier Scanner** - Detects free models on OpenRouter, Replicate
- **AI Filtering** - Keyword-based scoring for relevance
- **Email Notifications** - Structured HTML emails via Resend

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (copy `.env.example` to `.env`):
```bash
cp .env.example .env
```

3. Add your Resend API key and email addresses

4. Deploy to Vercel:
```bash
vercel deploy
```

## Project Structure

```
├── api/
│   └── check-updates.js          # Cron job entrypoint
├── src/
│   ├── scrapers/
│   │   ├── github-rss.js         # GitHub releases
│   │   ├── social-monitor.js     # Platform blogs
│   │   └── free-tier-scanner.js  # Free model APIs
│   ├── services/
│   │   ├── ai-filter.js          # Relevance scoring
│   │   └── email-notifier.js     # Resend email client
│   └── utils/
│       └── logger.js             # Structured logging
├── vercel.json                   # Cron schedule (every 6 hours)
└── package.json
```

## Local Development

```bash
npm run dev
```

## Testing

```bash
npm test
```