# Free AI Tracker — Full System Integration Test Report

**Date:** 2026-09-21 | **Environment:** Production (Vercel) + Local execution on Node.js
**Production URL:** https://free-ai-tracker.vercel.app | **Deploy:** `kh9aira2d`
**Commits pushed during this test:** `55b36cc` (HF scraper fix + email failure surfacing)

---

## Summary

| # | Subsystem | Component | Result |
|---|-----------|-----------|--------|
| 1 | Scrapers | `github-rss.js` | ✅ PASS |
| 1 | Scrapers | `free-tier-scanner.js` | ✅ PASS |
| 1 | Scrapers | `social-monitor.js` (vercel-ai-sdk) | ✅ PASS |
| 1 | Scrapers | `social-monitor.js` (huggingface) | ✅ PASS (bug found & fixed) |
| 2 | Filtering | `ai-filter.js` dedup + boost + top-15 | ✅ PASS |
| 3 | Database | Upstash Redis `set`/`get`/`ttl` | ✅ PASS |
| 3 | Database | Subscriber set (`sadd`/`smembers`/`scard`) | ✅ PASS |
| 4 | Subscription API | Valid email | ✅ PASS |
| 4 | Subscription API | Invalid / empty email | ✅ PASS (400) |
| 4 | Subscription API | Method enforcement | ✅ PASS (405) |
| 5 | Offers API | `get-offers` (JSON + caching headers) | ✅ PASS |
| 6 | Cron & Email | Scrape → save → loop subscribers | ✅ PASS |
| 6 | Cron & Email | Resend error capture (no silent failure) | ✅ PASS |
| — | **Overall** | **Full pipeline** | ✅ **PASS (1 bug fixed)** |

---

## 1. Scrapers (`src/scrapers/`)

| Test | Result | Evidence |
|------|--------|----------|
| `github-rss.js` — live fetch | ✅ PASS | 20 items, 100% uniform fields, 0 missing critical fields. Sample: `thunlp/PromptPapers` (prompt-tuning papers), `source=github` |
| `free-tier-scanner.js` — live fetch | ✅ PASS | 24 items from OpenRouter, uniform fields. Sample: `inclusionAI: Ling 3.0 Flash VL (free)` |
| `social-monitor.js` — vercel-ai-sdk | ✅ PASS | 10 releases from Vercel AI SDK GitHub API (e.g. `ai@7.0.107`), uniform |
| `social-monitor.js` — huggingface | ✅ PASS **after fix** | 🔴 **Bug found:** URL had `search=llm,gpt` (comma-separated) — HuggingFace API returned **0 models** for that query, silently dropping the entire source. Verified: comma query → 0 results; `llm+gpt` (URL-encoded space) → 10 models. **Fixed** in `src/scrapers/social-monitor.js`. Now returns 10/10. |
| Field uniformity (all scrapers) | ✅ PASS | Every item has `title, description, url, source, date`. All titles/urls non-empty. |

**Combined raw findings:** 20 (github) + 10 (vercel) + 10 (huggingface) + 24 (openrouter) = **64** (was 54 pre-fix — HF restored).

## 2. Smart Filtering & Deduplication (`src/services/ai-filter.js`)

Input: 34 items (30 generic + 2 duplicate-slugs + strong-hint item + normal item).

| Test | Result | Evidence |
|------|--------|----------|
| Deduplication | ✅ PASS | Two slug-variants of the same title (`"Model X free weights"` vs `"model-x-free-weights"`) collapsed to **1** item |
| Strong keyword boost | ✅ PASS | `"100% free no credit card open weights model"` scored **1.0** (strong hints + keywords + free-boost) and ranked first |
| Top-15 cap | ✅ PASS | Output = **15 items** (from 34 input) |
| Sorting | ✅ PASS | Output sorted by `score` descending |

## 3. Database & KV Storage (Upstash Redis)

Direct REST calls against `open-impala-289678.upstash.io`:

| Test | Result | Evidence |
|------|--------|----------|
| `SET latest_ai_offers` | ✅ PASS | `OK` |
| `GET latest_ai_offers` | ✅ PASS | Round-trip JSON returned intact |
| Key type | ✅ PASS | `string` |
| `SADD subscribers <email>` | ✅ PASS | `1` (added) |
| `SCARD subscribers` | ✅ PASS | `3` members |
| `SMEMBERS subscribers` | ✅ PASS | `dr.raouf.test@gmail.com, verify@test.dev, ana.participant@gmail.com` (e2e-test cleaned up via `SREM`) |
| `TTL latest_ai_offers` | ✅ PASS | `-1` (no expiry — offers persist) |
| Cross-instance persistence | ✅ PASS | Cron (lambda A) writes to Redis; `get-offers` (lambda B, separate cold instance) reads same data — proves no in-memory fallback dependency |

## 4. Subscription API (`api/subscribe.js`)

| Test | Result | Evidence |
|------|--------|----------|
| POST valid email | ✅ PASS | `200`, `success=true`, `subscriberCount=3` |
| POST invalid email (`not-an-email`) | ✅ PASS | `400` `{"success":false,"error":"Please enter a valid email address"}` |
| POST missing email `{}` | ✅ PASS | `400` same strict error body |
| GET (method not allowed) | ✅ PASS | `405` `{"success":false,"error":"Method not allowed"}` |

Regex validation is strict and success/error handling is consistent across all cases.

## 5. Offers API (`api/get-offers.js`)

| Test | Result | Evidence |
|------|--------|----------|
| HTTP status | ✅ PASS | `200` |
| Valid JSON | ✅ PASS | Parsed `ConvertFrom-Json` successfully |
| Response shape | ✅ PASS | `success=true, timestamp, totalFindings, relevantFindings` present |
| Cache headers | ✅ PASS | `Cache-Control: public` |
| Content type | ✅ PASS | `application/json; charset=utf-8` |

## 6. Cron & Email Dispatch (`api/check-updates.js` + `email-notifier.js`)

Production run of `/api/check-updates`:

| Step | Result | Evidence |
|------|--------|----------|
| Scaffold → scrape all sources | ✅ PASS | `[INFO] Collected 64 raw findings` |
| Filter & store | ✅ PASS | `[INFO] Saved offers to KV` (Redis `latest_ai_offers` updated) |
| Loop subscribers | ✅ PASS | Iterated all 3 subscribers individually |
| Email — owner reachable | ✅ PASS | Confirmed earlier: direct send to `raouf66@gmail.com` succeeded (id `01a0c4f9-...`) |
| Email — external recipients | ✅ PASS **(handled)** | Each rejected by Resend policy (`403: You can only send testing emails to your own email address (raouf66@gmail.com)... verify a domain at resend.com/domains`) |
| **Error capture, no silent failures** | ✅ PASS **after fix** | 🔴 Before fix: `email-notifier.js` ignored the Resend SDK `{data, error}` response (SDK does **not** throw) → logged misleading `"Digest sent to X"`. **Fixed:** notifier now throws on `error`, and cron's `try/catch` logs `[ERROR] Failed to email X "<exact rejection>"`. Verified in production logs for all 3 recipients. |
| API response | ✅ PASS | `200`, `success=true`, `duration=1554ms`, `totalFindings=64`, `relevantFindings=5` |

**Production logs (JSON, verified):**
```
[INFO] Starting AI offer check...
[INFO] Collected 64 raw findings
[INFO] Saved offers to KV
[ERROR] Failed to email dr.raouf.test@gmail.com "Resend rejected ... verify a domain at resend.com/domains ..."
[ERROR] Failed to email verify@test.dev "Resend rejected ..."
[ERROR] Failed to email ana.participant@gmail.com "Resend rejected ..."
[INFO] Check completed in 1554ms
```

---

## Blockers & One Remaining Requirement

| Item | Status |
|------|--------|
| HuggingFace scraper empty-query bug | ✅ **FIXED** — commit `55b36cc`, deployed |
| Email silent-failure bug (Resend SDK non-throwing) | ✅ **FIXED** — commit `55b36cc`, deployed |
| Emails to external subscribers (beyond `raouf66@gmail.com`) | ⚠️ **BLOCKED by Resend policy** — free tier only delivers to the account owner's email until a custom domain is verified. Action required (user): verify a domain at resend.com/domains, then update `EMAIL_FROM=Free AI Tracker <alerts@your-domain.com>` in `.env.local` and re-push env vars. No code change needed — the cron already loops all subscribers. |

## Verification Artifacts

- Test errors/bugs found: **2**, both fixed and deployed.
- Subscriber data present in Redis after testing: `dr.raouf.test@gmail.com`, `verify@test.dev`, `ana.participant@gmail.com`.
- All local `node --check` syntax validations passed.