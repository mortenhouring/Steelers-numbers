import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const url = 'https://www.steelers.com/team/depth-chart/';
const outputFile = path.join(process.cwd(), 'fetchimages', 'depth.json');

// Map of position IDs to text strings and max number of players to fetch (0 = all)
const positions = {
  // Offense
  LT: ['Left Tackle', 1],
  LG: ['Left Guard', 1],
  C: ['Center', 1],
  RG: ['Right Guard', 1],
  RT: ['Right Tackle', 1],
  TE: ['Tight End', 3],
  RB: ['Running Back', 3],
  FB: [null, 0], // don't fetch
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
  LCB: ['Cornerback', 0], // all
  FS: ['Free Safety', 1],
  SS: ['Strong Safety', 2],
  RCB: ['Cornerback', 2],
  NB: ['Cornerback', 1],
  // Special Teams
  K: ['Kicker', 1],
  P: ['Punter', 1],
  LS: [null, 0], // don't fetch
  KR: ['Kick Returner', 2],
  PR: ['Punt Returner', 2],
};

// Helper to clean text
function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

async function fetchDepthChart() {
  console.log('Fetching depth chart...');
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const depth = {};
  const playerPositions = {}; // map player -> list of positions

  $('table.d3-o-depthchart tbody tr').each((_, row) => {
    const posId = cleanText($(row).find('td').first().text());
    if (!positions[posId] || !positions[posId][0]) return; // skip unwanted

    const [posText, maxPlayers] = positions[posId];
    const cells = $(row).find('td.d3-o-depthchart__tiers-5');

    cells.each((i, cell) => {
      if (maxPlayers && i >= maxPlayers) return; // limit number of players
      const links = $(cell).find('a');
      links.each((_, link) => {
        const playerName = cleanText($(link).text());
        if (!playerName) return;

        if (!playerPositions[playerName]) playerPositions[playerName] = [];
        if (!playerPositions[playerName].includes(posText)) {
          playerPositions[playerName].push(posText);
        }
      });
    });
  });

  // Build depth array
  const depthArray = Object.entries(playerPositions).map(([name, posArr]) => ({
    depth_name: name,
    depth_pos: posArr.join(' | '),
  }));

  // Save to file
  fs.writeFileSync(outputFile, JSON.stringify(depthArray, null, 2));
  console.log(`Depth chart saved to ${outputFile}`);
  console.log(`Total players fetched: ${depthArray.length}`);
}

fetchDepthChart().catch(err => {
  console.error('Error fetching depth chart:', err);
});