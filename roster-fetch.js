// roster-fetch.js
const fs = require('fs');

// Replace these snippets with the actual HTML content for testing
const playerSnippets = [
  `<div class="player">
      <span class="player-name">Pat Freiermuth</span>
      <span class="player-number">88</span>
      <span class="player-position">TE</span>
  </div>`,
  `<div class="player">
      <span class="player-name">DK Metcalf</span>
      <span class="player-number">14</span>
      <span class="player-position">WR</span>
  </div>`
];

// Function to parse a single player snippet
function parsePlayer(html) {
  try {
    const nameMatch = html.match(/<span class="player-name">([\s\S]*?)<\/span>/);
    const numberMatch = html.match(/<span class="player-number">([\d]+)<\/span>/);
    const positionMatch = html.match(/<span class="player-position">([\s\S]*?)<\/span>/);

    if (!nameMatch || !numberMatch || !positionMatch) {
      throw new Error('Failed to parse player snippet: ' + html);
    }

    return {
      player_name: nameMatch[1].trim(),
      number: parseInt(numberMatch[1], 10),
      position: positionMatch[1].trim()
    };
  } catch (err) {
    console.error(err.message);
    return null;
  }
}

// Parse all players
const roster = playerSnippets
  .map(parsePlayer)
  .filter(player => player !== null); // Remove any failed parses

// Write to roster.json
try {
  fs.writeFileSync('roster.json', JSON.stringify(roster, null, 2), 'utf8');
  console.log('Roster saved successfully to roster.json');
} catch (err) {
  console.error('Failed to write roster.json:', err);
}