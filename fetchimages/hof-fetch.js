// fetchimages/hof-fetch.js
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import sanitize from 'sanitize-filename';

const BASE_URL = 'https://www.steelers.com';
const HOF_URL = `${BASE_URL}/history/hall-of-fame/`;
const OUTPUT_JSON = './hof.json';
const IMAGE_DIR = './fetchimages/hofimages';

if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

async function scrape() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Puppeteer launched successfully');
  } catch (error) {
    console.error('❌ Puppeteer launch failed:', error.message);
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify({ error: error.message }, null, 2));
    process.exit(1);
  }

  const page = await browser.newPage();
  console.log('Navigating to Steelers Hall of Fame page...');
  await page.goto(HOF_URL, { waitUntil: 'networkidle2' });

  // 1️⃣ Get all player URLs (Steelers.com links only)
  const playerUrls = await page.$$eval('a.d3-o-media-object__link', links =>
    links.map(a => a.href).filter(href => href.includes('steelers.com'))
  );

  console.log(`Found ${playerUrls.length} players.`);

  const players = [];

  for (const url of playerUrls) {
    try {
      console.log(`Scraping player: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      // Name
      const player_name = await page.$eval('h1.nfl-c-player-header__title', el => el.textContent.trim());

      // Image
      const image = await page.$eval('img.nfl-c-player-header__img', img => img.src);
      const ext = path.extname(new URL(image).pathname) || '.jpg';
      const filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
      const imagePath = path.join(IMAGE_DIR, filename);

      const view = await page.goto(image);
      fs.writeFileSync(imagePath, Buffer.from(await view.arrayBuffer()));

      // Biography text
      const trivia = await page.$$eval('div.nfl-c-body-part--text p', ps =>
        ps.map(p => p.textContent.trim()).join('\n\n')
      );

      // Tables (Career History / Highlights)
      const tables = await page.$$eval('div.nfl-c-body-part--table', tables =>
        tables.map(tbl => {
          const header = tbl.querySelector('th')?.textContent.trim() || '';
          const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
          );
          return { header, rows };
        })
      );

      let career_history = '';
      let achievements = '';
      let position = null;

      for (const tbl of tables) {
        if (tbl.header.toLowerCase().includes('career history')) {
          career_history = tbl.rows.map(r => `${r[0]}: ${r[1]}`).join(' | ');
          if (tbl.rows[0]) position = tbl.rows[0][1] || null;
        }
        if (tbl.header.toLowerCase().includes('career highlights')) {
          achievements = tbl.rows.map(r => `${r[0]}: ${r[1]}`).join(' | ');
        }
      }

      const info = `Career History: ${career_history}`;

      players.push({
        player_name,
        number: null,
        position,
        group: 'HOF',
        image: `fetchimages/hofimages/${filename}`,
        info,
        achievements,
        trivia,
        stats: ''
      });

      console.log(`✅ Scraped ${player_name}`);
    } catch (err) {
      console.error(`❌ Failed to scrape ${url}:`, err.message);
    }
  }

  await browser.close();

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(players, null, 2));
  console.log(`🎯 Done. Saved ${players.length} players to hof.json`);
}

scrape().catch(err => console.error('Fatal error:', err));