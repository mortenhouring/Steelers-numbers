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

    // Capture network requests and responses
    const networkRequests = [];

    page.on('request', request => {
      try {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          timestamp: Date.now(),
          _requestId: request._requestId || null
        });
      } catch (e) {
        // ignore
      }
    });

    page.on('requestfinished', async request => {
      try {
        const response = await request.response();
        const entryIndex = networkRequests.findIndex(e => e.url === request.url() && e.method === request.method());
        const entry = entryIndex >= 0 ? networkRequests[entryIndex] : { url: request.url(), method: request.method(), resourceType: request.resourceType(), timestamp: Date.now() };
        if (response) {
          const headers = response.headers ? response.headers() : {};
          const contentType = headers['content-type'] || headers['Content-Type'] || '';
          entry.status = response.status();
          entry.contentType = contentType;
          // Only attempt to capture JSON/text responses to avoid huge binaries
          try {
            if (contentType && /json|text|application\/javascript/.test(contentType)) {
              let body = await response.text();
              // Truncate extremely large bodies
              const MAX = 200000;
              if (body && body.length > MAX) body = body.slice(0, MAX) + '\n\n[TRUNCATED]';
              entry.responseBody = body;
            }
          } catch (e) {
            entry.responseBodyError = String(e.message || e);
          }
        }

        if (entryIndex >= 0) networkRequests[entryIndex] = entry;
        else networkRequests.push(entry);
      } catch (e) {
        // ignore per-request errors
      }
    });

    page.on('requestfailed', request => {
      try {
        const entryIndex = networkRequests.findIndex(e => e.url === request.url() && e.method === request.method());
        const entry = entryIndex >= 0 ? networkRequests[entryIndex] : { url: request.url(), method: request.method(), resourceType: request.resourceType(), timestamp: Date.now() };
        entry.failed = true;
        entry.failureText = request.failure() && request.failure().errorText ? request.failure().errorText : null;
        if (entryIndex >= 0) networkRequests[entryIndex] = entry;
        else networkRequests.push(entry);
      } catch (e) {}
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait a bit to allow any subsequent XHRs to finish
    await page.waitForTimeout(3000);

    // Capture window state
    const state = await page.evaluate(() => {
      try {
        return {
          __INITIAL_STATE__: typeof window.__INITIAL_STATE__ !== 'undefined' ? window.__INITIAL_STATE__ : null,
          __DATA__: typeof window.__DATA__ !== 'undefined' ? window.__DATA__ : null,
          __CONFIG__: typeof window.__CONFIG__ !== 'undefined' ? window.__CONFIG__ : null,
          __espnBootData__: typeof window.espnBootData !== 'undefined' ? window.espnBootData : null,
          dataLayer: typeof window.__dataLayer !== 'undefined' ? window.__dataLayer : null
        };
      } catch (e) {
        return { __error: String(e) };
      }
    });

    await fs.mkdir('fetch-debug', { recursive: true });
    await fs.writeFile('fetch-debug/puppeteer-initial-state.json', JSON.stringify(state, null, 2));
    console.log('Wrote fetch-debug/puppeteer-initial-state.json');

    // Save network requests record (trim to most recent 500 entries)
    try {
      const saveRequests = networkRequests.slice(-500);
      await fs.writeFile('fetch-debug/puppeteer-network-requests.json', JSON.stringify(saveRequests, null, 2));
      console.log('Wrote fetch-debug/puppeteer-network-requests.json');
    } catch (e) {
      console.warn('Failed to save network requests:', e.message || e);
    }

    // If window state empty, save hydrated DOM and performance entries
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

      try {
        const perfEntries = await page.evaluate(() => {
          try {
            return (window.performance && window.performance.getEntriesByType) ? window.performance.getEntriesByType('resource').slice(-200) : null;
          } catch (e) {
            return null;
          }
        });
        if (perfEntries) {
          await fs.writeFile('fetch-debug/puppeteer-requests.json', JSON.stringify(perfEntries, null, 2));
          console.log('Wrote fetch-debug/puppeteer-requests.json');
        }
      } catch (err) {
        console.warn('Failed to capture resource performance entries:', err.message);
      }
    }

    await browser.close();
  } catch (err) {
    console.error('Puppeteer dump failed:', err);
    try {
      await fs.mkdir('fetch-debug', { recursive: true });
      await fs.writeFile('fetch-debug/puppeteer-dump-error.txt', String(err.stack || err));
    } catch (e) {}
    process.exitCode = 1;
  }
})();
