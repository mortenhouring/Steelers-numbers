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

// Image
let imagePath = null;
const ldJsonEl = document.querySelector('script[type="application/ld+json"]');
if (ldJsonEl) {
  try {
    const ldJson = JSON.parse(ldJsonEl.textContent);
    const imgUrl = ldJson.member?.member?.image?.contentUrl;
    if (imgUrl) {
      const nameParts = name.split(' ');
      const firstName = nameParts[0].toLowerCase();
      const lastName = nameParts.slice(1).join('_').toLowerCase();
      const fileName = `${firstName}_${lastName}.jpeg`;
      imagePath = `fetchimages/images/${fileName}`;

      const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(imagePath, response.data);
    }
  } catch (err) {
    console.error(`Error parsing LD+JSON for ${player.name}:`, err.message);
  }
}
// Return IDs
return { player_name: name, number, position, image: imagePath };
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