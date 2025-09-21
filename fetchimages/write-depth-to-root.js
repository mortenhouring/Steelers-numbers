import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Emulate __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input files
const depthSource = path.join(__dirname, 'depth.json'); // fetchimages/depth.json
const rosterPath = path.join(__dirname, 'images-rosterupdate.json'); // fetchimages/images-rosterupdate.json

// Output file (root depth.json)
const depthTarget = path.join(__dirname, '..', 'depth.json'); // repo root

const main = async () => {
  // Read input JSON files
  const depthDataRaw = await fs.readFile(depthSource, 'utf8');
  const rosterDataRaw = await fs.readFile(rosterPath, 'utf8');

  const depthData = JSON.parse(depthDataRaw);
  const rosterData = JSON.parse(rosterDataRaw);

  // Validate arrays
  if (!Array.isArray(depthData)) throw new Error('fetchimages/depth.json must be an array');
  if (!Array.isArray(rosterData)) throw new Error('fetchimages/images-rosterupdate.json must be an array');

  // Extract depth names
  const depthNames = depthData.map(entry => entry.depth_name);

  // Build output array
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

  // Write root depth.json
  await fs.writeFile(depthTarget, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${output.length} matched players to root depth.json`);
};

// Run
main().catch(err => {
  console.error('Error updating root depth.json:', err);
  process.exit(1);
});