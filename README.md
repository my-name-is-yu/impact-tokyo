# MimamoAI

**AI-powered caregiving assistant for family caregivers in Japan**

Built for the [Impact Tokyo Hackathon 2026](https://impact-tokyo.com/) — Track 1: Aging Society & Care Tech.

---

## Overview

MimamoAI helps family caregivers manage the administrative burden of daily care. Using the Claude API, it converts spoken or typed care observations into structured records, generates monthly reports for care managers, answers procedure questions in real time, and detects anomaly patterns that may require medical attention.

The target user is a family caregiver in Japan who spends significant time on paperwork and communication with care professionals. MimamoAI reduces that friction by automating the most repetitive documentation tasks.

---

## Features

| Feature | Description |
|---------|-------------|
| **Care Record Structuring** | Convert free-text observations into structured JSON care records via Claude API |
| **Monthly Report Generation** | Auto-generate care manager (ケアマネージャー) progress reports from recent records |
| **Procedure Guidance** | Real-time streaming chat for caregiving procedure questions (SSE) |
| **Anomaly Detection** | Analyze records for patterns (e.g. declining appetite, behavioral changes) with optional n8n integration |
| **Doctor Visit Memo** | Generate a concise memo for the next doctor's appointment from recent records |
| **Handover Summary** | Generate a shift-handover summary for substitute care providers |
| **Admission/Discharge Checklist** | Generate hospital admission or discharge checklists on demand |
| **Alert Management** | View detected alerts and generate care manager contact messages |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend framework | React 19 + TypeScript |
| Build tool | Vite 7 |
| Styling | TailwindCSS v4 (via `@tailwindcss/vite`) |
| Icons | lucide-react |
| Routing | React Router v7 |
| Local API server | Express 5 (port 5001) |
| Production API | Firebase Cloud Functions |
| Hosting | Firebase Hosting |
| AI | Anthropic Claude API (`claude-haiku-4-5-20251001`) |
| Workflow automation | n8n (optional, for anomaly webhook) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) Firebase CLI for deployment: `npm install -g firebase-tools`

### Install

```bash
cd app
npm install
```

### Environment Variables

Create a `.env` file in the `app/` directory:

```env
# Required — enables Claude API calls
ANTHROPIC_API_KEY=sk-ant-...

# Optional — enables n8n anomaly detection webhook
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/...
```

Without `ANTHROPIC_API_KEY`, the app still runs and returns hardcoded demo responses for all AI-powered endpoints.

### Development

All commands are run from the `app/` directory.

```bash
# Start both the Vite dev server (:5173) and Express API server (:5001) concurrently
npm run dev

# Start only the Vite client
npm run dev:client

# Start only the Express API server (with hot-reload via tsx)
npm run dev:server
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Other Commands

```bash
# Type-check and build for production
npm run build

# Lint
npm run lint

# Run the production build locally
npm run start
```

---

## Project Structure

```
impact-tokyo/
├── app/                        # All application code
│   ├── src/                    # Frontend (React + TypeScript)
│   │   ├── main.tsx            # App entry point
│   │   ├── App.tsx             # Root component, BrowserRouter + sidebar layout
│   │   ├── pages/              # Route components
│   │   │   ├── HomePage.tsx    # Dashboard (/)
│   │   │   ├── RecordPage.tsx  # New care record (/record/new)
│   │   │   ├── GuidePage.tsx   # Procedure guidance chat (/guide)
│   │   │   └── ReportPage.tsx  # Report generation (/report/new)
│   │   ├── lib/
│   │   │   ├── api.ts          # Fetch wrapper for all /api/* calls
│   │   │   ├── firebase.ts     # Firebase SDK initialization
│   │   │   └── demo-data.ts    # Seeded demo records and alerts
│   │   └── types.ts            # Shared TypeScript interfaces
│   ├── server/
│   │   └── index.ts            # Express dev server (port 5001)
│   ├── functions/
│   │   └── src/
│   │       └── index.ts        # Firebase Cloud Functions (production)
│   ├── package.json
│   └── vite.config.ts
├── CLAUDE.md                   # Project guidance for Claude Code
└── README.md
```

**Note on dual server setup:** `server/index.ts` (local dev) and `functions/src/index.ts` (Firebase production) implement the same API logic. Changes to one must be manually applied to the other.

---

## API Endpoints

Both the local Express server and Firebase Cloud Functions expose the same API surface.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/records/structure` | Structure free-text input into a care record JSON via Claude |
| `PATCH` | `/api/records/:id` | Save a draft care record; optionally triggers n8n webhook |
| `GET` | `/api/records` | List all care records |
| `POST` | `/api/records/:id/analyze` | Analyze a specific record for anomaly patterns |
| `POST` | `/api/records/doctor-memo` | Generate a doctor visit memo from recent records |
| `POST` | `/api/records/handover` | Generate a handover summary for care providers |
| `POST` | `/api/guide/message` | Chat with the procedure guide (SSE streaming response) |
| `POST` | `/api/guide/checklist` | Generate an admission/discharge checklist |
| `POST` | `/api/reports/generate` | Generate a monthly care manager report |
| `GET` | `/api/alerts` | List alert notifications |
| `POST` | `/api/alerts/:id/generate-message` | Generate a care manager contact message from an alert |
| `POST` | `/api/n8n/callback` | Receive anomaly detection results from n8n |
| `GET` | `/api/n8n/status` | Check n8n integration status |

**Streaming:** The `/api/guide/message` endpoint uses Server-Sent Events (SSE). The frontend reads the stream via a `fetch`-based reader, not `EventSource`.

**Storage:** All data is held in-memory on the server process. There is no persistent database. Restarting the server resets all records and alerts to the seeded demo data.

---

## Demo Data

The app ships with a seeded persona out of the box:

- Caregiver: **ゆう**
- Care recipient: **田中節子** (78 years old, care level 2, mild dementia)
- Three pre-seeded care records showing a declining appetite pattern
- Three pre-seeded alert notifications

This allows the app to be demoed immediately without entering real patient data.

---

## Deployment

The app deploys to Firebase Hosting (frontend) and Firebase Cloud Functions (backend API).

### First-time setup

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Log in and select your project
firebase login
firebase use --add
```

### Deploy

All deploy commands run from the `app/` directory.

```bash
# Full deploy: build frontend + deploy hosting and functions
npm run deploy

# Deploy hosting only (frontend)
npm run deploy:hosting

# Deploy functions only (backend API)
npm run deploy:functions
```

Set the `ANTHROPIC_API_KEY` environment variable in Firebase before deploying functions:

```bash
firebase functions:config:set anthropic.key="sk-ant-..."
```

---

## License

MIT
