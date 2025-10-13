// roster-fetch.js
import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import path from 'path';

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

// Info (Experience, Height, Weight, Age)
    const detailsEl = document.querySelector('.nfl-t-person-tile__stat-details');
    let info = '-';

    if (detailsEl) {
      const pTags = detailsEl.querySelectorAll('p');
      let exp = '-', ht = '-', wt = '-', age = '-';

      pTags.forEach(p => {
        const label = p.querySelector('strong')?.textContent?.trim().toLowerCase() || '';
        const value = p.textContent.replace(/^\s*[^:]+:\s*/, '').trim();

        if (label.includes('experience')) {
          exp = value.replace('years', '').trim();
          if (exp === '0' || exp === 'rookie') exp = 'rookie';
        } else if (label.includes('height')) {
          ht = value;
        } else if (label.includes('weight')) {
          wt = value;
        } else if (label.includes('age')) {
          age = value;
        }
      });

      info = `EXP: ${exp} | HT/WT: ${ht}/${wt} | AGE: ${age}`;
    }


///////////
// Image //
///////////
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

      // Ensure directory exists
      const dir = path.resolve('fetchimages/images');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, fileName);

      console.log('Fetching image URL:', imgUrl); // debug
      const response = await axios.get(imgUrl, {
        responseType: 'arraybuffer',
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' // mimics browser
        }
      });

      const contentType = response.headers['content-type'];
      if (!contentType.startsWith('image')) {
        console.error(`Unexpected content type for ${player.name}: ${contentType}`);
      } else {
        fs.writeFileSync(filePath, response.data);
        imagePath = `fetchimages/images/${fileName}`; // store relative path for JSON
        console.log(`Saved image for ${player.name} to ${imagePath}`);
      }
    }
  } catch (err) {
    console.error(`Error fetching image for ${player.name}:`, err.message);
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