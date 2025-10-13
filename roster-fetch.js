// roster-fetch.js
import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';

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

async function fetchPlayer(player) {
  try {
    const { data } = await axios.get(player.url);
    const dom = new JSDOM(data);
    const document = dom.window.document;

    // Find the script containing playerData
    const scripts = Array.from(document.querySelectorAll('script'));
    const targetScript = scripts.find(s => s.textContent.includes('window.__PLAYER_DATA__'));

    if (!targetScript) throw new Error(`Player data not found for ${player.name}`);

    // Extract JSON
    const match = targetScript.textContent.match(/window\.__PLAYER_DATA__\s*=\s*(\{.*\});/s);
    if (!match) throw new Error(`Cannot parse player JSON for ${player.name}`);

    const playerData = JSON.parse(match[1]);

    // Map to required format
    return {
      player_name: playerData?.name || player.name,
      number: Number(playerData?.jerseyNumber || 0),
      position: playerData?.position || 'N/A'
    };
  } catch (err) {
    console.error(`Error fetching ${player.name}:`, err.message);
    return null;
  }
}

async function main() {
  const results = [];
  for (const player of players) {
    const data = await fetchPlayer(player);
    if (data) results.push(data);
  }

  // Write to roster.json
  fs.writeFileSync('roster.json', JSON.stringify(results, null, 2));
  console.log('Roster saved to roster.json');
}

main();