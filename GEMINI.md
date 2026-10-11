# Project Guidelines & Fixed Workflow Rules

## 1. Mobile Interface Optimization (Mandatory for Every Edit)
- Any frontend or UI modification must be fully responsive and optimized for mobile screens (320px–414px+ viewports).
- Ensure all interactive elements have touch-friendly tap targets (minimum 44×44px or with `.touch-tap`).
- Prevent mobile iOS/Android auto-zoom by keeping text input font sizes at `text-base sm:text-sm` (>= 16px on mobile).
- Keep horizontal navigation swipeable via `.no-scrollbar` and `overflow-x-auto`.
- Ensure no accidental horizontal page overflow or clipping.

## 2. Full Test Suite Verification (Mandatory Before Completion)
- Before marking any task complete or deploying, run the full test suite:
  ```bash
  npm test
  node tests/get-offers.test.mjs
  ```
- All assertions (HTML templates, AI scoring, email regex, HMAC unsubscribe tokens, and 55/55 frontend checks) must pass with exit code 0.

## 3. Snapshot ZIP Generation (Mandatory on User PC)
- After completing edits and tests, automatically produce a clean, updated ZIP snapshot of the project on the user's PC:
  - Destination 1: `C:\Users\raouf.RAOUFDESKTOP\.gemini\antigravity\scratch\free-ai-tracker-snapshot.zip`
  - Destination 2: `C:\Users\raouf.RAOUFDESKTOP\Downloads\free-ai-tracker-snapshot.zip`
- Exclude ephemeral and dependency directories (`node_modules`, `.vercel`, build caches) to keep the snapshot compact and portable.
