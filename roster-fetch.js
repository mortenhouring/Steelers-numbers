// roster-fetch.js
import fs from 'fs';
import { JSDOM } from 'jsdom';

// URLs of players
const players = [
  { name: "Pat Freiermuth", url: "https://www.steelers.com/team/players-roster/pat-freiermuth/" },
  { name: "DK Metcalf", url: "https://www.steelers.com/team/players-roster/dk-metcalf/" }
];

// Function to scrape player info
async function scrapePlayer(url) {
  const res = await fetch(url);
  const html = await res.text();
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Extract JSON snippet from page
  const scriptTag = [...document.querySelectorAll('script')].find(s => s.textContent.includes('window.__INITIAL_STATE__'));
  if (!scriptTag) throw new Error('Player JSON snippet not found');

  const jsonText = scriptTag.textContent.match(/window\.__INITIAL_STATE__\s?=\s?({.*});/)[1];
  const data = JSON.parse(jsonText);

  // Example path to player data in the JSON
  // ⚠ This may need adjusting if site structure changes
  const playerData = data?.player?.rosterPlayer;

  return {
    player_name: playerData?.fullName || "Unknown",
    number: Number(playerData?.jerseyNumber) || 0,
    position: playerData?.position?.abbreviation || "Unknown"
  };
}

async function main() {
  const roster = [];

  for (const player of players) {
    try {
      const data = await scrapePlayer(player.url);
      roster.push(data);
    } catch (err) {
      console.error(`Failed to fetch ${player.name}:`, err.message);
    }
  }

  fs.writeFileSync('roster.json', JSON.stringify(roster, null, 2));
  console.log('Roster saved to roster.json');
}

main();