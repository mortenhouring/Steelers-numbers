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
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log("✅ Puppeteer launched successfully");
  } catch (error) {
    console.error("❌ Failed to launch Puppeteer:", error.message);
    fs.writeFileSync("hof.json", JSON.stringify({ error: "Puppeteer launch failed", message: error.message }, null, 2));
    process.exit(1);
  }

  const page = await browser.newPage();
  console.log('Navigating to Steelers Hall of Fame page...');
  await page.goto(HOF_URL, { waitUntil: 'networkidle2' });

  // Get all player URLs from the table
  const playerUrls = await page.$$eval('table.d3-o-table a', links =>
    links.map(a => a.href).filter(Boolean)
  );
  console.log(`Found ${playerUrls.length} HOF players.`);

  const players = [];

  for (const url of playerUrls) {
    try {
      console.log(`Scraping player: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      // 1️⃣ Name
      const player_name_full = await page.$eval('h1.nfl-o-page-title', el => el.textContent.trim());
      const player_name = player_name_full.split('|')[0].trim();

      // 2️⃣ Main Image
      const image = await page.$eval('figure.nfl-c-custom-promo__figure img', img => img.dataset.src || img.src);
      const ext = path.extname(new URL(image).pathname) || '.jpg';
      const filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
      const imagePath = path.join(IMAGE_DIR, filename);

      // Download image
      const view = await page.goto(image);
      fs.writeFileSync(imagePath, Buffer.from(await view.arrayBuffer()));

      // 3️⃣ Position from Personal Info table
      let position = null;
      try {
        const rows = await page.$$eval('div.nfl-c-body-part--table tbody tr', trs =>
          trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim()))
        );
        const posRow = rows.find(r => r[0].toLowerCase() === 'position');
        if (posRow) position = posRow[1];
      } catch {}

      // 4️⃣ Trivia paragraphs
      const trivia = await page.$$eval('div.nfl-c-body-part--text p', ps =>
        ps.map(p => p.textContent.trim()).join('\n\n')
      );

      // 5️⃣ Tables: Career History & Achievements
      const tables = await page.$$eval('div.nfl-c-body-part--table', tables =>
        tables.map(tbl => {
          const header = tbl.querySelector('th')?.textContent.trim() || '';
          const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
          );
          return { header, rows };
        })
      );

      // Career History
      let career_history = '';
      tables.forEach(tbl => {
        if (tbl.header.toLowerCase().includes('career history')) {
          career_history = tbl.rows.map(r => `${r[0]}: ${r[1]}`).join(' | ');
        }
      });

      // Achievements
      let achievements = '';
      tables.forEach(tbl => {
        if (tbl.header.toLowerCase().includes('career highlights')) {
          achievements = tbl.rows.map(r => `${r[0]}: ${r[1]}`).join(' | ');
        }
      });

      // Draft info
      let draft_year = '', draft_round = '', draft_overall = '', draft_team = '';
      const draftMatch = trivia.match(/(\d{4}) NFL Draft/);
      if (draftMatch) draft_year = draftMatch[1];
      const roundMatch = trivia.match(/(\d+)(?:st|nd|rd|th) Round/i);
      if (roundMatch) draft_round = roundMatch[0];
      const overallMatch = trivia.match(/(\d+)(?:st|nd|rd|th) overall/i);
      if (overallMatch) draft_overall = overallMatch[0];
      const teamMatch = trivia.match(/by the ([\w\s]+?)(?:\.|,)/i);
      if (teamMatch) draft_team = teamMatch[1].trim();

      const info = `Draft: ${draft_year} ${draft_round} (${draft_overall}) by ${draft_team}\nCareer History: ${career_history}`;

      // 6️⃣ Assemble JSON
      players.push({
        player_name,
        number: null, // Not reliably on page
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
      console.error(`Failed to scrape ${url}:`, err.message);
    }
  }

  await browser.close();

  // Save JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(players, null, 2), 'utf-8');
  console.log(`🎯 Done. Saved ${players.length} players to ${OUTPUT_JSON}`);
}

scrape().catch(err => console.error(err));