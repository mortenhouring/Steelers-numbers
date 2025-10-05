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

      // 2️⃣ Image URL (portrait)
      const imageUrl = await page.$eval('.nfl-c-custom-promo__figure source[data-srcset]', src => src.dataset.srcset);
      const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
      const imagePath = path.join(IMAGE_DIR, filename);

      try {
        const res = await fetch(imageUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(imagePath, buffer);
        console.log(`Image saved: ${filename}`);
      } catch (imgErr) {
        console.error(`Failed to save image for ${player_name}:`, imgErr.message);
      }

      // 3️⃣ Trivia paragraphs
      const trivia = await page.$$eval('div.nfl-c-body-part--text p', ps => ps.map(p => p.textContent.trim()).join('\n\n'));

      // 4️⃣ Extract tables
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
        const caption = tbl.caption.toLowerCase();
        // Personal Information
        if (caption.includes('personal information')) {
          tbl.rows.forEach((row, idx) => {
            const key = row[0].toLowerCase();
            if (key === 'position') position = row[1] || '';
            else if (key === 'drafted') draft_year = row[1] || '';
            else if (key === '' && draft_year && !draft_round) draft_round = row[1] || '';
            else if (key === '' && draft_year && draft_round && !draft_team) draft_team = row[1] || '';
          });
          // fallback if undrafted
          if (!draft_year) draft_year = 'undrafted';
        }
        // Career History
        if (caption.includes('career history')) {
          career_history = tbl.rows.map(r => `${r[0]}: ${r[1] || ''}`).join(' | ');
        }
        // Career Highlights
        if (caption.includes('career highlights')) {
          achievements = tbl.rows.map(r => `${r[0]}: ${r[1] || ''}`).join(' | ');
        }
      });

      const info = `Draft: ${draft_year}${draft_round ? ' ' + draft_round : ''}${draft_team ? ' by ' + draft_team : ''}\nCareer History: ${career_history}`;

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