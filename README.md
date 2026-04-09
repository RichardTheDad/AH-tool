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
- live TSM region market stats on item detail pages when a TSM API key is configured
- local TSM AuctionDB and personal ledger discovery across detected WoW account folders
- cached item metadata when live metadata is unavailable
- real CSV or JSON listing imports for scanner input
- cached imported listings after restart
- scanner readiness checks based on enabled-realm coverage and listing freshness
- history-aware ranking that penalizes thin, stale, inconsistent, or spiky sell markets
- automatic app-data retention that prunes listing and scan history older than 30 days
- suggested source-realm discovery across rotating Blizzard US batches

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

1. Create or edit `.env` in the repo root.
2. Create a Python virtual environment.
3. Install backend dependencies.
4. Install frontend dependencies.
5. Run the backend.
6. Run the frontend.

Minimum `.env` example:

```env
AZEROTHFLIPLOCAL_DATABASE_URL=sqlite:///./backend/azerothfliplocal.db
AZEROTHFLIPLOCAL_CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
AZEROTHFLIPLOCAL_DEFAULT_LISTING_PROVIDER=blizzard_auctions
AZEROTHFLIPLOCAL_ENABLE_SCHEDULER=true
AZEROTHFLIPLOCAL_LOG_LEVEL=INFO
AZEROTHFLIPLOCAL_REQUEST_TIMEOUT_SECONDS=8
AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_ID=
AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_SECRET=
AZEROTHFLIPLOCAL_BLIZZARD_API_REGION=us
AZEROTHFLIPLOCAL_BLIZZARD_LOCALE=en_US
AZEROTHFLIPLOCAL_TSM_API_KEY=
AZEROTHFLIPLOCAL_TSM_REGION_ID=1
AZEROTHFLIPLOCAL_TSM_APPHELPER_PATH=
AZEROTHFLIPLOCAL_TSM_SAVEDVARIABLES_PATH=
VITE_API_BASE_URL=http://127.0.0.1:8000
```

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
- `AZEROTHFLIPLOCAL_TSM_API_KEY`
- `AZEROTHFLIPLOCAL_TSM_REGION_ID`
- `AZEROTHFLIPLOCAL_TSM_APPHELPER_PATH`
- `AZEROTHFLIPLOCAL_TSM_SAVEDVARIABLES_PATH`
- `VITE_API_BASE_URL`

Notes:

- `.env` is the only runtime config file the app reads.
- `.env` contains real secrets and should stay local.
- `AZEROTHFLIPLOCAL_TSM_APPHELPER_PATH` is optional. If blank, the app will try to auto-detect `TradeSkillMaster_AppHelper\\AppData.lua` from a standard retail WoW install on Windows.
- `AZEROTHFLIPLOCAL_TSM_SAVEDVARIABLES_PATH` is optional. If blank, the app will try to auto-detect `TradeSkillMaster.lua` from compatible retail WoW account folders on Windows.
- local TSM SavedVariables and AppHelper data are auto-discovered across compatible WoW account folders when paths are left blank
- Local TSM AppHelper AuctionDB data can enrich the app even when the TSM web API is unavailable.

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
- rankings now include a dedicated sellability signal built from TSM turnover, local scan persistence, and personal TSM ledger history when available
- stale snapshots are penalized
- thin sell markets are penalized
- suspicious spreads are penalized
- recent sell-side history is checked so spiky one-snapshot markets get pushed down
- observed sell listings are compared with conservative recommended sell targets before profit is ranked
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
Metadata cleanup also runs automatically on startup, during scans, and on scheduled cycles so unresolved items get chipped away without manual intervention.

## Suggested Realms

The `Suggested Realms` page is separate from Scanner and does not change scanner core behavior.

It:

- inspects a rotating Blizzard US source-realm batch
- compares those source realms against your enabled tracked realms as sell targets
- reuses the same sellability and confidence model used by Scanner
- stores compact suggestion summaries instead of broad raw discovery snapshots
- shows freshness and how often a realm appeared across recent discovery runs

This feature should be read as recent source-realm guidance, not as a permanent all-time truth table.

From the page itself you can:

- refresh the next rotating discovery batch
- see how fresh the latest suggestion data is
- see how many of the recent discovery runs each realm appeared in
- track a suggested realm directly without changing the scanner core model

## Item Detail

The item detail page supports two truthful data paths:

- latest local listings already stored in SQLite
- on-demand live Blizzard lookup across your enabled tracked realms

If live metadata is configured, you can also refresh missing item metadata directly from the item detail page.

If TSM is configured, the item detail page can also show:

- `DBRegionMarketAvg`
- `DBRegionHistorical`
- `DBRegionSaleAvg`
- `DBRegionSaleRate`
- `DBRegionSoldPerDay`
- tracked-realm AuctionDB signals from your local `TradeSkillMaster_AppHelper\\AppData.lua`, including recent market value, historical value, min buyout, and auction count when available
- personal TSM ledger context from detected `TradeSkillMaster.lua` files, including prior sales, buys, cancels, expirations, and realized sale pricing when available

These are TSM region market metrics, not actual completed-sale transactions from the Blizzard Auction House.

The item detail page also includes `Auction history`, a local time-series built from this app's stored listing snapshots. It shows observed listing prices and market depth over time for each tracked realm. This is historical listing data, not completed-sale history.

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

If you use the launcher-managed `backend\.deps` install instead of a virtual environment, use:

```powershell
cd backend
$env:PYTHONPATH=".\.deps;."
& "C:\Users\Richard\AppData\Local\Python\pythoncore-3.14-64\python.exe" -m compileall app
```

That compile check is a lightweight sanity check for the backend runtime environment used by the launcher.

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
