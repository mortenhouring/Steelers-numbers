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

        // Map table index → group
        // 0: Offense, 1: Defense, 2: Special Teams, 3: Injured/Out, 4: Practice Squad
        const tableGroups = ['OFF', 'DEF', 'ST', 'OUT', 'PS'];

        // Loop through each roster table by order
        $('table tbody').each((i, tbody) => {
            const group = tableGroups[i] || null;

            $(tbody).find('tr').each((j, row) => {
                const columns = $(row).find('td');

                if (columns.length >= 5) {
                    const nameCell = $(columns[1]);
                    const playerLink = nameCell.find('a').attr('href');

                    // Clean player name (remove trailing digits)
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
                            group,   // assigned by table order
                            trivia: ""
                        });
                    }
                }
            });
        });

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(roster, null, 2));
        console.log(`Roster saved to ${OUTPUT_FILE} (${roster.length} players)`);

    } catch (error) {
        console.error('Error fetching roster:', error.message);
    }
}

fetchRoster();