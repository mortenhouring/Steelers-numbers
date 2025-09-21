'use strict';
const fs = require('fs').promises;
const path = require('path');

// Source files
const depthSource = path.join(__dirname, 'depth.json'); // fetchimages/depth.json
const rosterPath = path.join(__dirname, 'images-rosterupdate.json'); // fetchimages/images-rosterupdate.json

// Target file (root depth.json)
const depthTarget = path.join(__dirname, '..', 'depth.json'); // repo root

(async function main() {
  const depthData = JSON.parse(await fs.readFile(depthSource, 'utf8'));
  const rosterData = JSON.parse(await fs.readFile(rosterPath, 'utf8'));

  if (!Array.isArray(depthData)) {
    throw new Error('fetchimages/depth.json must be an array');
  }
  if (!Array.isArray(rosterData)) {
    throw new Error('fetchimages/images-rosterupdate.json must be an array');
  }

  const depthNames = depthData.map(entry => entry.depth_name);

  const output = [];
  for (const name of depthNames) {
    const match = rosterData.find(p => p.player_name === name);
    if (match) {
      output.push({
        player_name: match.player_name,
        number: match.number,
        position: match.position,
        player_id: match.player_id,
        player_image: match.player_image,
        group: match.group,
        trivia: match.trivia,
        stats: match.stats
      });
    }
  }

  await fs.writeFile(depthTarget, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${output.length} matched players to root depth.json`);
})();