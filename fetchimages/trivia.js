// /fetchimages/trivia.js
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const rosterFile = path.join('.', 'images-rosterupdate.json');
const triviaFile = path.join('.', 'trivia.json');

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

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
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
      // Collect subsectioned trivia scoped to Biography, normalize Career Highlights
    const playerTrivia = await page.evaluate(() => {
    const allowedSubsections = [
    'PRO CAREER',
    'PERSONAL',
    'CAREER HIGHLIGHTS',
    'CAREER HIGHLIGHTS (REGULAR SEASON)',
    'CAREER HIGHLIGHTS (POSTSEASON)',
    'AWARDS'
  ];

  const sectioned = {};

  // Find the main Biography container
  const bioSection = document.querySelector('.nfl-c-biography');
  if (!bioSection) return sectioned;

  // Only look for headings inside Biography
  bioSection.querySelectorAll('p strong').forEach(header => {
    let headingText = header.textContent.toUpperCase().trim();

    // Skip anything not allowed
    if (!allowedSubsections.some(sub => headingText.includes(sub))) return;

    // Normalize all Career Highlights variants to "CAREER HIGHLIGHTS"
    if (headingText.includes('CAREER HIGHLIGHTS')) {
      headingText = 'CAREER HIGHLIGHTS';
    }

    const bullets = [];
    let next = header.parentElement.nextElementSibling;
    while (next && next.tagName === 'UL') {
      next.querySelectorAll('li').forEach(li => bullets.push(li.textContent.trim()));
      next = next.nextElementSibling;
    }

    // Merge bullets if key already exists
    if (sectioned[headingText]) {
      sectioned[headingText] = sectioned[headingText].concat(bullets);
    } else {
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