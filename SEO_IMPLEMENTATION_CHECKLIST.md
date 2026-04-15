# Phase 5-6: SEO Implementation Checklist

Complete checklist for verifying Phase 5 (Prerender) and Phase 6 (Measurement) implementation.

## Phase 5: Technical Indexing Foundation ✅

### Frontend Build & Caching
- [x] Vite configured with React plugin
- [x] CSS and JS assets optimized
- [x] vercel.json headers configured for:
  - [x] robots.txt (24h cache)
  - [x] sitemap.xml (24h cache)
  - [x] index.html (1h cache, must-revalidate)
  - [x] assets/* (1 year, immutable)
  - [x] public pages (2h cache, must-revalidate)
- [x] prerender.config.js created for future enhancement

### Public Route Setup
- [x] Homepage (`/home`) created and indexable
- [x] Documentation (`/public/docs`) created and indexable
- [x] Root redirect (`/`) routes to `/home` if public, `/app` if authenticated
- [x] Robots.txt allows public routes, disallows `/app`
- [x] Sitemap includes public routes

### Metadata & Structured Data
- [x] HTML head metadata expanded
- [x] Open Graph tags dynamically managed
- [x] Twitter Card tags in place
- [x] JSON-LD Organization schema added
- [x] JSON-LD SoftwareApplication schema added
- [x] Canonical links set

### Protected Route Handling
- [x] `/app/*` routes marked as noindex
- [x] `/login` marked as noindex
- [x] `/reset-password` marked as noindex

---

## Phase 6: Measurement & Validation 📊

### Monitoring Infrastructure

#### Backend Logging
- [x] Crawler detection utility: `is_search_crawler()` in `app/core/logging.py`
- [x] Health endpoint logs crawler access
- [x] User-Agent header monitoring enabled

#### Frontend Logging (Optional)
- [ ] Bot detection in navigation hooks (optional enhancement)
- [ ] Page view analytics for crawler traffic (optional)

### Verification Tests

#### 1. Static Files Accessibility ✓

```bash
# Test robots.txt availability
curl -I https://azerothfliplocal.com/robots.txt
# Expected: 200 OK, Content-Type: text/plain

# Test sitemap availability
curl -I https://azerothfliplocal.com/sitemap.xml
# Expected: 200 OK, Content-Type: application/xml
```

#### 2. Public Routes Reachability ✓

```bash
# Test homepage
curl -s https://azerothfliplocal.com/home | grep -o "<title>.*</title>"
# Expected: <title>Azeroth Flip - WoW Market Flipping Tool</title>

# Test docs
curl -s https://azerothfliplocal.com/public/docs | grep -o "<title>.*</title>"
# Expected: <title>Documentation - Azeroth Flip</title>
```

#### 3. Metadata Presence ✓

```bash
# Check for meta description
curl -s https://azerothfliplocal.com/ | grep -o 'name="description".*content="[^"]*"'
# Expected: Contains description meta tag

# Check for Open Graph
curl -s https://azerothfliplocal.com/home | grep -o 'property="og:title"'
# Expected: og:title meta property found

# Check for structured data
curl -s https://azerothfliplocal.com/ | grep -c "application/ld+json"
# Expected: 2 (Organization + SoftwareApplication schemas)
```

#### 4. Robots Policy Enforcement ✓

```bash
# Verify public route is crawlable
curl -s https://azerothfliplocal.com/robots.txt | grep -A2 "Allow: /home"
# Expected: /home listed in Allow rules

# Verify app route is blocked
curl -s https://azerothfliplocal.com/robots.txt | grep "Disallow: /app"
# Expected: /app listed in Disallow rules
```

#### 5. Private Route Protection ✓

```bash
# Verify noindex on app routes (if possible to access as anonymous)
curl -s https://azerothfliplocal.com/app 2>/dev/null | grep -i "noindex"
# Expected: Contains noindex meta tag

# Verify public/docs is NOT marked noindex
curl -s https://azerothfliplocal.com/public/docs | grep -i "robots.*noindex"
# Expected: No noindex for this route (should say "index, follow")
```

#### 6. API Protection ✓

```bash
# Verify health endpoint public access
curl -I https://api.azerothfliplocal.com/health
# Expected: 200 OK

# Verify private endpoint requires auth
curl -I https://api.azerothfliplocal.com/scans
# Expected: 401 or 403 (Unauthorized/Forbidden)
```

#### 7. Cache Headers ✓

```bash
# Check cache headers on public pages
curl -I https://azerothfliplocal.com/home
# Expected: Cache-Control: public, max-age=7200, must-revalidate

# Check immutable assets
curl -I https://azerothfliplocal.com/assets/index-*.js | head -5
# Expected: Cache-Control: public, max-age=31536000, immutable
```

### Search Console Setup Tasks

- [ ] Add domain to Google Search Console
- [ ] Verify site ownership (meta tag placed at deployment)
- [ ] Submit sitemap: `https://azerothfliplocal.com/sitemap.xml`
- [ ] Monitor indexed pages (target: 2 public pages)
- [ ] Check for crawl errors
- [ ] Monitor Core Web Vitals
- [ ] Register with Bing Webmaster Tools
- [ ] Add to Baidu Webmaster (for Asia-Pacific reach)

### Third-Party Validation

- [ ] Test with [Google Rich Results Test](https://search.google.com/test/rich-results)
  - Expected: Organization and SoftwareApplication schemas recognized
- [ ] Test with [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/sharing/)
  - Expected: Proper OG tags rendered for `/home` and `/public/docs`
- [ ] Test with [Twitter Card Validator](https://cards-dev.twitter.com/validator)
  - Expected: Twitter card meta tags recognized

### Performance Benchmarks

- [ ] Run [Lighthouse](https://developers.google.com/web/tools/lighthouse) on `/home`
  - Target: SEO > 90, Performance > 85
- [ ] Run [Lighthouse](https://developers.google.com/web/tools/lighthouse) on `/public/docs`
  - Target: SEO > 90, Performance > 85
- [ ] Monitor Core Web Vitals via Search Console
  - Target: LCP < 2.5s, CLS < 0.1, FID < 100ms

### Crawler Monitoring

- [ ] Check backend logs for crawler access patterns
  - Command: `grep "Crawler" backend.log` (after deployment)
- [ ] Verify rate limits apply correctly to bots
- [ ] Monitor for any unusual crawler patterns (signs of abuse)

### Monthly Monitoring Tasks

- [ ] Review Google Search Console impressions for public pages
- [ ] Check click-through rate (CTR) for branded keywords
- [ ] Review Core Web Vitals trends
- [ ] Check for any new crawl errors
- [ ] Update structured data if product info changes

---

## Deployment Checklist

Before deploying Phase 5-6 changes:

- [x] Frontend builds without errors: `npm run build`
- [x] All TypeScript checks pass
- [x] vercel.json is valid JSON
- [x] public/robots.txt is valid
- [x] public/sitemap.xml is valid XML
- [x] PHASE5_PRERENDER.md and PHASE6_MEASUREMENT.md created
- [x] Backend logging updated with crawler detection
- [x] Health endpoint updated with optional logging

After deployment:

- [ ] Frontend deployed and serving correctly
- [ ] Static files (robots.txt, sitemap.xml) accessible
- [ ] Verify public pages load correctly
- [ ] Check that backend is logging crawler requests
- [ ] Manually test one public route with curl
- [ ] Set up Google Search Console within 24 hours

---

## Success Metrics (Post-Deployment)

### Week 1-2:
- ✅ Robots.txt crawled by major search engines
- ✅ Sitemap submitted and recognized
- ✅ Crawl errors: 0

### Month 1:
- ✅ Public pages indexed in Google
- ✅ Impressions: > 1 for brand keyword
- ✅ Core Web Vitals: All "Good"

### Month 3:
- ✅ Organic impressions: Established baseline
- ✅ CTR > 2% for branded results
- ✅ Rich results: Eligible

### Ongoing:
- ✅ Zero private route leakage
- ✅ Monthly Search Console review
- ✅ Quarterly metadata updates

---

## Resources Used in Phase 5-6

- [Google Search Central](https://developers.google.com/search)
- [Vercel Cache Control Guide](https://vercel.com/docs/concepts/cdn/caching)
- [RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)
- [Schema.org Organization](https://schema.org/Organization)
- [Schema.org SoftwareApplication](https://schema.org/SoftwareApplication)
- [HTTP Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control)
