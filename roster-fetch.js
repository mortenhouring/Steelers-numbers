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

// Name
const nameEl = document.querySelector('.d3-o-media-object__title');
const name = nameEl ? nameEl.textContent.trim() : player.name;

// Position
const positionEl = document.querySelector('.d3-o-media-object__primary-subtitle');
const position = positionEl ? positionEl.textContent.trim() : 'N/A';

// Number
const numberEl = document.querySelector('.d3-o-media-object__secondary-subtitle');
const numberText = numberEl ? numberEl.textContent.replace('#', '').trim() : '0';
const number = Number(numberText);
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