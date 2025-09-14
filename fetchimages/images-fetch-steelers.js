// images-fetch-steelers.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const ROSTER_URL = 'https://www.espn.com/nfl/team/roster/_/name/pit/pittsburgh-steelers';
const OUTPUT_FILE = 'images-rosterupdate.json';
const IMAGES_DIR = path.join('images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Helper: download image
async function downloadImage(url, filepath) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(filepath, response.data);
  } catch (err) {
    console.error(`Failed to download ${url}: ${err.message}`);
  }
}

async function fetchRoster() {
  try {
    const response = await axios.get(ROSTER_URL);
    const $ = cheerio.load(response.data);

    const roster = [];
    const tableGroups = ['OFF', 'DEF', 'ST', 'OUT', 'PS'];

    $('table tbody').each((i, tbody) => {
      const group = tableGroups[i] || null;

      $(tbody).find('tr').each(async (j, row) => {
        const columns = $(row).find('td');

        if (columns.length >= 5) {
          const nameCell = $(columns[1]);
          const playerLink = nameCell.find('a').attr('href');

          const player_name = nameCell.text().replace(/\d+$/, '').trim();
          const numberMatch = nameCell.text().match(/(\d+)$/);
          const number = numberMatch ? parseInt(numberMatch[1], 10) : null;
          const idMatch = playerLink ? playerLink.match(/\/id\/(\d+)\//) : null;
          const playerId = idMatch ? idMatch[1] : null;
          const position = $(columns[2]).text().trim();

          if (player_name && playerId) {
            const imageUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${playerId}.png`;
            const localImagePath = path.join(IMAGES_DIR, `${playerId}.png`);

            await downloadImage(imageUrl, localImagePath);

            roster.push({
              player_name,
              number,
              position,
              player_id: playerId,
              player_image: `Steelers-numbers/fetchimages/images/${playerId}.png`,
              group,
              trivia: ""
            });
          }
        }
      });
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(roster, null, 2));
    console.log(`Roster saved to ${OUTPUT_FILE} (${roster.length} players)`);

  } catch (error) {
    console.error('Error fetching roster:', error.message);
  }
}

fetchRoster();