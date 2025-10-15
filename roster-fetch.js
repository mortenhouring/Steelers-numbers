// roster-fetch.js
import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import path from 'path';

///////////////////////////////////
// Fetch active roster players///
/////////////////////////////////
async function fetchActiveRoster() {
  const rosterUrl = 'https://www.steelers.com/team/players-roster/';
  const { data } = await axios.get(rosterUrl);
  const dom = new JSDOM(data);
  const document = dom.window.document;

  const activeRoster = [];

  // Find the Active section
  const activeHeader = [...document.querySelectorAll('h4.nfl-o-roster__title')].find(h4 =>
    h4.querySelector('span.nfl-o-roster__title-status')?.textContent.trim() === 'Active'
  );

  if (!activeHeader) return activeRoster; // no active roster found

  // Get the table below the header
  const table = activeHeader.parentElement.querySelector('table');
  if (!table) return activeRoster;

  // Collect each player
  table.querySelectorAll('span.nfl-o-roster__player-name a').forEach(a => {
    const name = a.textContent.trim();
    const url = 'https://www.steelers.com' + a.getAttribute('href');
    activeRoster.push({ name, url });
  });

  return activeRoster;
}

async function fetchPlayer(player) {
  try {
    const { data } = await axios.get(player.url);
    const dom = new JSDOM(data);
    const document = dom.window.document;

////////////////////////////
// FETCH Functions ////////
//////////////////////////

// Name
const nameEl = document.querySelector('.d3-o-media-object__title');
const name = nameEl ? nameEl.textContent.trim() : player.name;

// Position
const positionEl = document.querySelector('.d3-o-media-object__primary-subtitle');
const position = positionEl ? positionEl.textContent.trim() : 'N/A';

// Number
const numberEl = document.querySelector('.d3-o-media-object__secondary-subtitle');
const numberText = numberEl ? numberEl.textContent.replace('#', '').trim() : '0';
const number = Number(numberText);

// Info (Experience, Height, Weight, Age)
const summaryEl = document.querySelector('.d3-o-media-object__summary');
let info = '-';
if (summaryEl) {
  const stats = {};
  summaryEl.querySelectorAll('p').forEach(p => {
    const label = p.querySelector('strong')?.textContent.replace(':', '').trim().toLowerCase();
    const value = p.textContent.replace(p.querySelector('strong')?.textContent || '', '').trim();
    if (label && value) stats[label] = value;
  });

  const exp = stats['experience'] ? (stats['experience'].includes('0') ? 'rookie' : stats['experience'].replace('years', '').trim()) : '-';
  const height = stats['height'] || '-';
  const weight = stats['weight'] || '-';
  const age = stats['age'] || '-';

  info = `EXP: ${exp} | HT: ${height} | WT: ${weight} | AGE: ${age}`;
}

// --- Stats ---
const statsSection = document.querySelector('.nfl-t-stats-tile--player');
let stats = [];

if (statsSection) {
  const labels = [...statsSection.querySelectorAll('.nfl-t-stats-tile__label-full')];
  const values = [...statsSection.querySelectorAll('.nfl-t-stats-tile__value')];

  stats = labels.map((label, i) => ({
    label: label.textContent.trim(),
    value: values[i] ? values[i].textContent.trim() : "-"
  }));
} else {
  stats = [];
}
// --- Trivia (Biography Sections) ---
const trivia = {
  pro_career: [],
  career_highlights_regular: [],
  career_highlights_post: []
};

// Find all biography text blocks
const bioSections = [...document.querySelectorAll('.nfl-c-body-part.nfl-c-body-part--text')];

for (let i = 0; i < bioSections.length; i++) {
  const section = bioSections[i];
  const headingEl = section.querySelector('p strong');
  if (!headingEl) continue;
  const heading = headingEl.textContent.trim().toUpperCase();

  // Skip if already filled
  if (heading.startsWith('PRO CAREER') && trivia.pro_career.length > 0) continue;
  if (heading.startsWith('CAREER HIGHLIGHTS (REGULAR SEASON)') && trivia.career_highlights_regular.length > 0) continue;
  if (heading.startsWith('CAREER HIGHLIGHTS (POSTSEASON)') && trivia.career_highlights_post.length > 0) continue;

  // Look for next sibling with content (<ul> or <p>)
  let contentSection = section.nextElementSibling;
  let entries = [];

  if (contentSection) {
    const listItems = [...contentSection.querySelectorAll('li')].map(li => li.textContent.trim());
    const paragraphs = [...contentSection.querySelectorAll('p')].map(p => p.textContent.trim());
    entries = listItems.length ? listItems : paragraphs;
  }

  if (heading.startsWith('PRO CAREER')) {
    trivia.pro_career.push(...entries);
  } else if (heading.startsWith('CAREER HIGHLIGHTS (REGULAR SEASON)')) {
    trivia.career_highlights_regular.push(...entries);
  } else if (heading.startsWith('CAREER HIGHLIGHTS (POSTSEASON)')) {
    trivia.career_highlights_post.push(...entries);
  }
}
// --- Achievements (robust PFR fetch) ---
let achievements = [];
try {
  const normalizeName = (name) => {
    return name
      .toLowerCase()
      .replace(/[.'’]/g, '')               // remove punctuation
      .replace(/\b(jr|ii|iii|iv)\b/g, '')  // remove suffixes
      .trim();
  };

  const last = name.split(' ').slice(-1)[0];
  const initial = last[0].toUpperCase();
  const pfrListUrl = `https://www.pro-football-reference.com/players/${initial}/`;

  // Fetch the players list for the initial letter
  const { data: listHtml } = await axios.get(pfrListUrl);
  const domList = new JSDOM(listHtml);
  const docList = domList.window.document;

  // Find the correct player link by matching normalized name
  const playerLinkEl = [...docList.querySelectorAll('#players tbody tr th a')].find(a => {
    const [lastName, firstName] = a.textContent.split(',').map(s => s.trim());
    const fullName = `${firstName} ${lastName}`;
    return normalizeName(fullName) === normalizeName(name);
  });

  if (playerLinkEl) {
    const pfrLink = 'https://www.pro-football-reference.com' + playerLinkEl.getAttribute('href');

    // Fetch the player's PFR page
    const { data: playerHtml } = await axios.get(pfrLink);
    const domPlayer = new JSDOM(playerHtml);
    const docPlayer = domPlayer.window.document;

    const awardEls = Array.from(docPlayer.querySelectorAll('#bling li a'));
    const mainAwards = ['Pro Bowl', 'All-Pro', 'SB Champ', 'AP MVP', 'PFWA MVP', 'SB MVP', 'Off. PoY'];
    const foundAwards = [];

    awardEls.forEach(a => {
      const text = a.textContent.trim();
      mainAwards.forEach(ma => {
        if (text.includes(ma) && !foundAwards.includes(text)) {
          foundAwards.push(text);
        }
      });
    });

    achievements = foundAwards;
  } else {
    console.warn(`PFR link not found for ${name}`);
  }
} catch (err) {
  console.error(`Error fetching awards for ${name}:`, err.message);
}
///////////////////////////////
// Image /////////////////////
/////////////////////////////
let imagePath = null;
const ldJsonEl = document.querySelector('script[type="application/ld+json"]');
if (ldJsonEl) {
  try {
    const ldJson = JSON.parse(ldJsonEl.textContent);
    const imgUrl = ldJson.member?.member?.image?.contentUrl;
    if (imgUrl) {
      const nameParts = name.split(' ');
      const firstName = nameParts[0].toLowerCase();
      const lastName = nameParts.slice(1).join('_').toLowerCase();
      const fileName = `${firstName}_${lastName}.jpeg`;

      // Ensure directory exists
      const dir = path.resolve('fetchimages/images');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, fileName);

      console.log('Fetching image URL:', imgUrl); // debug
      const response = await axios.get(imgUrl, {
        responseType: 'arraybuffer',
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' // mimics browser
        }
      });

      const contentType = response.headers['content-type'];
      if (!contentType.startsWith('image')) {
        console.error(`Unexpected content type for ${player.name}: ${contentType}`);
      } else {
        fs.writeFileSync(filePath, response.data);
        imagePath = `fetchimages/images/${fileName}`; // store relative path for JSON
        console.log(`Saved image for ${player.name} to ${imagePath}`);
      }
    }
  } catch (err) {
    console.error(`Error fetching image for ${player.name}:`, err.message);
  }
}
/////////////////////////////////
// Return IDs - Write data /////
///////////////////////////////

//Defines JSON strings //return { are the json  IDs//
return { player_name: name, number, position, image: imagePath, info, stats, achievements, trivia };
  } catch (err) {
    console.error(`Error fetching ${player.name}:`, err.message);
    return null;
  }
}

/////////////////////////////////
// Main ////////////////////////
///////////////////////////////
async function main() {
  const results = [];
  const players = await fetchActiveRoster();

  for (const player of players) {
    const data = await fetchPlayer(player);
    if (data) results.push(data);
  }

  // Insert timestamp as a "virtual" first object
  const timestampEntry = {
    last_updated: new Date().toISOString()
  };

  // Prepend timestamp to the beginning of the array
  const output = [timestampEntry, ...results];

  // Write JSON file
  fs.writeFileSync('roster.json', JSON.stringify(output, null, 2));
  console.log('Roster saved to roster.json with timestamp entry at top.');
}

main();