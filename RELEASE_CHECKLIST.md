# Release Checklist

## Before Deploy

1. Confirm environment variables are set in production:
   - AZEROTHFLIPLOCAL_DATABASE_URL
   - AZEROTHFLIPLOCAL_SUPABASE_URL
   - AZEROTHFLIPLOCAL_SUPABASE_JWT_SECRET
   - AZEROTHFLIPLOCAL_CORS_ORIGINS
   - AZEROTHFLIPLOCAL_RESTRICT_HEALTH_DIAGNOSTICS=true
   - AZEROTHFLIPLOCAL_HEALTH_DIAGNOSTICS_API_KEY
2. Run backend tests:
   - `cd backend`
   - `pytest`
3. Run frontend tests and build:
   - `cd frontend`
   - `npm test`
   - `npm run build`
4. Use the single root Fly configuration and deploy from repo root:
   - `cd .`
   - `fly deploy --config fly.toml --remote-only`

## Post Deploy Smoke Checks

1. Verify liveness endpoint:
   - `GET /health` returns status ok.
2. Verify detailed diagnostics are protected:
   - `GET /health/scheduler` without auth/key returns 401.
   - `GET /health/scheduler` with `X-Health-Key` returns 200.
3. Verify auth flow:
   - Log in from frontend and load dashboard and scanner.
   - Expire session (or use invalid token) and verify redirect to login occurs.
4. Verify core product flows:
   - Create/update/delete preset.
   - Create/update/delete tracked realm.
   - Run scan and inspect scanner results.

## Rollback

1. If deployment is unhealthy:
   - Roll back to previous Fly release from Fly dashboard or CLI.
2. Keep latest database backups before applying schema migrations.
