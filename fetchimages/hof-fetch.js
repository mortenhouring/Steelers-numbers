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
      headless: true
    });
    console.log("✅ Puppeteer launched successfully");
  } catch (error) {
    console.error("❌ Failed to launch Puppeteer:", error.message);
    fs.writeFileSync("hof.json", JSON.stringify({
      error: "Puppeteer launch failed",
      message: error.message
    }, null, 2));
    process.exit(1);
  }

  const page = await browser.newPage();

  console.log('Navigating to Steelers Hall of Fame page...');
  await page.goto(HOF_URL, { waitUntil: 'networkidle2' });

  // 1️⃣ Get all player URLs from table
  const playerUrls = await page.$$eval(
    'table.d3-o-table tbody tr td:first-child a',
    links => links.map(a => a.href)
  );

  console.log(`Found ${playerUrls.length} HOF players.`);

  const players = [];

  for (const url of playerUrls) {
    try {
      console.log(`Scraping player: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      // 2️⃣ Name
      const player_name = await page.$eval('h1.visuallyhidden', el => el.textContent.trim());

      // 3️⃣ Main Image
      let image = null;
      try {
        image = await page.$eval('figure.nfl-c-custom-promo__figure img', img => img.dataset.src || img.src);
      } catch { image = null; }
      let filename = null;
      if (image) {
        const ext = path.extname(new URL(image).pathname) || '.jpg';
        filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
        const imagePath = path.join(IMAGE_DIR, filename);
        const view = await page.goto(image);
        fs.writeFileSync(imagePath, Buffer.from(await view.arrayBuffer()));
      }

      // 4️⃣ Trivia paragraphs
      const trivia = await page.$$eval('div.nfl-c-body-part--text p', ps =>
        ps.map(p => p.textContent.trim()).join('\n\n')
      );

      // 5️⃣ Tables for Career History & Achievements
      const tables = await page.$$eval('div.nfl-c-body-part--table', tables =>
        tables.map(tbl => {
          const caption = tbl.querySelector('caption')?.textContent.trim() || '';
          const header = tbl.querySelector('th')?.textContent.trim() || '';
          const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr => {
            const tds = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
            return tds;
          });
          return { caption, header, rows };
        })
      );

      // 6️⃣ Extract Career History
      let career_history = '';
      let position = null;
      tables.forEach(tbl => {
        if (tbl.header.toLowerCase().includes('career history')) {
          career_history = tbl.rows.map(r => `${r[0]}: ${r[1]}`).join(' | ');
          if (tbl.rows[0]) position = tbl.rows[0][1] || null;
        }
      });

      // 7️⃣ Extract Achievements
      let achievements = '';
      tables.forEach(tbl => {
        if (tbl.header.toLowerCase().includes('career highlights')) {
          achievements = tbl.rows.map(r => `${r[0]}: ${r[1]}`).join(' | ');
        }
      });

      // 8️⃣ Assemble info (Draft + Career History)
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

      // 9️⃣ Push JSON
      players.push({
        player_name,
        number: null, // HOF page does not reliably include jersey numbers
        position,
        group: "HOF",
        image: filename ? `fetchimages/hofimages/${filename}` : null,
        info,
        achievements,
        trivia,
        stats: ""
      });

      console.log(`Scraped ${player_name} ✅`);
    } catch(err) {
      console.error(`Failed to scrape ${url}:`, err);
    }
  }

  await browser.close();

  // Save JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(players, null, 2), 'utf-8');
  console.log(`Scraper finished. Saved ${players.length} players to ${OUTPUT_JSON}`);
}

scrape().catch(err => console.error(err));