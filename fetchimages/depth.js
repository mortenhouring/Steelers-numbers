import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const URL = 'https://www.steelers.com/team/depth-chart/';
const OUTPUT_FILE = path.resolve('fetchimages/depth.json');

// Map of position IDs to text strings and max number of players (0 = all)
const positions = {
  // Offense
  LT: ['Left Tackle', 0],
  LG: ['Left Guard', 0],
  C: ['Center', 0],
  RG: ['Right Guard', 0],
  RT: ['Right Tackle', 0],
  TE: ['Tight End', 3],
  RB: ['Running Back', 3],
  FB: [null, 0], // don't fetch
  QB: ['Quarterback', 0],
  WR: ['Wide Receiver', 0], // fetch all from both WR sections

  // Defense
  DT: ['Defensive Tackle', 0],
  NT: ['Nose Tackle', 0],
  DE: ['Defensive End', 2],
  LOLB: ['Left Outside Linebacker', 2],
  LILB: ['Left Inside Linebacker', 0],
  RILB: ['Right Inside Linebacker', 0],
  ROLB: ['Right Outside Linebacker', 2],
  LCB: ['Cornerback', 0],
  FS: ['Free Safety', 0],
  SS: ['Strong Safety', 2],
  RCB: ['Cornerback', 2],
  NB: ['Cornerback', 0],

  // Special Teams
  K: ['Kicker', 0],
  P: ['Punter', 0],
  LS: [null, 0], // don't fetch
  KR: ['Kick Returner', 2],
  PR: ['Punt Returner', 0],
};

// Helper to clean names
function cleanName(str) {
  return str.replace(/\s+/g, ' ').trim();
}

async function fetchDepthChart() {
  console.log('Fetching depth chart...');
  const { data } = await axios.get(URL);
  const $ = cheerio.load(data);

  const playerMap = {}; // key: player name, value: array of positions

  $('table.d3-o-depthchart tbody tr').each((i, row) => {
    const posID = cleanName($(row).find('td:first-child').text());
    const [posText, maxPlayers] = positions[posID] || [null, 0];

    if (!posText) return; // skip positions we don't want

    const cells = $(row).find('td.d3-o-depthchart__tiers-5');

    cells.each((idx, cell) => {
      if (maxPlayers && idx >= maxPlayers) return; // respect max
      const links = $(cell).find('a');

      links.each((_, link) => {
        const name = cleanName($(link).text());
        if (!name) return;

        if (!playerMap[name]) {
          playerMap[name] = [];
        }

        // Avoid duplicate positions
        if (!playerMap[name].includes(posText)) {
          playerMap[name].push(posText);
        }
      });
    });
  });

  // Convert map to array of objects
  const depthArray = Object.entries(playerMap).map(([name, posList]) => ({
    depth_name: name,
    depth_pos: posList.join(' | '),
  }));

  // Overwrite existing file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(depthArray, null, 2));
  console.log(`Saved ${depthArray.length} players to ${OUTPUT_FILE}`);
}

fetchDepthChart().catch((err) => {
  console.error('Error fetching depth chart:', err);
});