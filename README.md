# AzerothFlipLocal

Local-first World of Warcraft flipping analysis focused on current non-commodity opportunities across a user-managed realm list.

## Stack

- Frontend: React, Vite, TypeScript, Tailwind, TanStack Query
- Backend: FastAPI, SQLAlchemy, Pydantic, APScheduler
- Database: SQLite

## Real Data Model

The app does not ship with fake listings, demo scans, seeded market rows, or mock providers.

Supported workflows:

- live item metadata from Saddlebag WoW endpoints when configured
- cached item metadata when live metadata is unavailable
- real CSV or JSON listing imports for scanner input
- cached imported listings after restart

## Saddlebag Integration

The provider layer is built around the public WoW endpoints from the Saddlebag OpenAPI spec:

- `/api/wow/itemdata`
- `/api/wow/itemnames`
- `/api/wow/listings`
- `/api/wow/v2/listings`

Current behavior:

- `SaddlebagPublicMetadataProvider`
  - uses the real WoW POST request shapes from the spec
  - normalizes live item metadata into the local cache
- `SaddlebagPublicListingProvider`
  - uses the real WoW POST request shape from the spec
  - public listing endpoints are per-item realm lookups, not a bulk realm-scan feed
  - the bulk scanner therefore remains import-first for truthful results
- `FileImportListingProvider`
  - accepts real CSV and JSON listing snapshots
  - stores them as `source_name = "file_import"`

When live listings are unavailable or unsuitable for bulk scans, the app stays usable with imported listing data. It does not fabricate listings to fill gaps.

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
- `AZEROTHFLIPLOCAL_SADDLEBAG_METADATA_URL`
- `AZEROTHFLIPLOCAL_SADDLEBAG_LISTING_URL`
- `VITE_API_BASE_URL`

Set the Saddlebag URLs to the API origin that serves the WoW paths from the OpenAPI spec, not to a guessed custom endpoint path.

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
- scans can run immediately after a successful commit

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
