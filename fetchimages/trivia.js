// /fetchimages/trivia.js
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const rosterUrl = "https://raw.githubusercontent.com/mortenhouring/Steelers-numbers/main/fetchimages/images-rosterupdate.json";

let rosterData;
try {
  const response = await fetch(rosterUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch roster JSON. Status: ${response.status}`);
  }
  rosterData = await response.json();
  console.log("✅ Successfully fetched roster JSON");
  console.log("Sample keys from JSON:", Object.keys(rosterData[0] || {}));
} catch (error) {
  console.error("❌ Error fetching or parsing roster JSON:", error);
}

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
  const content = fs.readFileSync(triviaFile, 'utf-8').trim();
  if (content) {
    triviaData = JSON.parse(content);
  } else {
    triviaData = {};
  }
}

// Main function
(async () => {
  const roster = rosterData; // ✅ use fetched JSON

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
    try {
  const readMoreSelector = '.nfl-c-biography__read-more'; // adjust if class differs
  const readMoreButton = await page.$(readMoreSelector);
  if (readMoreButton) {
    console.log('ℹ️ Clicking READ MORE button...');
    await readMoreButton.click();
    await page.waitForTimeout(1000); // small pause to allow content to expand
  }
} catch (err) {
  console.log('⚠️ No READ MORE button found, continuing...');
}
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
  const bioSection = document.querySelector('.nfl-c-biography');
  if (!bioSection) return sectioned;

  const children = Array.from(bioSection.children);

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const text = el.textContent.trim();
    if (!text) continue;

    let headingText = allowedSubsections.find(sub => text.toUpperCase().includes(sub));
    if (!headingText) continue;

    if (headingText.includes('CAREER HIGHLIGHTS')) headingText = 'CAREER HIGHLIGHTS';

    const bullets = [];
    let next = el.nextElementSibling;

    while (next) {
      const nextText = next.textContent.trim();
      if (allowedSubsections.some(sub => nextText.toUpperCase().includes(sub))) break;

      if (next.tagName === 'UL') {
        next.querySelectorAll('li').forEach(li => bullets.push(li.textContent.trim()));
      } else if (next.tagName === 'P' && nextText) {
        bullets.push(nextText);
      }

      next = next.nextElementSibling;
    }

    // Merge bullets if section exists
    if (sectioned[headingText]) sectioned[headingText] = sectioned[headingText].concat(bullets);
    else sectioned[headingText] = bullets;
  }

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