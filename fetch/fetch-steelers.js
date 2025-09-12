// fetch-steelers.js
import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs';

const ROSTER_URL = 'https://www.espn.com/nfl/team/roster/_/name/pit/pittsburgh-steelers';
const OUTPUT_FILE = 'rosterupdate.json';

async function fetchRoster() {
    try {
        const response = await axios.get(ROSTER_URL);
        const $ = cheerio.load(response.data);

        const roster = [];

        // ESPN roster table rows
        $('table tbody tr').each((i, row) => {
            const columns = $(row).find('td');

            if (columns.length >= 5) {
                const nameCell = $(columns[1]);
                const playerLink = nameCell.find('a').attr('href');
                const playerName = nameCell.text().trim();

                // Extract player_id from link like "/nfl/player/_/id/8439/aaron-rodgers"
                const idMatch = playerLink ? playerLink.match(/\/id\/(\d+)\//) : null;
                const playerId = idMatch ? idMatch[1] : null;

                const position = $(columns[2]).text().trim();
                const number = parseInt($(columns[0]).text().trim(), 10) || null;

                // Build ESPN image URL
                const playerImage = playerId
                    ? `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${playerId}.png`
                    : '';

                if (playerName && playerId) {
                    roster.push({
                        player_name: playerName,
                        number: number,
                        position: position,
                        player_id: playerId,
                        player_image: playerImage,
                        trivia: ""
                    });
                }
            }
        });

        // Write to JSON
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(roster, null, 2));
        console.log(`Roster saved to ${OUTPUT_FILE} (${roster.length} players)`);

    } catch (error) {
        console.error('Error fetching roster:', error.message);
    }
}

fetchRoster();
