# Phase 6: Measurement & Continuous Improvement

## Search Visibility Monitoring

### Google Search Console

**Setup:**
1. Verify domain ownership (use `<meta name="google-site-verification" content="">` tag - already in index.html)
2. Add sitemap: `https://azerothfliplocal.com/sitemap.xml`
3. Monitor:
   - Indexed pages (should only include `/home`, `/public/docs`)
   - Search impressions and click-through rates
   - Crawl errors (should be minimal for public routes)
   - Mobile usability (especially for public pages)
   - Core Web Vitals metrics

**Goals:**
- ✅ Public pages indexed within 2 weeks
- ✅ No private routes (`/app/*`) in index
- ✅ Zero 404 errors for public routes
- ✅ Core Web Vitals all "Good" threshold

### Bing Webmaster Tools

**Setup:**
1. Add site (same domain verification)
2. Submit sitemap
3. Monitor indexing status

### Search Results Appearance

**Rich Results:** Monitor structured data eligibility
- Navigate to [Google Rich Results Test](https://search.google.com/test/rich-results)
- Test: `https://azerothfliplocal.com/home` and `https://azerothfliplocal.com/public/docs`
- Verify Organization and SoftwareApplication schemas are recognized

## Crawler Access Monitoring

### Backend Logging

Add bot detection to [backend/app/core/logging.py](backend/app/core/logging.py):

```python
def is_crawler(user_agent: str) -> bool:
    """Detect known search engine and LLM crawlers."""
    crawler_keywords = [
        "googlebot", "bingbot", "slurp", "duckduckbot",
        "baiduspider", "yandexbot", "applebot",
        "chatgpt", "gpt-4", "claude", "llama",
        "perplexity", "anthropic"
    ]
    return any(keyword in user_agent.lower() for keyword in crawler_keywords)

def log_crawler_request(request: Request, route: str):
    """Log crawler access for monitoring."""
    if is_crawler(request.headers.get("user-agent", "")):
        logger.info(
            f"Crawler access: {request.headers.get('user-agent')} → {route}",
            extra={
                "source_ip": request.client.host,
                "http_method": request.method
            }
        )
```

### Frontend Logging

Add bot traffic detection to [frontend/src/hooks/useDocumentTitle.ts](frontend/src/hooks/useDocumentTitle.ts):

```typescript
function logBotVisit(pathname: string) {
  // Simple heuristic: crawlers often disable JavaScript/stylesheets
  const isLikelyBot = !navigator.cookieEnabled || !window.localStorage;
  
  if (isLikelyBot) {
    console.debug(`[BOT] Visited: ${pathname}`);
  }
}
```

### Validation Checklist

Run these validation tests after deployment:

#### 1. Robots Policy Validation
```bash
curl -I https://azerothfliplocal.com/robots.txt
# Expected: 200 OK, Content-Type: text/plain

curl -I https://azerothfliplocal.com/sitemap.xml
# Expected: 200 OK, Content-Type: application/xml
```

#### 2. Public Route Accessibility
```bash
curl -s https://azerothfliplocal.com/home | grep -q "AzerothFlipLocal"
# Expected: Exit code 0 (content found)

curl -s https://azerothfliplocal.com/public/docs | grep -q "Documentation"
# Expected: Exit code 0 (content found)
```

#### 3. Metadata Verification
```bash
# Check for description meta tag
curl -s https://azerothfliplocal.com/ | grep "meta name=\"description\""
# Expected: Contains product description

# Check for structured data
curl -s https://azerothfliplocal.com/ | grep "Organization" | head -1
# Expected: JSON-LD schema found
```

#### 4. Index Status Check
```bash
# Test with Google's URL Inspection Tool
# https://search.google.com/search-console/

# Paths to test:
# - https://azerothfliplocal.com/home (expect INDEXED)
# - https://azerothfliplocal.com/public/docs (expect INDEXED)
# - https://azerothfliplocal.com/app (expect NOINDEX)
```

#### 5. Protected Route Validation
```bash
# Verify /app routes are not indexed by checking response headers
curl -I https://azerothfliplocal.com/app
# Expected: X-Robots-Tag: noindex or robots meta noindex in body
```

#### 6. Social Preview Test
Tools:
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/sharing/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)

Test URLs:
- `https://azerothfliplocal.com/home`
- `https://azerothfliplocal.com/public/docs`

Expected: Proper OG/Twitter card rendering with:
- Title
- Description
- Image preview (if configured)

## Performance Metrics

### Lighthouse Audit

Run periodic audits for public pages:

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Audit public pages
lighthouse https://azerothfliplocal.com/home --output-path=./lighthouse-home.html
lighthouse https://azerothfliplocal.com/public/docs --output-path=./lighthouse-docs.html
```

**Target metrics:**
- ✅ Performance: > 85
- ✅ SEO: > 90
- ✅ Accessibility: > 90
- ✅ Best Practices: > 85

### Core Web Vitals

Monitor via Google Search Console under "Experience" section:

- **Largest Contentful Paint (LCP):** < 2.5s
- **Cumulative Layout Shift (CLS):** < 0.1
- **First Input Delay (FID):** < 100ms

## AI/LLM Readiness

### LLM Crawler Testing

Manually test with common LLM crawlers:

```bash
# Simulate Claude bot
curl -H "User-Agent: Claude-Web" https://azerothfliplocal.com/public/docs

# Simulate GPTBot
curl -H "User-Agent: GPTBot/1.0" https://azerothfliplocal.com/home

# Expected: 200 OK, full HTML with metadata
```

### Documentation Completeness

Verify LLM crawlers can gather:
- ✅ Product purpose (from homepage meta/content)
- ✅ Feature list (from /public/docs)
- ✅ Data sources (Blizzard APIs only - from docs)
- ✅ Privacy stance (all data private - from docs)
- ✅ Update frequency (hourly scans - from docs)
- ✅ Trust boundaries (from docs)

## Private Route Leakage Tests

### Verify No Indexing of Protected Routes

```bash
# These should all return noindex signals:
curl -s https://azerothfliplocal.com/app | grep -i "noindex"
curl -s https://azerothfliplocal.com/app/scanner | grep -i "noindex"
curl -s https://azerothfliplocal.com/app/realms | grep -i "noindex"
```

### Verify API Endpoint Protection

```bash
# GET public health (should work)
curl -s https://api.azerothfliplocal.com/health | grep -q "status"
# Expected: Exit code 0 (public endpoint)

# GET private endpoint without auth (should fail)
curl -s https://api.azerothfliplocal.com/scans
# Expected: 401 Unauthorized or 403 Forbidden
```

### Rate Limit Verification

```bash
# Test rate limiting on auth endpoint
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}" https://api.azerothfliplocal.com/auth/login
  echo
done
# Expected: 429 (Too Many Requests) after limit threshold
```

## Iteration Cycle

### Monthly Review

1. **Search Console Data:**
   - Review indexed pages count (should be ~2)
   - Check impressions and CTR trends
   - Identify any crawl errors

2. **Performance Data:**
   - Run Lighthouse audit on public pages
   - Compare Core Web Vitals with target thresholds
   - Identify bottlenecks

3. **Metadata Effectiveness:**
   - Check if page titles/descriptions match search queries
   - Evaluate rich result performance
   - Update descriptions based on search click patterns

4. **Activity Logs:**
   - Count crawler visits by type
   - Identify new crawler sources
   - Verify no abuse patterns

### Quarterly Updates

- Update `/public/docs` with new features or changes
- Refresh structured data with latest product info
- Re-run full SEO audit (Lighthouse, Search Console, Rich Results)
- Consider metadata refinements based on search queries

## Success Criteria

By end of Phase 6:

✅ **Indexing:**
- Public pages indexed in Google
- Sitemap recognized
- No private routes indexed

✅ **Visibility:**
- Impressions for brand keywords
- Click-through rate > 2%
- Zero 404s for public routes

✅ **Performance:**
- Core Web Vitals all "Good"
- Lighthouse SEO score > 90
- Page load < 3s on public routes

✅ **Privacy:**
- No user data in search results
- Protected routes consistently noindex
- Rate limits functioning

✅ **LLM Readiness:**
- Crawlers can access documentation
- Structured data recognized
- Metadata provides complete product picture

## Resources

- [Google Search Central](https://developers.google.com/search)
- [Microsoft Bing Webmaster Tools](https://www.bing.com/webmasters)
- [Schema.org Documentation](https://schema.org)
- [RFC 9309: Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html)
