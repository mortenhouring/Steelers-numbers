import fs from 'fs/promises';
import puppeteer from 'puppeteer';

// Usage: node scripts/puppeteer-dump.mjs <profile-url>
(async () => {
  try {
    const url = process.argv[2] || 'https://www.espn.com/nfl/player/_/id/4035687/michael-pittman-jr';
    console.log('Launching headless browser...');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Try to grab several possible window-state objects
    const state = await page.evaluate(() => {
      return {
        __INITIAL_STATE__: typeof window.__INITIAL_STATE__ !== 'undefined' ? window.__INITIAL_STATE__ : null,
        __DATA__: typeof window.__DATA__ !== 'undefined' ? window.__DATA__ : null,
        __CONFIG__: typeof window.__CONFIG__ !== 'undefined' ? window.__CONFIG__ : null,
        __espnBootData__: typeof window.espnBootData !== 'undefined' ? window.espnBootData : null,
        dataLayer: typeof window.__dataLayer !== 'undefined' ? window.__dataLayer : null
      };
    });

    await fs.mkdir('fetch-debug', { recursive: true });
    await fs.writeFile('fetch-debug/puppeteer-initial-state.json', JSON.stringify(state, null, 2));
    console.log('Wrote fetch-debug/puppeteer-initial-state.json');

    // If all captured state objects are null or empty, also save the hydrated DOM for inspection
    const allNull = Object.values(state).every(v => v === null || (typeof v === 'object' && Object.keys(v).length === 0));
    if (allNull) {
      console.log('No window state found — saving hydrated DOM for inspection');
      try {
        const content = await page.content();
        await fs.writeFile('fetch-debug/puppeteer-page.html', content);
        console.log('Wrote fetch-debug/puppeteer-page.html');
      } catch (err) {
        console.warn('Failed to save page content:', err.message);
      }

      // Also attempt to capture any XHR/fetch requests made during page load by inspecting performance entries
      try {
        const requests = await page.evaluate(() => {
          try {
            return (window.performance && window.performance.getEntriesByType) ? window.performance.getEntriesByType('resource').slice(-50) : null;
          } catch (e) {
            return null;
          }
        });
        if (requests) {
          await fs.writeFile('fetch-debug/puppeteer-requests.json', JSON.stringify(requests, null, 2));
          console.log('Wrote fetch-debug/puppeteer-requests.json');
        }
      } catch (err) {
        console.warn('Failed to capture resource performance entries:', err.message);
      }
    }

    await browser.close();
  } catch (err) {
    console.error('Puppeteer dump failed:', err);
    process.exitCode = 1;
  }
})();
