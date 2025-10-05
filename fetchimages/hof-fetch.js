// fetchimages/hof-fetch.js
// -----------------------------------------------
// Steelers Hall of Fame Scraper
// Scrapes player info, achievements, trivia, and portrait images
// -----------------------------------------------

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import sanitize from 'sanitize-filename';
import https from 'https';

// ---------- Configuration ----------
const BASE_URL = 'https://www.steelers.com';
const HOF_URL = `${BASE_URL}/history/hall-of-fame/`;
const OUTPUT_JSON = path.join('./hof.json');
const IMAGE_DIR = path.join('./fetchimages/hofimages');

if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

// ---------- Helper function to download image ----------
async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filepath);
        return reject(new Error(`Image not found: ${url}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(filepath);
      reject(err);
    });
  });
}

// ---------- Main scrape function ----------
async function scrape() {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: "new"
    });
    console.log("✅ Puppeteer launched successfully");
  } catch (error) {
    console.error("❌ Failed to launch Puppeteer:", error.message);
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify({ error: "Puppeteer launch failed", message: error.message }, null, 2));
    process.exit(1);
  }

  const page = await browser.newPage();
  console.log('Navigating to Steelers Hall of Fame page...');
  await page.goto(HOF_URL, { waitUntil: 'networkidle2' });

  // ---------- Extract all player URLs ----------
  const playerUrls = await page.$$eval('table.d3-o-table tbody tr td a', links => links.map(a => a.href));
  console.log(`Found ${playerUrls.length} HOF players.`);

  const players = [];

  for (const url of playerUrls) {
    try {
      console.log(`Scraping player: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      // ---------- 1️⃣ Player Name ----------
      const player_name = await page.$eval('h1.nfl-o-page-title--visuallyhidden', el => el.textContent.split('|')[0].trim());

      // ---------- 2️⃣ Player Image ----------
      const imageUrl = await page.$eval('source[data-srcset]', src => src.dataset.srcset);
      const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
      const imagePath = path.join(IMAGE_DIR, filename);

      try {
        await downloadImage(imageUrl, imagePath);
        console.log(`✅ Saved image for ${player_name}`);
      } catch (err) {
        console.warn(`⚠️ Image not found or failed for ${player_name}: ${err.message}`);
      }

      // ---------- 3️⃣ Extract tables ----------
      const tables = await page.$$eval('table.d3-o-table', tables =>
        tables.map(tbl => {
          const caption = tbl.querySelector('caption')?.textContent.trim() || '';
          const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
          );
          return { caption, rows };
        })
      );

      // ---------- 4️⃣ Parse info, achievements ----------
      let position = '';
      let career_history = '';
      let achievements = '';
      let draft_year = '', draft_round = '', draft_team = '';

      for (const tbl of tables) {
        // Personal Information
        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase() === 'position') {
          position = tbl.rows[0][1] || '';
        }

        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase() === 'drafted') {
          draft_year = tbl.rows[0][1] || '';
          draft_round = tbl.rows[1]?.[1] || '';
          draft_team = tbl.rows[2]?.[1] || '';
        }

        // Career History
        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase().includes('career history')) {
          career_history = tbl.rows.map(r => r[1] ? `${r[0]}: ${r[1]}` : `${r[0]}`).join(' | ');
        }

// --- Extract Career Highlights / Achievements ---
achievements = await page.$$eval('table.d3-o-table', tables => {
  const highlightsTable = tables.find(tbl => {
    const th = tbl.querySelector('thead th');
    return th && th.textContent.trim().toUpperCase() === 'CAREER HIGHLIGHTS';
  });
  if (!highlightsTable) return '';

  const rows = Array.from(highlightsTable.querySelectorAll('tbody tr')).map(tr => {
    const tds = tr.querySelectorAll('td');
    const label = tds[0]?.textContent.trim() || '';
    const value = tds[1]?.textContent.trim() || '';
    return label && value ? `${label}: ${value}` : null;
  }).filter(Boolean);

  return rows.join(' | ');
});
        }
      }

      // Fallback for undrafted players
      if (!draft_year) draft_year = 'undrafted';

      const info = `Draft: ${draft_year}${draft_round ? ' ' + draft_round : ''}${draft_team ? ' by ' + draft_team : ''}\nCareer History: ${career_history}`;

      // ---------- 5️⃣ Trivia (paragraphs) ----------
      let trivia = '';
      try {
        trivia = await page.$$eval('div.nfl-c-body-part--text p', ps =>
          ps.map(p => p.textContent.trim()).join('\n\n')
        );
      } catch (e) {
        trivia = '';
      }

      // ---------- 6️⃣ Add player object ----------
      players.push({
        player_name,
        number: null, // HOF page does not provide jersey numbers reliably
        position,
        group: "HOF",
        image: `fetchimages/hofimages/${filename}`,
        info,
        achievements,
        trivia,
        stats: ""
      });

      console.log(`✅ Scraped ${player_name}`);
    } catch (err) {
      console.error(`❌ Failed to scrape ${url}:`, err);
    }
  }

  await browser.close();

  // ---------- 7️⃣ Save JSON ----------
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(players, null, 2), 'utf-8');
  console.log(`🎯 Done. Saved ${players.length} players to ${OUTPUT_JSON}`);
}

// ---------- Run the scraper ----------
scrape().catch(err => console.error(err));