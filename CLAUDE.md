# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MimamoAI — an AI-powered caregiving assistant for family caregivers in Japan. Built for the Impact Tokyo Hackathon 2026 (Track 1: Aging Society & Care Tech). The app automates care record structuring, care manager report generation, procedure guidance, and anomaly detection using Claude API.

## Commands

All commands run from the `app/` directory:

```bash
# Development (starts both Vite client + Express server concurrently)
npm run dev

# Client only (Vite dev server on :5173)
npm run dev:client

# Server only (Express API on :5001, with tsx watch)
npm run dev:server

# Build
npm run build

# Lint
npm run lint

# Production
npm run start

# Deploy (Firebase Hosting + Functions)
npm run deploy
npm run deploy:hosting   # hosting only
npm run deploy:functions # functions only
```

**Environment variable:** `ANTHROPIC_API_KEY` must be set for Claude API calls. Without it, several endpoints return hardcoded demo responses.

**Optional:** `N8N_WEBHOOK_URL` for n8n anomaly detection workflow integration.

## Architecture

### Frontend (React + Vite + TailwindCSS v4)

- **Entry:** `app/src/main.tsx` → `App.tsx` (BrowserRouter with sidebar layout)
- **Pages:** 4 routes — `/` HomePage, `/record/new` RecordPage, `/guide` GuidePage, `/report/new` ReportPage
- **Lib:** `api.ts` (fetch wrapper for all `/api/*` calls), `firebase.ts` (Firebase SDK init), `demo-data.ts` (seeded demo records/alerts)
- **Types:** `types.ts` — shared interfaces (CareRecord, StructuredData, Report, GuideSession, AlertNotification)
- **Styling:** TailwindCSS v4 via `@tailwindcss/vite` plugin, plus CSS custom properties for theming (`var(--primary)`, `var(--surface)`, etc.)
- **Icons:** lucide-react

### Backend — Two Parallel Implementations

1. **Local dev server:** `app/server/index.ts` — Express server (port 5001), proxied from Vite via `/api` → `localhost:5001`
2. **Production:** `app/functions/src/index.ts` — Firebase Cloud Functions (same logic, exported as `onRequest`)

Both use **in-memory storage** (no persistent DB despite Firebase/Firestore SDK being installed). Demo data is seeded on startup.

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/records/structure` | Structure free-text into care record JSON via Claude API |
| PATCH | `/api/records/:id` | Save draft record (also triggers n8n webhook if configured) |
| GET | `/api/records` | List all records |
| POST | `/api/guide/message` | Chat with procedure guide (SSE streaming) |
| POST | `/api/reports/generate` | Generate monthly care manager report |
| GET | `/api/alerts` | List alert notifications |
| POST | `/api/alerts/:id/generate-message` | Generate care manager contact message from alert |
| POST | `/api/records/:id/analyze` | Analyze record for anomaly patterns |
| POST | `/api/records/doctor-memo` | Generate doctor visit memo from recent records |
| POST | `/api/records/handover` | Generate handover summary for care providers |
| POST | `/api/guide/checklist` | Generate admission/discharge checklist |
| POST | `/api/n8n/callback` | Receive anomaly detection results from n8n |
| GET | `/api/n8n/status` | Check n8n integration status |

### Claude API Usage

All calls use `claude-haiku-4-5-20251001` with temperature 0–0.3. The guide endpoint uses SSE streaming. Prompts are in Japanese, targeting care record structuring and procedure guidance.

### Demo Data

Hardcoded persona: caregiver "ゆう" caring for "田中節子" (78, care level 2, mild dementia). Three seeded care records showing declining appetite pattern, plus three alert notifications.

## Key Design Decisions

- **In-memory store:** No persistent database — records/alerts live only in server memory. Restart clears data.
- **Dual server setup:** `server/index.ts` for local dev, `functions/src/index.ts` for Firebase deployment. Changes must be synchronized manually.
- **SSE streaming:** The `/api/guide/message` endpoint uses Server-Sent Events, not WebSocket. Frontend reads via `EventSource`-style fetch streaming.
- **Fallback responses:** When `ANTHROPIC_API_KEY` is not set, endpoints return hardcoded demo responses instead of failing.
