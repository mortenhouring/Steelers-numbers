// fetch-steelers.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const ROSTER_URL = 'https://www.espn.com/nfl/team/roster/_/name/pit/pittsburgh-steelers';
const OUTPUT_FILE = 'rosterupdate.json';

async function fetchRoster() {
  try {
    const response = await axios.get(ROSTER_URL);
    const $ = cheerio.load(response.data);

    const roster = [];

    // Map ESPN section titles → short group codes
    const groupMap = {
      'Offense': 'OFF',
      'Defense': 'DEF',
      'Special Teams': 'ST',
      'Injured Reserve': 'OUT',
      'Out': 'OUT',
      'Practice Squad': 'PS'
    };

    let currentGroup = null;

    // Loop over top-level elements in order
    $('body').children().each((i, el) => {
      if ($(el).is('h2')) {
        const sectionTitle = $(el).text().trim();
        currentGroup = groupMap[sectionTitle] || null;
      } else if ($(el).is('table') && currentGroup) {
        $(el).find('tbody tr').each((j, row) => {
          const columns = $(row).find('td');
          if (columns.length >= 5) {
            const nameCell = $(columns[1]);
            const playerLink = nameCell.find('a').attr('href');

            // Clean name (remove trailing digits)
            const player_name = nameCell.text().replace(/\d+$/, '').trim();

            // Jersey number = trailing digits
            const numberMatch = nameCell.text().match(/(\d+)$/);
            const number = numberMatch ? parseInt(numberMatch[1], 10) : null;

            // Player ID
            const idMatch = playerLink ? playerLink.match(/\/id\/(\d+)\//) : null;
            const playerId = idMatch ? idMatch[1] : null;

            // Position
            const position = $(columns[2]).text().trim();

            // ESPN image
            const playerImage = playerId
              ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${playerId}.png`
              : '';

            if (player_name && playerId) {
              roster.push({
                player_name,
                number,
                position,
                player_id: playerId,
                player_image: playerImage,
                group: currentGroup,  // group just above trivia
                trivia: ""
              });
            }
          }
        });
      }
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(roster, null, 2));
    console.log(`Roster saved to ${OUTPUT_FILE} (${roster.length} players)`);

  } catch (error) {
    console.error('Error fetching roster:', error.message);
  }
}

fetchRoster();