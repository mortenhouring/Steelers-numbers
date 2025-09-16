// trivia-shuffle.js
import fs from 'fs';
import path from 'path';

// Load trivia.json once at startup
const triviaPath = path.resolve('./fetchimages/trivia.json');
let triviaData = {};
try {
  triviaData = JSON.parse(fs.readFileSync(triviaPath, 'utf-8'));
} catch (err) {
  console.error('Error loading trivia.json:', err.message);
}

// Helper: shuffle array
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build one paragraph of trivia for a player_id
 */
export function generateTriviaParagraph(playerId) {
  const player = triviaData[playerId];
  if (!player || !player.trivia) {
    return {
      paragraph: '',
      selectedStrings: []
    };
  }

  const categories = Object.keys(player.trivia);
  let selectedStrings = [];

  // Try to pick 1–2 random facts from up to 3 categories
  for (const cat of shuffle(categories).slice(0, 3)) {
    const facts = player.trivia[cat];
    if (Array.isArray(facts) && facts.length > 0) {
      const picked = shuffle(facts).slice(0, 2);
      selectedStrings.push(...picked);
    }
  }

  // Fallback if no facts selected
  if (selectedStrings.length === 0) {
    return {
      paragraph: '',
      selectedStrings: []
    };
  }

  // Make a readable paragraph
  const paragraph = selectedStrings.join(' ');

  return {
    paragraph,
    selectedStrings
  };
}

// Run standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputFile = path.resolve('./fetchimages/temp.json');
  const outputFile = path.resolve('./fetchimages/tempoutput.json');

  if (!fs.existsSync(inputFile)) {
    console.error('temp.json not found');
    process.exit(1);
  }

  const inputIds = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const output = {};

  for (const pid of inputIds) {
    output[pid] = generateTriviaParagraph(pid);
  }

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log('Output written to', outputFile);
}