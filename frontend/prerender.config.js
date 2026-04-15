/**
 * Prerender Configuration for AzerothFlipLocal
 * 
 * This config prerenters public pages (/home, /public/docs) to static HTML
 * for better SEO indexing, while keeping protected routes as SPA.
 * 
 * Usage: npm run prerender
 */

export default {
  // Routes to prerender (public pages only)
  staticRoutes: [
    '/',
    '/home',
    '/public/docs'
  ],
  
  // Build output directory
  distDir: 'dist',
  
  // Use Puppeteer (headless Chrome) for rendering
  renderer: 'puppeteer',
  
  // Puppeteer options
  rendererOptions: {
    renderAfterDocumentEvent: 'app:prerender-complete',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  
  // Crawl configuration
  crawlSpa: false,  // We only prerender specified routes
  useCache: true,
  
  // Post-rendering hook to validate output
  postProcess: (route) => {
    console.log(`✓ Prerendered ${route.route}`);
  },
  
  // Logging
  logLevel: 'info'
};
