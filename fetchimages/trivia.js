// /fetchimages/trivia.js
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const rosterFile = path.join('./fetchimages', 'images-rosterupdate.json');
const triviaFile = path.join('./fetchimages', 'trivia.json');

// Converts player names to Steelers.com URL slug
function nameToSlug(name) {
  let cleanName = name.replace(/\.(?=\S)/g, '-'); // replace internal periods with -
  cleanName = cleanName.replace(/\.$/, '');       // remove trailing period
  cleanName = cleanName.replace(/['’]/g, '-');    // replace apostrophes with -
  cleanName = cleanName.replace(/\s+/g, '-');     // spaces → hyphens
  cleanName = cleanName.toLowerCase();
  cleanName = cleanName.replace(/[^a-z0-9-]/g, ''); // remove other invalid chars
  cleanName = cleanName.replace(/-+/g, '-');     // collapse multiple hyphens
  return cleanName;
}

// Load existing trivia.json or start empty
let triviaData = {};
if (fs.existsSync(triviaFile)) {
  triviaData = JSON.parse(fs.readFileSync(triviaFile, 'utf-8'));
}

// Main function
(async () => {
  const roster = JSON.parse(fs.readFileSync(rosterFile, 'utf-8'));

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  for (const player of roster) {
    if (triviaData[player.player_id]) {
      console.log(`Skipping ${player.player_name} (already has trivia)`);
      continue;
    }

    const slug = nameToSlug(player.player_name);
    const url = `https://www.steelers.com/team/players-roster/${slug}`;

    try {
      console.log(`Fetching trivia for ${player.player_name}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // Collect subsectioned trivia
      const playerTrivia = await page.evaluate(() => {
        const allowedSubsections = [
          'PRO CAREER',
          '2024',
          'PERSONAL',
          'CAREER HIGHLIGHTS (REGULAR SEASON)',
          'CAREER HIGHLIGHTS (POSTSEASON)'
        ];

        const sectioned = {};

        document.querySelectorAll('h3, h4').forEach(header => {
          const headingText = header.textContent.toUpperCase().trim();
          if (allowedSubsections.some(sub => headingText.includes(sub))) {
            const bullets = [];
            let next = header.nextElementSibling;
            while (next && next.tagName === 'UL') {
              next.querySelectorAll('li').forEach(li => bullets.push(li.textContent.trim()));
              next = next.nextElementSibling;
            }
            sectioned[headingText] = bullets;
          }
        });

        return sectioned;
      });

      triviaData[player.player_id] = {
        player_name: player.player_name,
        player_url: url,
        player_id: player.player_id,
        trivia: playerTrivia
      };

    } catch (err) {
      console.error(`Failed to fetch trivia for ${player.player_name}:`, err.message);
    }
  }

  await browser.close();

  fs.writeFileSync(triviaFile, JSON.stringify(triviaData, null, 2));
  console.log(`Trivia saved to ${triviaFile}`);
})();
