const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://www.steelers.com/team/depth-chart/';

const positionMap = {
  // Offense
  LT: 'Left tackle',
  LG: 'Left guard',
  C: 'Center',
  RG: 'Right guard',
  RT: 'Right tackle',
  TE: 'Tight end',
  RB: 'Running Back',
  QB: 'Quarterback',
  WR: 'Wide receiver',
  // Defense
  DT: 'Defensive tackle',
  NT: 'Nose tackle',
  DE: 'Defensive end',
  LOLB: 'Left outside linebacker',
  LILB: 'Left inside linebacker',
  RILB: 'Right inside linebacker',
  ROLB: 'Right outside linebacker',
  LCB: 'Cornerback',
  RCB: 'Cornerback',
  FS: 'Free safety',
  SS: 'Strong safety',
  NB: 'Cornerback',
  // Special Teams
  K: 'Kicker',
  P: 'Punter',
  KR: 'Kick returner',
  PR: 'Punt returner'
};

// Max number of players to fetch per position
const maxPlayers = {
  TE: 3, RB: 3, DE: 2, LOLB: 2, ROLB: 2, SS: 2, RCB: 2, KR: 2, PR: 2
};

(async () => {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const depth = [];

    $('table.d3-o-depthchart tbody tr').each((i, row) => {
      const posId = $(row).find('td:first').text().trim();
      if (!positionMap[posId]) return;

      const maxCount = maxPlayers[posId] || 1;
      let count = 0;

      $(row).find('td.d3-o-depthchart__tiers-5').each((j, cell) => {
        const players = $(cell).find('a');
        players.each((k, player) => {
          if (count >= maxCount) return;
          const name = $(player).text().trim();
          let posText = positionMap[posId];
          if (count === 1) posText = `2nd ${posText}`;
          if (count === 2) posText = `3rd ${posText}`;
          // Only 2nd/3rd get prefix, first player just plain
          depth.push({ depth_name: name, depth_pos: posText });
          count++;
        });
      });
    });

    fs.writeFileSync('fetchimages/depth.json', JSON.stringify(depth, null, 2));
    console.log(`Fetched ${depth.length} players`);
    console.log(depth);
  } catch (err) {
    console.error('Error fetching depth chart:', err);
  }
})();