# AzerothFlipLocal Release Checklist

Use this checklist before calling the app release-ready.

## Repository Hygiene

- Confirm `git status` only shows intentional release changes.
- Remove local caches and runtime artifacts:
  - `backend/app/**/__pycache__/`
  - `frontend/dist/`
  - `frontend/*.tsbuildinfo`
  - local SQLite WAL/SHM files
- Verify removed providers and schemas are not referenced anywhere:
  - `saddlebag_*`
  - `mock_*`

## Configuration

- Confirm [.env.example](./.env.example) matches the current Blizzard-first setup.
- Confirm [README.md](./README.md) setup steps match the launcher and manual run paths.
- Confirm required env vars are documented:
  - `AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_ID`
  - `AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_SECRET`
  - `AZEROTHFLIPLOCAL_DEFAULT_LISTING_PROVIDER`
  - `AZEROTHFLIPLOCAL_DATABASE_URL`
  - `VITE_API_BASE_URL`

## Backend Verification

- Run backend tests and confirm they pass.
- Verify SQLite startup works from the launcher.
- Verify `/health`, `/providers/status`, `/scans/readiness`, and `/scans/status` all return expected payloads.
- Verify provider status messages are truthful for:
  - Blizzard available
  - Blizzard unavailable
  - cached/import fallback
  - provider error recovery

## Frontend Verification

- Run frontend tests and confirm they pass.
- Run a production build and confirm it succeeds.
- Verify scanner filters, presets, sorting, export, and empty states render correctly.
- Verify scan-in-progress locking disables risky actions on Scanner and Realms pages.

## Manual Release QA

- Start the app with `.\start_azerothfliplocal.cmd`.
- Add at least two tracked realms.
- Run a live Blizzard scan.
- Confirm scan results persist after restart.
- Confirm item detail loads and metadata refresh works.
- Confirm `Refresh missing metadata` works from the Scanner page.
- Confirm CSV export downloads the filtered scanner results.
- Confirm provider failures are readable and non-fatal.
- Confirm import fallback still works when Blizzard credentials are missing or disabled.

## Trust Checks

- Spot-check that sell targets look conservative for thin/spiky markets.
- Spot-check that confidence explanations are believable for top-ranked results.
- Confirm same-realm buy/sell is never emitted.
- Confirm commodities stay excluded by default.

## Release Notes

- Summarize major behavior changes since the last internal build.
- Note any known limitations that still remain.
- Record the exact test commands and their pass status.
