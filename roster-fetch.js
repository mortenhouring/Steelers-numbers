// roster-fetch.js
import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';

const players = [
  { name: 'Pat Freiermuth', url: 'https://www.steelers.com/team/players-roster/pat-freiermuth/' },
  { name: 'DK Metcalf', url: 'https://www.steelers.com/team/players-roster/dk-metcalf/' }
];

async function fetchPlayer(player) {
  try {
    const { data } = await axios.get(player.url);
    const dom = new JSDOM(data);
    const document = dom.window.document;

    // Extract name
    const nameEl = document.querySelector('.nfl-c-player-header__title h1');
    const name = nameEl ? nameEl.textContent.trim() : player.name;

    // Extract jersey number
    const numberEl = document.querySelector('.nfl-c-player-header__number');
    const numberText = numberEl ? numberEl.textContent.replace('#', '').trim() : '0';
    const number = Number(numberText);

    // Extract position
    const positionEl = document.querySelector('.nfl-c-player-header__position');
    const position = positionEl ? positionEl.textContent.trim() : 'N/A';

    return { player_name: name, number, position };
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

  fs.writeFileSync('roster.json', JSON.stringify(results, null, 2));
  console.log('Roster saved to roster.json');
}

main();