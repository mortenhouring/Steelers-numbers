const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'images-rosterupdate.json');
const outputPath = path.join(__dirname, '..', 'currentroster.json');

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

let raw;
try {
  raw = fs.readFileSync(inputPath, 'utf8');
} catch (err) {
  console.error(`Failed to read input file: ${err}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error(`Invalid JSON in input file: ${err}`);
  process.exit(1);
}

// Keep only OFF, DEF, ST
const filtered = data.filter(item => ['OFF', 'DEF', 'ST'].includes(item.group));

// Ensure player_image path format
filtered.forEach(item => {
  if (item.player_id && !item.player_image) {
    item.player_image = `fetchimages/images/${item.player_id}.png`;
  }
});

try {
  fs.writeFileSync(outputPath, JSON.stringify(filtered, null, 2), 'utf8');
  console.log(`Wrote ${filtered.length} items to ${outputPath}`);
} catch (err) {
  console.error(`Failed to write output file: ${err}`);
  process.exit(1);
}