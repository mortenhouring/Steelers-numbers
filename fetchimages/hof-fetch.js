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
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: "new"
  });

  const page = await browser.newPage();
  console.log('Navigating to Steelers Hall of Fame page...');
  await page.goto(HOF_URL, { waitUntil: 'networkidle2' });

  const playerUrls = await page.$$eval('table.d3-o-table tbody tr td a', links => links.map(a => a.href));
  console.log(`Found ${playerUrls.length} HOF players.`);

  const players = [];

  for (const url of playerUrls) {
    try {
      console.log(`Scraping player: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      // Player name
      const player_name = await page.$eval('h1.nfl-o-page-title--visuallyhidden', el => el.textContent.split('|')[0].trim());

      // Image
      const imageUrl = await page.$eval('.nfl-c-custom-promo__figure source', el => el.dataset.srcset);
      const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
      const filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
      const imagePath = path.join(IMAGE_DIR, filename);

      try {
        const viewSource = await page.goto(imageUrl);
        const buffer = await viewSource.buffer();
        fs.writeFileSync(imagePath, buffer);
        console.log(`Saved image for ${player_name}`);
      } catch {
        console.log(`⚠️ Image not found for ${player_name}`);
      }

      // Tables
      const tables = await page.$$eval('table.d3-o-table', tables =>
        tables.map(tbl => {
          const caption = tbl.querySelector('caption')?.textContent.trim() || '';
          const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
          );
          return { caption, rows };
        })
      );

      // Personal Info
      const personal = tables.find(t => t.rows[0]?.[0].toLowerCase().includes('position'))?.rows || [];
      let draft_year = '';
      let draft_round = '';
      let draft_team = '';
      if (personal.length) {
        const draftedRow = personal.find(r => r[0].toLowerCase() === 'drafted');
        if (draftedRow) {
          draft_year = draftedRow[1] || '';
          const roundRow = personal[personal.indexOf(draftedRow) + 1];
          if (roundRow && !roundRow[0]) draft_round = roundRow[1] || '';
          const teamRow = personal[personal.indexOf(draftedRow) + 2];
          if (teamRow && !teamRow[0]) draft_team = teamRow[1] || '';
        }
      }
      if (!draft_year) draft_year = personal.find(r => r[0].toLowerCase() === 'height')?.[1] || '';
      if (!draft_round && !draft_team) draft_round = 'undrafted';

      // Career History
      const careerTable = tables.find(t => t.rows[0]?.[0].toLowerCase().includes('career history'))?.rows || [];
      const career_history = careerTable.map(r => `${r[0]}: ${r[1] || ''}`).join(' | ');

      // Career Highlights
      const highlightsTable = tables.find(t => t.rows[0]?.[0].toLowerCase().includes('career highlights'))?.rows || [];
      const achievements = highlightsTable.map(r => `${r[0]}: ${r[1] || ''}`).join(' | ');

      const info = `Draft: ${draft_year} ${draft_round}${draft_team ? ` by ${draft_team}` : ''}\nCareer History: ${career_history}`;

      // Trivia paragraphs (unchanged)
      const trivia = await page.$$eval('div.nfl-c-body-part--text p', ps => ps.map(p => p.textContent.trim()).join('\n\n'));

      players.push({
        player_name,
        number: null,
        position: personal.find(r => r[0].toLowerCase() === 'position')?.[1] || '',
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
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(players, null, 2), 'utf-8');
  console.log(`🎯 Done. Saved ${players.length} players to ${OUTPUT_JSON}`);
}

scrape().catch(err => console.error(err));