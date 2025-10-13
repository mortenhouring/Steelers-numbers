import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';

// Players to scrape
const players = [
  {
    name: 'Pat Freiermuth',
    url: 'https://www.steelers.com/team/players-roster/pat-freiermuth/'
  },
  {
    name: 'DK Metcalf',
    url: 'https://www.steelers.com/team/players-roster/dk-metcalf/'
  }
];

async function fetchPlayerData(url) {
  try {
    const { data: html } = await axios.get(url);
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // These selectors work on current Steelers.com player pages
    const name = doc.querySelector('h1.player-name')?.textContent.trim() || null;
    const numberText = doc.querySelector('.player-jersey-number')?.textContent.trim() || null;
    const position = doc.querySelector('.player-position')?.textContent.trim() || null;

    const number = numberText ? parseInt(numberText.replace('#', ''), 10) : null;

    return { player_name: name, number, position };
  } catch (err) {
    console.error(`Error fetching ${url}:`, err.message);
    return null;
  }
}

async function main() {
  const results = [];

  for (const player of players) {
    const data = await fetchPlayerData(player.url);
    if (data) results.push(data);
  }

  fs.writeFileSync('roster.json', JSON.stringify(results, null, 2));
  console.log('✅ roster.json created successfully');
}

main();