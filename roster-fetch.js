// roster-fetch.js
const fs = require('fs');
const fetch = require('node-fetch');

// Player pages to scrape
const playerPages = [
  'https://www.steelers.com/team/players-roster/pat-freiermuth/',
  'https://www.steelers.com/team/players-roster/dk-metcalf/'
];

// Helper to fetch HTML and extract player info
async function fetchPlayerData(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const html = await res.text();

    // Extract player_name
    const nameMatch = html.match(/<h1[^>]*class="PlayerHeader__Name[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
    if (!nameMatch) throw new Error('Player name not found for ' + url);
    const player_name = nameMatch[1].trim();

    // Extract number
    const numberMatch = html.match(/<span[^>]*class="PlayerHeader__Number[^"]*"[^>]*>(\d+)<\/span>/);
    if (!numberMatch) throw new Error('Player number not found for ' + url);
    const number = parseInt(numberMatch[1], 10);

    // Extract position
    const positionMatch = html.match(/<span[^>]*class="PlayerHeader__Position[^"]*"[^>]*>([\w\/]+)<\/span>/);
    if (!positionMatch) throw new Error('Player position not found for ' + url);
    const position = positionMatch[1].trim();

    return { player_name, number, position };
  } catch (err) {
    console.error(err.message);
    return null;
  }
}

(async () => {
  const roster = [];
  for (const url of playerPages) {
    const playerData = await fetchPlayerData(url);
    if (playerData) roster.push(playerData);
  }

  try {
    fs.writeFileSync('roster.json', JSON.stringify(roster, null, 2), 'utf8');
    console.log('Roster saved successfully to roster.json');
  } catch (err) {
    console.error('Failed to write roster.json:', err);
  }
})();