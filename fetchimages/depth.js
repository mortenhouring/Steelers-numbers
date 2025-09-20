// depth.js
import { writeFile } from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { load } from 'cheerio';

const DEPTH_URL = 'https://www.steelers.com/team/depth-chart/';
const OUTPUT_FILE = path.resolve('depth.json'); // just depth.json, because workflow cd's into fetchimages

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
      // collect TE rows for special handling, process others normally
      const teRows = [];

      $(table)
        .find('tbody tr')
        .each((_, row) => {
          const posId = $(row).find('td').first().text().trim();
          const posEntry = positions[posId];
          if (!posEntry || !posEntry[0]) return; // skip positions marked null

          // Special-case: collect TE rows to handle them together later
          if (posId === 'TE') {
            teRows.push(row);
            return;
          }

          const posName = posEntry[0];
          const maxPlayers = posEntry[1];

          // Process all columns for this row (non-TE)
          const cols = $(row).find('td.d3-o-depthchart__tiers-5').toArray();
          cols.forEach((col, colIndex) => {
            if (maxPlayers !== 0 && colIndex >= maxPlayers) return;
            const anchors = $(col).find('a').toArray();
            anchors.forEach(a => {
              const playerName = $(a).text().trim();
              if (!playerName) return;

              // Build depth string (no leading digit)
              let depthPos;
              if (colIndex === 0) {
                depthPos = posName;
              } else {
                const ord = ['2nd', '3rd', '4th', '5th'][colIndex - 1] || `${colIndex + 1}th`;
                depthPos = `${ord} ${posName}`;
              }

              if (seenPlayers[playerName]) {
                // Already exists, append if position not present
                if (!seenPlayers[playerName].depth_pos.includes(posName)) {
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

      // --- TE special handling (combine all TE rows and number across them) ---
      if (teRows.length > 0) {
        const maxTE = positions['TE'][1]; // typically 3 in your config
        const combined = [];

        // Row-major: iterate teRows in document order, for each row take its columns left-to-right,
        // and collect anchors in the order they appear, stopping when we reach maxTE (if maxTE !== 0).
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

        // Assign depth_pos strings for combined TE players (Tight End, 2nd Tight End, 3rd Tight End, ...)
        const ordinals = ['2nd', '3rd', '4th', '5th'];
        for (let idx = 0; idx < combined.length; idx++) {
          const playerName = combined[idx];
          if (!playerName) continue;
          const posName = positions['TE'][0];
          const depthPos = idx === 0 ? posName : `${ordinals[idx - 1] || `${idx + 1}th`} ${posName}`;

          if (seenPlayers[playerName]) {
            if (!seenPlayers[playerName].depth_pos.includes(posName)) {
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
      // --- end TE special handling ---
    });

    console.log(`Found ${depthData.length} players. Writing to depth.json...`);
    await writeFile(OUTPUT_FILE, JSON.stringify(depthData, null, 2));
    console.log('Done!');

  } catch (err) {
    console.error('Error fetching depth chart:', err);
    process.exit(1);
  }
})();