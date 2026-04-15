# Phase 5: Technical Indexing Foundation - Implementation Guide

## Prerender Strategy

Azeroth Flip uses a **hybrid approach** to optimize indexing while keeping the app responsive:

- **Public pages** (`/home`, `/public/docs`): Static content that can be prerendered or cached long-term for search engine crawlers
- **Protected routes** (`/app/*`): Client-side React SPA requiring authentication, no indexing needed
- **Auth flows** (`/login`, `/reset-password`): Marked as `noindex`, shorter cache window

## Phase 5 Implementation

### Cache Headers (Per Vercel Config)

1. **Static Assets** (`/assets/**`): 1-year immutable cache
   - Vite-generated files with content hashes
   - Safe for aggressive caching

2. **Public Pages** (`/home`, `/public/docs`): 2-hour cache, must-revalidate
   - Long enough for crawler batches to reuse
   - Short enough for rapid documentation updates

3. **Root Index** (`/index.html`): 1-hour cache, must-revalidate
   - Router entry point, changes more frequently

4. **Static SEO Files** (`robots.txt`, `sitemap.xml`): 24-hour cache
   - Crawl policy and URL discovery
   - Daily refresh sufficient for most crawlers

### Is Full Prerender Needed?

Given current setup, full prerender may not be necessary because:

✅ **Already doing well:**
- Metadata and structured data embedded in HTML (loaded immediately)
- robots.txt and sitemap available statically
- Cache headers optimized for crawlers
- Public routes accessible without authentication
- Vercel edge caching for fast global delivery

⚠️ **When prerender becomes valuable:**
- If page load time or Core Web Vitals become a ranking factor priority
- If you want to serve pure static HTML to crawlers (zero JavaScript overhead)
- If you want to guarantee consistent metadata snapshots for social crawlers

### Optional: Enable Prerender

If you want full static prerendering:

1. **Install dependency:**
   ```bash
   npm install --save-dev prerender-spa-plugin @prerenderer/renderer-puppeteer
   ```

2. **Configure in vite.config.ts:**
   ```typescript
   import PrerenderSpaPlugin from 'prerender-spa-plugin';
   
   export default defineConfig({
     // ... existing config
     plugins: [
       react(),
       new PrerenderSpaPlugin({
         staticDir: path.join(__dirname, 'dist'),
         routes: ['/', '/home', '/public/docs'],
         renderer: new Puppeteer()
       })
     ]
   });
   ```

3. **Update build script:**
   ```json
   {
     "scripts": {
       "build": "tsc -b && vite build && prerender"
     }
   }
   ```

4. **Add environment trigger in vercel.json:**
   ```json
   {
     "buildCommand": "npm run build"
   }
   ```

### Rate Limiting for Protected Routes

Backend rate limiting is already in place to protect private endpoints:

- **[backend/app/core/limiter.py](backend/app/core/limiter.py)**: Protects write operations
- **[backend/app/core/mutation_limiter.py](backend/app/core/mutation_limiter.py)**: Prevents mutation abuse
- Per-user and per-IP throttling for auth endpoints

These limits apply equally to crawlers, preventing abuse while not blocking legitimate bot traffic.

## Benefits Achieved in Phase 5

✅ Cache headers optimized for indexing and performance
✅ Hybrid SPA + static approach balances speed and flexibility
✅ Public pages cached but updatable
✅ Protected routes never cached or indexed
✅ CDN edge caching via Vercel for global performance

## Next: Phase 6 - Measurement & Validation

See [MEASUREMENT.md](./MEASUREMENT.md) for crawl monitoring, indexing validation, and performance tracking.
