Absolutely — add **3 README files**:

1. Root README  
   `C:\Users\Jawad\Desktop\Trade Journaling\trade-journaling\trade-journaling-web\README.md`

2. Backend README  
   `C:\Users\Jawad\Desktop\Trade Journaling\trade-journaling\trade-journaling-web\backend\README.md`

3. Frontend README  
   `C:\Users\Jawad\Desktop\Trade Journaling\trade-journaling\trade-journaling-web\frontend\README.md`

Then commit and push again.

---

# Easiest safe method

Do **not** paste the README content into PowerShell as a heredoc unless you are comfortable with it.  
Instead, create/open the files in Notepad, paste the content, save, then push.

Run this in PowerShell:

```powershell
cd "C:\Users\Jawad\Desktop\Trade Journaling\trade-journaling\trade-journaling-web"

notepad README.md
notepad backend\README.md
notepad frontend\README.md
```

If Windows asks:

```txt
Unable to open the file... Do you want to create a new file?
```

Click **Yes** for each one.

Then paste the matching README content below into each file and save.

---

# 1) Root `README.md`

Paste this into:

```txt
C:\Users\Jawad\Desktop\Trade Journaling\trade-journaling\trade-journaling-web\README.md
```

```md
# Trade Journaling — Next.js + FastAPI

A modern trading journal, replay, playbook, backtesting, notebook, reporting, and analytics platform.

This repository contains a full-stack application:

- **Frontend:** Next.js 14, React, TypeScript, Tailwind-style UI components, Recharts
- **Backend:** FastAPI, SQLAlchemy, Alembic, PostgreSQL / Neon
- **Authentication:** JWT-based auth with tenant/user scoping
- **Modules:** Dashboard, Trade Log, Replay, Playbooks, Backtesting, Notebook, Reports, Analytics

---

## Repository Structure

```txt
trade-journaling-web/
├── backend/        FastAPI backend, Alembic migrations, services, schemas
├── frontend/       Next.js frontend, React components, API client, types
├── README.md       Root project documentation
├── .gitignore      Ignored files/folders for Git
└── .gitattributes  Line-ending and binary file handling
```

---

## Main Features

### Dashboard

High-level trading performance overview:

- Net P&L
- Win rate
- Profit factor
- Average win / loss
- Cumulative equity curve
- Daily P&L
- Recent trades
- Open positions
- Calendar view

### Trade Log

Detailed trade table with filtering, sorting, pagination, and bulk actions:

- Status filters: All / Win / Loss / Break-even / Open
- Symbol and setup search
- Account filter
- Date range filter
- Sortable columns
- MAE/MFE insights
- Best exit percentage
- Bulk playbook attachment
- Row hover preview
- Replay navigation

### Replay

Trade replay experience with candlestick context and execution markers:

- Load market candles by symbol/day/interval
- Show trade executions
- Display running P&L
- MAE/MFE visualization
- Trade note and metadata support

### Playbooks

Structured trading playbooks with rules, groups, notes, and performance:

- Playbook CRUD
- Rule groups and individual rules
- Follow-rate tracking
- Missed trade logging
- Playbook notes
- Shared playbook support
- Playbook performance overview

### Backtesting

Manual backtesting sessions with historical candle playback:

- Session creation
- Market/limit orders
- TP/SL management
- Position tracking
- Realized trade history
- Equity curve
- Session sharing
- Visibility controls

### Notebook

Internal knowledge base and trading journal notes:

- Folder hierarchy
- Notes with rich HTML content
- Tags
- Templates
- Trash / restore / permanent delete
- Share links
- Trade-linked notes
- Performance stats embedded into notes

### Reports

Operational reporting engine:

- Performance reports
- Overview stat sheet
- Day & Time reports
- Symbol reports
- Risk reports
- Playbook reports
- Tag reports, gated until trade-tag schema exists
- Options / expiry reports, gated until supporting columns exist
- Wins vs Losses
- Compare groups
- Calendar heatmap
- Cross-analysis heatmaps
- Drill-down into Trade Log

### Analytics

Advanced intelligence layer:

- Equity curve
- Drawdown profile
- Monthly performance
- P&L distribution
- Symbol edge
- Playbook edge
- Hour-of-day timing edge
- Day-of-week timing edge
- Duration analysis
- Hold-time vs outcome scatter
- Performance radar
- Dynamic insights
- Monte Carlo sequence-risk simulation
- Markov/regime tilt detection
- P&L attribution
- Auto-written narrative report

---

## Tech Stack

### Frontend

- Next.js 14
- React
- TypeScript
- Tailwind-compatible UI components
- Recharts
- Lucide icons
- Client-side auth token handling
- API client abstraction

### Backend

- FastAPI
- SQLAlchemy async ORM
- PostgreSQL / Neon
- Alembic migrations
- Pydantic schemas
- JWT authentication
- Multi-tenant data scoping
- Service-layer architecture

---

## Local Development

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create your backend `.env` file based on your local/database configuration.

Example variables you may need:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host/database
SECRET_KEY=replace-with-strong-secret
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:3000
```

Run migrations:

```powershell
alembic upgrade head
```

Start backend:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Backend should run at:

```txt
http://localhost:8000
```

Swagger docs:

```txt
http://localhost:8000/docs
```

---

### 2. Frontend

```powershell
cd frontend
npm install
```

Create `.env.local` if needed:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start frontend:

```powershell
npm run dev
```

Frontend should run at:

```txt
http://localhost:3000
```

---

## Useful Commands

### Backend

```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run migrations
alembic upgrade head

# Create a new migration
alembic revision --autogenerate -m "description"

# Start API
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
# Install dependencies
npm install

# Development server
npm run dev

# Typecheck
npm run typecheck

# Production build
npm run build

# Start production server
npm run start
```

---

## Environment Files

These files should remain local and should not be committed:

```txt
backend/.env
frontend/.env.local
```

The repository `.gitignore` is configured to ignore common secret/environment files.

---

## Current Project Status

This repository snapshot includes the major product modules:

- Dashboard
- Trade Log
- Replay
- Playbooks
- Backtesting
- Notebook
- Reports
- Analytics

### Pending Cleanup

The next maintenance phase is:

1. Restore `frontend/src/components/trade-log/trade-log-view.tsx` to clean TypeScript/TSX.
2. Make global `npm run typecheck` green.
3. Add performance improvements:
   - lazy loading
   - route-level code splitting
   - chart bundle reduction
4. Add infrastructure enhancements where useful:
   - Redis caching
   - background jobs
   - Kafka/event pipeline only where genuinely needed
5. Prepare deployment configuration.

---

## Security Notes

Do not commit:

- Database passwords
- JWT secrets
- Broker API keys
- Market data provider keys
- Private keys
- `.env` files
- Local exports/backups

Use environment variables and secret managers for deployment.

---

## License

Proprietary / private project unless explicitly changed later.
```

---

# 2) Backend `README.md`

Paste this into:

```txt
C:\Users\Jawad\Desktop\Trade Journaling\trade-journaling\trade-journaling-web\backend\README.md
```

```md
# Backend — FastAPI Trading Journal API

FastAPI backend for the Trade Journaling platform.

This service handles:

- Authentication
- Users / tenants
- Accounts
- Trades
- Executions
- Replay data
- Playbooks
- Backtesting
- Notebook
- Reports
- Analytics
- Market candle endpoints
- Broker connection scaffolding

---

## Tech Stack

- FastAPI
- SQLAlchemy async ORM
- PostgreSQL / Neon
- Alembic migrations
- Pydantic validation/schema layer
- JWT authentication
- Service-oriented architecture

---

## Folder Structure

Typical structure:

```txt
backend/
├── app/
│   ├── api/             Route handlers
│   ├── core/            Config, security, dependencies
│   ├── db/              Database session/models/base
│   ├── schemas/         Pydantic request/response models
│   ├── services/        Business logic
│   └── main.py          FastAPI application entrypoint
│
├── alembic/             Database migrations
├── alembic.ini          Alembic configuration
├── requirements.txt     Python dependencies
└── README.md
```

---

## Setup

### 1. Create virtual environment

```powershell
python -m venv .venv
```

### 2. Activate virtual environment

```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```powershell
pip install -r requirements.txt
```

If your project uses `pyproject.toml` instead, use the equivalent dependency installer.

---

## Environment Variables

Create a local `.env` file.

Do not commit `.env`.

Example variables:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host/database
SECRET_KEY=replace-with-strong-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:3000
```

Adjust names to match your actual settings module.

---

## Database Migrations

Apply migrations:

```powershell
alembic upgrade head
```

Create a new migration:

```powershell
alembic revision --autogenerate -m "description"
```

Important:

- Always review autogenerated migrations before applying.
- Never commit database secrets.
- For production, use managed migration workflows.

---

## Run API

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Default local URL:

```txt
http://localhost:8000
```

Interactive docs:

```txt
http://localhost:8000/docs
```

ReDoc:

```txt
http://localhost:8000/redoc
```

---

## Main API Areas

### Auth / Users

- Register
- Login
- Current user
- Profile/settings
- Password change
- Logout everywhere / token versioning

### Trades

- Manual trade creation
- CSV import
- Trade log listing
- Trade preview
- Batch preview metrics
- Replay payload
- Execution management
- Playbook linking

### Playbooks

- List/create/update/delete
- Groups and rules
- Rule follow tracking
- Missed trades
- Notes
- Sharing
- Visibility

### Backtesting

- Session CRUD
- Run/session state
- Orders/actions
- Progress updates
- Shares
- Visibility

### Notebook

- Folder tree
- Notes CRUD
- Tags
- Templates
- Trash/restore/purge
- Share tokens
- Export endpoints

### Reports

- Dimension reports
- Cross-analysis
- Performance metrics
- Overview stats
- Compare groups
- Calendar report
- Wins vs losses
- Capability flags for optional schema columns

### Analytics

- Equity curve
- Drawdown
- Monthly/symbol/playbook/timing/duration aggregates
- Distribution
- Scatter
- Radar scoring
- Insights
- Monte Carlo simulation
- Regime/Markov transition analysis
- Attribution
- Narrative generation

---

## Design Notes

### Tenant Safety

Most queries should be scoped by `tenant_id` and/or authenticated user context.

### Optional Columns

Reports and Analytics use metadata-based column resolution where possible.

This means:

- If a column exists, the metric can light up.
- If a column does not exist, the feature should degrade safely.
- Missing optional columns should not cause `UndefinedColumnError`.

### Closed-Trade Basis

Reports and Analytics are primarily based on realized/closed trades.

Open P&L is not treated as mark-to-market unless a live pricing feed is added.

---

## Common Commands

```powershell
# Activate venv
.\.venv\Scripts\Activate.ps1

# Run API
python -m uvicorn app.main:app --reload --port 8000

# Migrate
alembic upgrade head

# New migration
alembic revision --autogenerate -m "add something"
```

---

## Testing

If tests are configured:

```powershell
pytest
```

Recommended test areas:

- Auth flow
- Trade import
- Playbook rule follow-rate
- Report aggregation
- Analytics calculations
- Tenant isolation
- Migration upgrade/downgrade

---

## Security Checklist

Before deployment:

- Use strong `SECRET_KEY`
- Do not commit `.env`
- Restrict CORS origins
- Use managed database SSL where required
- Rotate credentials regularly
- Avoid logging tokens/passwords
- Validate all Pydantic inputs
- Keep dependencies updated
```

---

# 3) Frontend `README.md`

Paste this into:

```txt
C:\Users\Jawad\Desktop\Trade Journaling\trade-journaling\trade-journaling-web\frontend\README.md
```

```md
# Frontend — Next.js Trading Journal UI

Next.js 14 frontend for the Trade Journaling platform.

This app provides the user interface for:

- Dashboard
- Trade Log
- Replay
- Playbooks
- Backtesting
- Notebook
- Reports
- Analytics
- Settings

---

## Tech Stack

- Next.js 14
- React
- TypeScript
- Tailwind-compatible UI components
- Recharts
- Lucide icons
- Fetch-based API client
- Client-side token storage helpers

---

## Folder Structure

Typical structure:

```txt
frontend/
├── src/
│   ├── app/             Next.js App Router pages
│   ├── components/      UI and feature components
│   ├── lib/             API client, utils, auth helpers
│   ├── types.ts         Shared TypeScript interfaces
│   └── ...              Other app folders
│
├── public/              Static assets
├── package.json
├── tsconfig.json
├── next.config.js / next.config.mjs
└── README.md
```

---

## Setup

Install dependencies:

```powershell
npm install
```

Create `.env.local` if needed:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Do not commit `.env.local`.

---

## Run Development Server

```powershell
npm run dev
```

Default local URL:

```txt
http://localhost:3000
```

---

## Useful Commands

```powershell
# Development
npm run dev

# Typecheck
npm run typecheck

# Production build
npm run build

# Start production server
npm run start

# Lint, if configured
npm run lint
```

---

## Main Routes

Expected application routes:

```txt
/                   Dashboard
/trades             Trade Log
/replay             Trade Replay
/playbooks          Playbooks
/backtesting        Backtesting
/notebook           Notebook
/reports            Reports
/reports/[tab]      Report sub-pages
/analytics          Analytics
/settings           Settings
/login              Authentication
```

---

## API Client

The frontend communicates with the backend through:

```txt
src/lib/api.ts
```

The API base URL is controlled by:

```env
NEXT_PUBLIC_API_URL
```

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Authentication

The frontend uses token-based authentication.

Typical flow:

1. User logs in.
2. Backend returns access token.
3. Frontend stores token client-side.
4. API requests include:

```http
Authorization: Bearer <token>
```

Protected pages should redirect unauthenticated users to `/login`.

---

## Component Areas

### Dashboard

Displays:

- KPI cards
- Cumulative equity
- Daily P&L
- Recent trades
- Open positions
- Calendar summary

### Trade Log

Displays:

- Filterable trade table
- Sorting
- Pagination
- Bulk playbook attachment
- Hover preview
- Replay navigation

### Replay

Displays:

- Candlestick chart
- Execution markers
- Running P&L
- MAE/MFE
- Trade metadata

### Playbooks

Displays:

- Playbook list
- Rule groups
- Rules
- Performance overview
- Executed/missed trades
- Notes
- Sharing controls

### Backtesting

Displays:

- Session list
- Candle playback
- Order form
- Positions
- Realized trades
- Equity curve
- Events

### Notebook

Displays:

- Folder tree
- Notes list
- Rich editor
- Tags
- Templates
- Trash
- Share link management

### Reports

Displays:

- Performance
- Overview
- Day & Time
- Symbols
- Risk
- Playbooks
- Tags
- Options
- Wins vs Losses
- Compare
- Calendar
- Cross-analysis heatmaps

### Analytics

Displays:

- Pulse
- Equity
- Edge
- Timing
- Risk
- Simulate / Monte Carlo
- Regime / Markov
- Attribution
- Narrative report

---

## Styling

The UI uses reusable card/button/input/select components and utility classes.

Common visual tokens used in components include:

```txt
rounded-card
border-line
bg-surface
bg-canvas
text-ink
text-ink-soft
text-ink-mute
text-success
text-danger
text-warn
primary-500
primary-600
```

---

## Charts

Charts are powered by Recharts.

Used chart types include:

- Area charts
- Line charts
- Bar charts
- Composed charts
- Scatter charts
- Radar charts

For heavy chart pages, future optimization should include:

- dynamic imports
- route-level code splitting
- lazy chart component loading
- reducing re-render churn
- memoizing derived chart data

---

## TypeScript Notes

Types are centralized in:

```txt
src/types.ts
```

Backend response models should stay aligned with frontend interfaces.

Important naming convention:

- Backend Pydantic models use snake_case internally.
- API responses are serialized as camelCase.
- Frontend TypeScript interfaces use camelCase.

Example:

```txt
Backend: win_rate
API JSON: winRate
Frontend type: winRate
```

---

## Known Current Cleanup Item

The Trade Log component currently needs restoration/cleanup:

```txt
src/components/trade-log/trade-log-view.tsx
```

This does not block Reports/Analytics at runtime because Next.js compiles routes lazily, but it can block global:

```powershell
npm run typecheck
npm run build
```

Next frontend maintenance step:

1. Replace contaminated Trade Log TSX with clean TypeScript React implementation.
2. Ensure all imports/types match `api.ts` and `types.ts`.
3. Make `npm run typecheck` pass.
4. Then proceed with performance optimizations.

---

## Performance Roadmap

Planned improvements:

- Lazy-load Reports and Analytics chart components
- Split heavy modules by route
- Reduce initial bundle size
- Cache expensive aggregate requests where appropriate
- Add Redis-backed backend caching for hot report/analytics endpoints
- Add virtualized tables for very large trade logs
- Optimize Recharts rendering for large datasets

---

Developed by Jawad Naseer