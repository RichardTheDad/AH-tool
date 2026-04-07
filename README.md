# AzerothFlipLocal

Local-first World of Warcraft flipping analysis focused on current non-commodity opportunities across a user-managed realm list.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind, TanStack Query
- Backend: FastAPI, SQLAlchemy, Pydantic, APScheduler
- Database: SQLite

## Real Data Model

The app does not ship with fake listings, demo scans, seeded market rows, or mock providers.

Supported workflows:

- live Blizzard Retail Auction House ingestion when Battle.net credentials are configured
- live item metadata from Blizzard when Battle.net credentials are configured
- cached item metadata when live metadata is unavailable
- real CSV or JSON listing imports for scanner input
- cached imported listings after restart
- scanner readiness checks based on enabled-realm coverage and listing freshness
- history-aware ranking that penalizes thin, stale, inconsistent, or spiky sell markets

## Blizzard Integration

Current behavior:

- `BlizzardAuctionListingProvider`
  - uses Battle.net client credentials with the official Blizzard retail AH API
  - resolves tracked realms to connected realms and ingests non-commodity auctions automatically
  - can bootstrap the scanner even when no local listing cache exists yet
- `BlizzardMetadataProvider`
  - uses Blizzard item and item-media endpoints
  - normalizes live item metadata into the local cache
- `FileImportListingProvider`
  - accepts real CSV and JSON listing snapshots
  - stores them as `source_name = "file_import"`

When live listings are unavailable, the app stays usable with imported listing data. It does not fabricate listings to fill gaps.

## Project Layout

```text
backend/
  app/
    main.py
    core/
    db/
    schemas/
    providers/
    services/
    api/
    jobs/
    tests/

frontend/
  src/
    api/
    components/
    pages/
    hooks/
    store/
    types/
    utils/
```

## Setup

1. Copy `.env.example` to `.env`.
2. Create a Python virtual environment.
3. Install backend dependencies.
4. Install frontend dependencies.
5. Run the backend.
6. Run the frontend.

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## One-Click Start

If you want the Windows launcher:

```powershell
.\start_azerothfliplocal.cmd
```

It will:

- resolve Python automatically, preferring your local install path
- install backend dependencies into `backend\.deps` when needed
- install frontend dependencies into `frontend\node_modules` when needed
- open one PowerShell window for FastAPI on `http://127.0.0.1:8000`
- open one PowerShell window for Vite on `http://127.0.0.1:5173`
- open the app in your browser

## Environment Variables

Important values:

- `AZEROTHFLIPLOCAL_DATABASE_URL`
- `AZEROTHFLIPLOCAL_DEFAULT_LISTING_PROVIDER`
- `AZEROTHFLIPLOCAL_ENABLE_SCHEDULER`
- `AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_ID`
- `AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_SECRET`
- `AZEROTHFLIPLOCAL_BLIZZARD_API_REGION`
- `AZEROTHFLIPLOCAL_BLIZZARD_LOCALE`
- `VITE_API_BASE_URL`

## Recommended Daily-Driver Setup

For the most hands-off local setup:

1. create Blizzard Battle.net client credentials
2. set `AZEROTHFLIPLOCAL_DEFAULT_LISTING_PROVIDER=blizzard_auctions`
3. set `AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_ID` and `AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_SECRET`

With that setup:

- the scheduler can refresh retail non-commodity listings automatically from Blizzard
- the scanner can bootstrap itself from live Blizzard data even when the local cache starts empty
- item names, class data, quality, and icons can also be refreshed from Blizzard
- imports remain available as a fallback if you want to supplement or replace local coverage manually

## Import Workflow

Use the Imports page or `POST /imports/listings`.

Supported fields:

- `item_id`
- `realm`
- `lowest_price`
- `average_price`
- `quantity`
- `listing_count`
- `captured_at`

Behavior:

- preview validates rows without writing to SQLite
- commit stores rows as `source_name = "file_import"`
- duplicate rows are skipped with a clear summary
- invalid rows are reported without crashing the import
- successful commits can refresh missing item metadata from Blizzard when configured
- preview and commit responses include coverage details for realms, items, and snapshot window
- scans can run immediately after a successful commit

## Scanner Trust Model

The scanner keeps the original realm-list model:

1. find the absolute cheapest buy realm for each item across enabled tracked realms
2. hold that buy realm fixed
3. choose the best sell realm from the remaining tracked realms

Trust-oriented behavior:

- rankings are based on the latest local snapshot per item per realm
- stale snapshots are penalized
- thin sell markets are penalized
- suspicious spreads are penalized
- recent sell-side history is checked so spiky one-snapshot markets get pushed down
- same-realm buy and sell is rejected

When metadata is missing:

- if live metadata is configured, unresolved items are excluded from non-commodity scans until metadata is refreshed
- if live metadata is not configured, the scanner can still run from imports, but it warns when items are being evaluated without verified metadata

## Scanner Readiness

The Dashboard and Scanner pages now surface whether the app is actually ready for a trustworthy run.

Readiness considers:

- enabled realms with listing data
- enabled realms with fresh listing data
- unique item coverage in the local cache
- items still missing metadata
- enabled realms with no local listing coverage yet

The scheduler uses the same readiness check and skips automatic re-scans when there is not enough local data to produce a meaningful cross-realm comparison.

## Item Detail

The item detail page supports two truthful data paths:

- latest local listings already stored in SQLite
- on-demand live Blizzard lookup across your enabled tracked realms

If live metadata is configured, you can also refresh missing item metadata directly from the item detail page.

## Provider States

The UI reports provider state explicitly:

- `available`
- `cached only`
- `unavailable`
- `error`

Examples:

- live metadata unavailable, but cached metadata still usable
- live listings unavailable for bulk scans, import required
- cached imported listings available after restart
- transient provider failures do not permanently degrade status if later checks succeed

For Blizzard listings specifically:

- `available` means live retail AH refresh can run now
- `cached only` means Blizzard snapshots are stored locally but live Blizzard refresh is not currently configured or reachable

## Tests

### Backend

```powershell
cd backend
pytest
```

### Frontend

```powershell
cd frontend
npm test
```

### Frontend build

```powershell
cd frontend
npm run build
```

## Notes

- No auth
- No premium token dependency
- No Discord login
- No watchlist system
- No sniper system
- No frontend calls to third-party APIs
- No fake runtime listings or demo scan output
- Remote provider failures are logged and surfaced without crashing the app

## Release Checklist

Before cutting a release, walk through [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
