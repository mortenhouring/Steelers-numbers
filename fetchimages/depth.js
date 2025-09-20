// depth.js
import { writeFile } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { load } from 'cheerio';

const DEPTH_URL = 'https://www.steelers.com/team/depth-chart/';
const OUTPUT_FILE = path.resolve('depth.json'); // workflow should cd into fetchimages

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
  WR: ['Wide Receiver', 0], // show all WRs, but NO ordinal numbering

  // Defense
  DT: ['Defensive Tackle', 1],
  NT: ['Nose Tackle', 1],
  DE: ['Defensive End', 2],
  LOLB: ['Left Outside Linebacker', 2],
  LILB: ['Left Inside Linebacker', 1],
  RILB: ['Right Inside Linebacker', 1],
  ROLB: ['Right Outside Linebacker', 2],
  LCB: ['Cornerback', 0], // show all, but NO ordinal numbering
  FS: ['Free Safety', 1],
  SS: ['Strong Safety', 2],
  RCB: ['Cornerback', 2], // cornerback variants map to Cornerback (no numbering)
  NB: ['Cornerback', 1],

  // Special Teams
  K: ['Kicker', 1],
  P: ['Punter', 1],
  LS: [null, 0], // skip
  KR: ['Kick Returner', 2],
  PR: ['Punt Returner', 2],
};

// Positions for which we must never show ordinals (by position ID)
const NO_NUMBER_POS_IDS = new Set(['WR', 'LCB', 'RCB', 'NB']);

(async () => {
  try {
    console.log('Fetching depth chart...');
    const { data: html } = await axios.get(DEPTH_URL);
    const $ = load(html);

    const depthData = [];
    const seenPlayers = {}; // name -> entry object (so we can append positions)

    // Go through each depth chart table (Offense, Defense, Special Teams)
    $('table.d3-o-depthchart').each((_, table) => {
      // Collect TE rows separately so we can combine/number across multiple TE rows
      const teRows = [];

      $(table)
        .find('tbody tr')
        .each((_, row) => {
          const posId = $(row).find('td').first().text().trim();
          const posEntry = positions[posId];
          if (!posEntry || posEntry[0] == null) return; // skip unmapped or explicitly skipped positions

          // TE rows are handled after collecting them all (to continue numbering across TE rows)
          if (posId === 'TE') {
            teRows.push(row);
            return;
          }

          const posName = posEntry[0];
          const maxPlayers = posEntry[1];

          // iterate the columns that contain players
          $(row)
            .find('td.d3-o-depthchart__tiers-5')
            .each((colIndex, col) => {
              // enforce maxPlayers (0 means no limit)
              if (maxPlayers !== 0 && colIndex >= maxPlayers) return;

              const anchors = $(col).find('a');
              anchors.each((_, a) => {
                const playerName = $(a).text().trim();
                if (!playerName) return;

                // If this position id is in NO_NUMBER_POS_IDS, we always use the plain posName
                let depthPos;
                if (NO_NUMBER_POS_IDS.has(posId)) {
                  depthPos = posName;
                } else {
                  // Otherwise show primary as posName; subsequent columns get ordinals
                  if (colIndex === 0) {
                    depthPos = posName;
                  } else {
                    const ordArr = ['2nd', '3rd', '4th', '5th'];
                    const ord = ordArr[colIndex - 1] || `${colIndex + 1}th`;
                    depthPos = `${ord} ${posName}`;
                  }
                }

                if (seenPlayers[playerName]) {
                  // append the position text if it's not already present for that player
                  const existingParts = seenPlayers[playerName].depth_pos.split(' | ').map(s => s.trim());
                  if (!existingParts.includes(posName)) {
                    seenPlayers[playerName].depth_pos += ` | ${posName}`;
                  }
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

      // Handle TE rows: combine all TE anchors across the TE rows in order, then number them
      if (teRows.length > 0) {
        const maxTE = positions['TE'][1]; // e.g. 3
        const combined = [];

        // collect players in order: traverse each TE row's columns left-to-right, anchors in DOM order
        outer: for (const row of teRows) {
          const cols = $(row).find('td.d3-o-depthchart__tiers-5').toArray();
          for (let c = 0; c < cols.length; c++) {
            const anchors = $(cols[c]).find('a').toArray();
            for (const a of anchors) {
              const playerName = $(a).text().trim();
              if (!playerName) continue;
              combined.push(playerName);
              if (maxTE !== 0 && combined.length >= maxTE) break outer;
            }
          }
        }

        const ordinals = ['2nd', '3rd', '4th', '5th'];
        for (let idx = 0; idx < combined.length; idx++) {
          const playerName = combined[idx];
          if (!playerName) continue;
          const posName = positions['TE'][0];
          const depthPos = idx === 0 ? posName : `${ordinals[idx - 1] || `${idx + 1}th`} ${posName}`;

          if (seenPlayers[playerName]) {
            const existingParts = seenPlayers[playerName].depth_pos.split(' | ').map(s => s.trim());
            if (!existingParts.includes(posName)) {
              seenPlayers[playerName].depth_pos += ` | ${posName}`;
            }
          } else {
            const entry = {
              depth_name: playerName,
              depth_pos: depthPos,
            };
            seenPlayers[playerName] = entry;
            depthData.push(entry);
          }
        }
      }
    });

    console.log(`Found ${depthData.length} players. Writing to depth.json...`);
    await writeFile(OUTPUT_FILE, JSON.stringify(depthData, null, 2), 'utf8');
    console.log('Done!');
  } catch (err) {
    console.error('Error fetching depth chart:', err);
    process.exit(1);
  }
})();