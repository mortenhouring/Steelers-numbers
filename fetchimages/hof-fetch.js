// fetchimages/hof-fetch.js
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import sanitize from 'sanitize-filename';

const BASE_URL = 'https://www.steelers.com';
const HOF_URL = `${BASE_URL}/history/hall-of-fame/`;
const OUTPUT_JSON = path.join('./hof.json');
const IMAGE_DIR = path.join('./fetchimages/hofimages');

if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

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

  // Get all player URLs from the main table
  const playerUrls = await page.$$eval('table.d3-o-table tbody tr td a', links => links.map(a => a.href));
  console.log(`Found ${playerUrls.length} HOF players.`);

  const players = [];

  for (const url of playerUrls) {
    try {
      console.log(`Scraping player: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      // 1️⃣ Player name
      const player_name = await page.$eval('h1.nfl-o-page-title--visuallyhidden', el => el.textContent.split('|')[0].trim());

      // 2️⃣ Image URL from player portrait
      const imageUrl = await page.$eval('.nfl-c-custom-promo__figure source', src => src.dataset.srcset);
      if (!imageUrl) {
        console.warn(`⚠️ Image not found for ${player_name}`);
      } else {
        const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
        const filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
        const imagePath = path.join(IMAGE_DIR, filename);

        const res = await fetch(imageUrl);
        if (!res.ok) {
          console.warn(`⚠️ Failed to download image for ${player_name}: ${res.status}`);
        } else {
          const buffer = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(imagePath, buffer);
          console.log(`Image saved for ${player_name}`);
        }
      }

      // 3️⃣ Trivia paragraphs
      const trivia = await page.$$eval('div.nfl-c-body-part--text p', ps => ps.map(p => p.textContent.trim()).join('\n\n'));

      // 4️⃣ Tables: Personal Info, Career History, Career Highlights
      const tables = await page.$$eval('table.d3-o-table', tables =>
        tables.map(tbl => {
          const caption = tbl.querySelector('caption')?.textContent.trim() || '';
          const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
          );
          return { caption, rows };
        })
      );

      let position = '';
      let career_history = '';
      let achievements = '';
      let draft_year = '', draft_round = '', draft_overall = '', draft_team = '';

      tables.forEach(tbl => {
        // Personal Info
        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase().includes('position')) {
          position = tbl.rows[0][1] || '';
        }

        // Draft Info + Career History
        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase().includes('drafted')) {
          draft_year = tbl.rows[0][1] || '';
          draft_round = tbl.rows[1] ? tbl.rows[1][1] : '';
          draft_overall = draft_round; // combined in same cell like "1st Round (1st Overall)"
          draft_team = tbl.rows[2] ? tbl.rows[2][1] : '';
        }

        // Career History
        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase().includes('career history')) {
          career_history = tbl.rows.map(r => r[1] ? `${r[0]}: ${r[1]}` : r[0]).join(' | ');
        }

        // Career Highlights / Achievements
        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase().includes('career highlights')) {
          achievements = tbl.rows.map(r => r[1] ? `${r[0]}: ${r[1]}` : r[0]).join(' | ');
        }
      });

      // Build info string with fallback for undrafted players
      const draftInfo = draft_year ? `Draft: ${draft_year} ${draft_overall} by ${draft_team}` : 'Undrafted';
      const info = `${draftInfo}\nCareer History: ${career_history}`;

      players.push({
        player_name,
        number: null,
        position,
        group: "HOF",
        image: imageUrl ? `fetchimages/hofimages/${sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + path.extname(new URL(imageUrl).pathname)}` : '',
        info,
        achievements,
        trivia,
        stats: ""
      });

      console.log(`Scraped ${player_name} ✅`);
    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err);
    }
  }

  await browser.close();

  // Save JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(players, null, 2), 'utf-8');
  console.log(`🎯 Done. Saved ${players.length} players to ${OUTPUT_JSON}`);
}

scrape().catch(err => console.error(err));