# RepoScan — Repository Intelligence Platform

> Analyze any GitHub repository for security vulnerabilities, outdated dependencies, architectural issues, and code health. AI-powered modernization roadmaps via Claude API. Track health score trends over time.

[![CI](https://github.com/yourusername/reposcan/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/reposcan/actions/workflows/ci.yml)

**[Live Demo](https://reposcan.vercel.app)** · **[Demo Video](https://loom.com/your-demo-link)**

---

## What it does

Paste a GitHub URL → get a full engineering analysis in under 60 seconds:

- **Security** — CVE vulnerability detection via OSV.dev (free, no API key needed)
- **Dependencies** — outdated package detection across npm and PyPI
- **Git Intelligence** — hotspot detection, bus factor analysis, code churn (CodeScene-inspired)
- **Architecture** — monolith/microservices/serverless classification with confidence scoring
- **Docker** — Dockerfile best practice analysis
- **Health Score** — weighted 0–100 score with named deductions per category
- **AI Recommendations** — Claude-powered prioritized action items and modernization roadmap
- **History & Trends** — health score tracked over time, scan comparison (before vs after fixes)

---

## Why this is different from SonarQube / Dependabot / CodeClimate

| Feature | RepoScan | SonarQube | Dependabot | CodeClimate |
|---|---|---|---|---|
| CVE detection | ✅ | ❌ | ✅ | ❌ |
| Git hotspot analysis | ✅ | ❌ | ❌ | ❌ |
| Bus factor analysis | ✅ | ❌ | ❌ | ❌ |
| AI modernization roadmap | ✅ | ❌ | ❌ | ❌ |
| Health score trend over time | ✅ | ❌ | ❌ | ✅ |
| Scan comparison (before/after) | ✅ | ❌ | ❌ | ❌ |
| Free to use | ✅ | Partial | ✅ | Partial |
| No installation required | ✅ | ❌ | ✅ | ❌ |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 + Tailwind | App Router, zero-config Vercel deploy |
| Backend | Node.js + Express | Same language as frontend, simple-git works natively |
| Database | PostgreSQL + Prisma | Type-safe ORM, readable migrations |
| Auth | NextAuth.js v4 (GitHub OAuth) | Full OAuth flow in ~20 lines |
| Job Queue | DB-based (PostgreSQL) | No Redis dependency, survives server restarts |
| CVE Data | OSV.dev batch API | Free, no API key, covers npm + PyPI + Go + Rust |
| AI | Claude API (claude-sonnet-4-5) | Structured JSON output, reliable reasoning |
| Deployment | Vercel + Railway + Supabase | Free tiers, zero-config |
| CI/CD | GitHub Actions | Build + migrate + Docker verify on every push |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│  Login → Repo Input → Live Polling → Results Dashboard      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│                    Express API Server                        │
│  POST /api/scans → validates → creates DB job               │
│  GET  /api/scans/:id → returns status (polled every 3s)     │
│  GET  /api/history → trend data for charts                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ Prisma
┌──────────────────────────▼──────────────────────────────────┐
│                PostgreSQL (Supabase)                         │
│  Scan table = job queue + result store                       │
│  ScanHistory = score snapshots for trend charts             │
└──────────────────────────┬──────────────────────────────────┘
                           │ polls every 5s
┌──────────────────────────▼──────────────────────────────────┐
│                   Background Worker                          │
│  Clone repo → detect stack → parse deps →                   │
│  check CVEs → check outdated → analyze git →                │
│  score health → generate AI recommendations                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Local Setup

### Prerequisites
- Node.js 20+ (`node --version`)
- Docker Desktop
- GitHub OAuth App ([create here](https://github.com/settings/developers))
- Supabase account ([free at supabase.com](https://supabase.com))

### 1. Clone and create folder structure

```bash
git clone https://github.com/yourusername/reposcan
cd reposcan
```

### 2. Environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
```

Fill in `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
GITHUB_CLIENT_ID="your_github_oauth_client_id"
GITHUB_CLIENT_SECRET="your_github_oauth_client_secret"
GITHUB_TOKEN="ghp_your_personal_access_token"
ANTHROPIC_API_KEY="sk-ant-your_key"   # optional
PORT=3001
FRONTEND_URL="http://localhost:3000"
```

Fill in `frontend/.env.local`:
```env
NEXTAUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
GITHUB_CLIENT_ID="same_as_backend"
GITHUB_CLIENT_SECRET="same_as_backend"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 3. Install and run

```bash
# Install all dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install --legacy-peer-deps && cd ..

# Start Redis
docker-compose -f docker-compose.dev.yml up -d

# Run DB migrations
cd backend && npx prisma migrate dev --name init && cd ..

# Start everything
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Run with full Docker stack (optional)

```bash
docker-compose up --build
```

---

## Deployment

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your vercel URL)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `NEXT_PUBLIC_API_URL` (your Railway backend URL)

### Backend + Worker → Railway

1. Create new Railway project
2. Add service → GitHub repo → root directory: `backend`
3. Railway detects the Dockerfile automatically
4. Add all variables from `backend/.env`
5. Add a second service for the worker — same repo, same root, override start command: `node src/worker/index.js`

### Database → Supabase

Already configured via `DATABASE_URL`. Run migrations on deploy:
```bash
npx prisma migrate deploy
```

---

## Failure cases handled

| Case | Handling |
|---|---|
| Invalid GitHub URL | Client + server validation before any DB write |
| Private / missing repo | GitHub API check before cloning |
| Repo > 200MB | Size check from GitHub API metadata |
| Malicious repo | Only `fs.readFileSync` — never execute repo code |
| Empty repo | Source file count check after clone |
| Broken package.json | try/catch per file — partial results, never crash |
| Unsupported stack | "Limited support" badge, partial results |
| Circular dependency graph | Visited Set + depth cap of 20 |
| Dockerfile edge cases | Line-by-line text parsing, handles FROM scratch + multi-stage |
| AI hallucinations | Structured findings JSON only — never raw source code |
| AI API down | Scan completes without AI — graceful fallback |
| Server restart mid-job | Orphaned job rescue on worker startup |
| Duplicate scan spam | Active scan check + 6-hour cache |
| Job timeout | 5-minute Promise.race timeout |
| Architecture misclassification | Confidence threshold — "unclear" rather than wrong |

---

## API Reference

```
POST /api/scans                    Create a new scan job
GET  /api/scans/:id                Poll scan status
GET  /api/scans/:id/result         Fetch full analysis result
POST /api/scans/:id/rescan         Force fresh scan (bypass cache)
POST /api/scans/:id/regenerate-ai  Re-run AI without re-scanning
GET  /api/history?repoUrl=...      Scan history for a repo
GET  /api/history/repos            All repos the user has scanned
GET  /api/history/compare/:a/:b    Side-by-side scan comparison
GET  /health                       Health check
```

---

## Project Structure

```
reposcan/
├── .github/workflows/ci.yml       # GitHub Actions CI pipeline
├── backend/
│   ├── Dockerfile                 # Multi-stage production image
│   ├── railway.toml               # Railway deployment config
│   ├── prisma/schema.prisma       # DB schema (User, Scan, ScanHistory)
│   └── src/
│       ├── server.js              # Express entry point
│       ├── worker/index.js        # Background job processor
│       ├── routes/
│       │   ├── scans.js           # Scan CRUD + AI regenerate
│       │   └── history.js         # History + comparison endpoints
│       ├── analysis/
│       │   ├── index.js           # Pipeline orchestrator (8 steps)
│       │   ├── get-files.js       # Smart file traversal
│       │   ├── git-metrics.js     # Hotspots, bus factor, churn
│       │   ├── scoring.js         # Weighted health score
│       │   ├── detectors/         # Stack + architecture detection
│       │   ├── parsers/           # npm, python, CVE, outdated, docker
│       │   └── ai/                # Prompt builder + Claude/OpenAI client
│       └── lib/
│           ├── prisma.js          # Singleton DB client
│           └── github.js          # URL parsing + API helpers
└── frontend/
    ├── vercel.json                # Vercel deployment config
    ├── app/
    │   ├── dashboard/page.js      # Main analysis page
    │   ├── history/page.js        # All scanned repos
    │   ├── login/page.js          # GitHub OAuth login
    │   └── api/auth/              # NextAuth handler
    ├── components/dashboard/
    │   ├── HealthScoreCard.js     # Score ring + deductions
    │   ├── VulnerabilityCard.js   # CVE list with severity
    │   ├── OutdatedDepsCard.js    # Version comparison
    │   ├── GitMetricsCard.js      # Hotspots/bus factor/churn tabs
    │   ├── StackCard.js           # Tech stack + architecture
    │   ├── ai/                    # AI summary + recommendations
    │   └── history/               # Trend chart + comparison panel
    └── lib/
        ├── api.js                 # All backend API calls
        └── hooks/useScanStatus.js # 3s polling hook
```
