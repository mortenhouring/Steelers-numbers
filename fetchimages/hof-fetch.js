// fetchimages/hof-fetch.js

import fs from 'fs';
import path from 'path';
import https from 'https';
import puppeteer from 'puppeteer';
import sanitize from 'sanitize-filename';

// ------------------------
//  Configuration
// ------------------------
const BASE_URL = 'https://www.steelers.com';
const HOF_URL = `${BASE_URL}/history/hall-of-fame/`;
const OUTPUT_JSON = path.join('./hof.json');
const IMAGE_DIR = path.join('./fetchimages/hofimages');

if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

// ------------------------
//  Helper: Download image
// ------------------------
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', err => {
      fs.unlink(filepath, () => {}); // delete partial file on error
      reject(err);
    });
  });
}

// ------------------------
//  Main Scrape Function
// ------------------------
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

  // ------------------------
  //  Get all player URLs
  // ------------------------
  const playerUrls = await page.$$eval('table.d3-o-table tbody tr td a', links => links.map(a => a.href));
  console.log(`Found ${playerUrls.length} HOF players.`);

  const players = [];

  // ------------------------
  //  Loop over each player
  // ------------------------
  for (const url of playerUrls) {
    try {
      console.log(`Scraping player: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2' });

      // --- 1️⃣ Player Name ---
      const player_name = await page.$eval('h1.nfl-o-page-title--visuallyhidden', el =>
        el.textContent.split('|')[0].trim()
      );

      // --- 2️⃣ Player Image ---
      let imageUrl;
      try {
        imageUrl = await page.$eval(
          '.nfl-c-custom-promo__figure source',
          source => source.dataset.srcset
        );
      } catch {
        console.warn(`⚠️ No player image found for ${player_name}, skipping image.`);
        imageUrl = null;
      }

      let filename = '';
      if (imageUrl) {
        const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
        filename = sanitize(player_name.toLowerCase().replace(/\s+/g, '_')) + ext;
        const imagePath = path.join(IMAGE_DIR, filename);

        try {
          await downloadImage(imageUrl, imagePath);
          console.log(`✅ Saved image for ${player_name}`);
        } catch (err) {
          console.error(`❌ Failed to save image for ${player_name}:`, err.message);
        }
      }

      // --- 3️⃣ Trivia Paragraphs ---
      const trivia = await page.$$eval('div.nfl-c-body-part--text p', ps =>
        ps.map(p => p.textContent.trim()).join('\n\n')
      );

      // --- 4️⃣ Extract All Tables ---
      const tables = await page.$$eval('table.d3-o-table', tables =>
        tables.map(tbl => {
          const caption = tbl.querySelector('caption')?.textContent.trim() || '';
          const rows = Array.from(tbl.querySelectorAll('tbody tr')).map(tr =>
            Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())
          );
          return { caption, rows };
        })
      );

      // --- 5️⃣ Extract Position and Draft Info ---
const { position, info } = await page.evaluate(() => {
  const header = [...document.querySelectorAll("th")]
    .find(th => th.textContent.trim().toUpperCase().includes("PERSONAL INFORMATION"));
  if (!header) return { position: "", info: "" };
  const table = header.closest("table");
  if (!table) return { position: "", info: "" };

  const lines = Array.from(table.querySelectorAll("tbody tr"))
    .map(row => {
      const cells = row.querySelectorAll("td.d3-o-table-item--optional-large");
      if (cells.length === 2 && cells[0].textContent.trim() && cells[1].textContent.trim()) {
        return `${cells[0].textContent.trim()}: ${cells[1].textContent.trim()}`;
      } else if (cells.length === 2 && !cells[0].textContent.trim()) {
        return cells[1].textContent.trim();
      }
      return '';
    })
    .filter(Boolean);

  // Extract position
  const posLine = lines.find(l => l.startsWith("Position:"));
  const position = posLine ? posLine.replace("Position:", "").trim() : "";

  // Extract drafted info
  let draftLine = "";
  const draftIndex = lines.findIndex(l => l.startsWith("Drafted:"));
  if (draftIndex !== -1) {
    const drafted = lines[draftIndex].replace("Drafted:", "").trim();
    const round = lines[draftIndex + 1] && /^\d/.test(lines[draftIndex + 1])
      ? lines[draftIndex + 1].trim()
      : "";
    const team = lines[draftIndex + 2] &&
      !lines[draftIndex + 2].startsWith("College") &&
      !lines[draftIndex + 2].startsWith("Height") &&
      !lines[draftIndex + 2].startsWith("Weight")
      ? lines[draftIndex + 2].trim()
      : "";

    draftLine = `Drafted: ${drafted}${round ? `, ${round}` : ""}${team ? ` by ${team}` : ""}`;
  } else if (lines.some(l => /Undrafted/i.test(l))) {
    draftLine = "Draft: Undrafted";
  }

  return { position, info: draftLine };
});

// --- 6️⃣ Extract Career History (for "career") ---
const career = await page.evaluate(() => {
  const header = [...document.querySelectorAll("th")]
    .find(th => th.textContent.trim().toUpperCase().includes("CAREER HISTORY"));
  if (!header) return "";
  const table = header.closest("table");
  if (!table) return "";

  const rows = table.querySelectorAll("tbody tr");
  return Array.from(rows).map(row => {
    const cells = row.querySelectorAll("td.d3-o-table-item--optional-large");
    return Array.from(cells).map(c => c.textContent.trim()).join(' | ');
  }).filter(Boolean).join('\n');
});
// --- 7️⃣ Extract Career Highlights / Achievements ---
const achievements = await page.$$eval('table.d3-o-table', tables => {
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
      // --- 8️⃣ Push player data ---
      players.push({
        player_name,
        number: null, // HOF page does not provide jersey numbers reliably
        position,
        group: "HOF",
        image: imageUrl ? `fetchimages/hofimages/${filename}` : '',
        info,
        career,
        achievements,
        trivia,
        stats: ""
      });

      console.log(`Scraped ${player_name} ✅`);

    } catch (err) {
      console.error(`Failed to scrape ${url}:`, err);
    }
  }

  // ------------------------
  //  Close Browser and Save JSON
  // ------------------------
  await browser.close();

  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(players, null, 2), 'utf-8');
  console.log(`🎯 Done. Saved ${players.length} players to ${OUTPUT_JSON}`);
}

// ------------------------
//  Run the Scraper
// ------------------------
scrape().catch(err => console.error(err));