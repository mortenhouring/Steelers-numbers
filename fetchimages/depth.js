import { writeFile } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { load } from 'cheerio';

const DEPTH_URL = 'https://www.steelers.com/team/depth-chart/';
const OUTPUT_FILE = path.resolve('./fetchimages/depth.json');

// Map of position IDs to text strings and max number of players (0 = all)
const positions = {
  // Offense
  LT: ['Left Tackle', 1],
  LG: ['Left Guard', 1],
  C: ['Center', 1],
  RG: ['Right Guard', 1],
  RT: ['Right Tackle', 1],
  TE: ['Tight End', 3],
  RB: ['Running Back', 3],
  FB: [null, 0], // skip
  QB: ['Quarterback', 1],
  WR: ['Wide Receiver', 0], // all WRs
  // Defense
  DT: ['Defensive Tackle', 1],
  NT: ['Nose Tackle', 1],
  DE: ['Defensive End', 2],
  LOLB: ['Left Outside Linebacker', 2],
  LILB: ['Left Inside Linebacker', 1],
  RILB: ['Right Inside Linebacker', 1],
  ROLB: ['Right Outside Linebacker', 2],
  LCB: ['Cornerback', 0],
  FS: ['Free Safety', 1],
  SS: ['Strong Safety', 2],
  RCB: ['Cornerback', 2],
  NB: ['Cornerback', 1],
  // Special Teams
  K: ['Kicker', 1],
  P: ['Punter', 1],
  LS: [null, 0], // skip
  KR: ['Kick Returner', 2],
  PR: ['Punt Returner', 2],
};

(async () => {
  try {
    console.log('Fetching depth chart...');
    const { data: html } = await axios.get(DEPTH_URL);
    const $ = load(html);

    const depthData = [];
    const seenPlayers = {}; // track players with multiple positions

    // Tables: offense, defense, special teams
    $('table.d3-o-depthchart').each((i, table) => {
      $(table)
        .find('tbody tr')
        .each((_, row) => {
          const posId = $(row).find('td').first().text().trim();
          const posEntry = positions[posId];
          if (!posEntry || !posEntry[0]) return; // skip positions marked null

          const posName = posEntry[0];
          const maxPlayers = posEntry[1];

          // Process all columns
          $(row)
            .find('td.d3-o-depthchart__tiers-5')
            .each((colIndex, col) => {
              if (colIndex >= maxPlayers && maxPlayers !== 0) return;

              const anchors = $(col).find('a');
              anchors.each((_, a) => {
                const playerName = $(a).text().trim();
                if (!playerName) return;

                // Build depth string
                let depthPos;
                if (colIndex === 0) {
                  depthPos = posName;
                } else {
                  depthPos = `${colIndex + 1} ${['2nd', '3rd', '4th', '5th'][colIndex - 1]} ${posName}`;
                  depthPos = depthPos.replace(/^\d+\s/, ''); // remove leading number
                }

                if (seenPlayers[playerName]) {
                  // Already exists, append
                  seenPlayers[playerName].depth_pos += ` | ${posName}`;
                } else {
                  const entry = {
                    depth_name: playerName,
                    depth_pos: depthPos,
                  };
                  seenPlayers[playerName] = entry;
                  depthData.push(entry);
                }
              });
            });
        });
    });

    console.log(`Found ${depthData.length} players. Writing to depth.json...`);
    await writeFile(OUTPUT_FILE, JSON.stringify(depthData, null, 2));
    console.log('Done!');

  } catch (err) {
    console.error('Error fetching depth chart:', err);
    process.exit(1);
  }
})();