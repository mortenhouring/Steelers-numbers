// fetchimages/hof-fetch.js
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import sanitize from 'sanitize-filename';
import fetch from 'node-fetch';

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

      // 2️⃣ Image URL
      const imageUrl = await page.$eval('img.img-responsive', img => img.dataset.src || img.src);
      const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
      const imagePath = path.join(IMAGE_DIR, filename);

      // Download image using fetch
      const res = await fetch(imageUrl);
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(imagePath, buffer);

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
        // Career History
        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase().includes('career history')) {
          career_history = tbl.rows.map(r => `${r[0]}: ${r[1]}`).join(' | ');
        }
        // Career Highlights
        if (tbl.rows[0] && tbl.rows[0][0].toLowerCase().includes('career highlights')) {
          achievements = tbl.rows.map(r => `${r[0]}: ${r[1]}`).join(' | ');
        }
      });

      // Draft info from trivia
      const draftMatch = trivia.match(/(\d{4}) NFL Draft/);
      if (draftMatch) draft_year = draftMatch[1];
      const roundMatch = trivia.match(/(\d+)(?:st|nd|rd|th) Round/i);
      if (roundMatch) draft_round = roundMatch[0];
      const overallMatch = trivia.match(/(\d+)(?:st|nd|rd|th) overall/i);
      if (overallMatch) draft_overall = overallMatch[0];
      const teamMatch = trivia.match(/by the ([\w\s]+?)(?:\.|,)/i);
      if (teamMatch) draft_team = teamMatch[1].trim();

      const info = `Draft: ${draft_year} ${draft_round} (${draft_overall}) by ${draft_team}\nCareer History: ${career_history}`;

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