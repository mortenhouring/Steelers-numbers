// roster-fetch.js
import fs from 'fs/promises';
import axios from 'axios';
import cheerio from 'cheerio';

// ---------- CONFIG ----------
const TEST_PLAYER_URL = 'https://www.steelers.com/team/players-roster/dk-metcalf/';
const OUTPUT_JSON = './roster.json';

// ---------- HELPER FUNCTIONS ----------
function parseTriviaSections($) {
  const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
  let trivia = '';

  allowedSections.forEach(sectionTitle => {
    const sectionHeader = $('strong, span').filter((i, el) => $(el).text().trim().toUpperCase() === sectionTitle).first();

    if (sectionHeader.length) {
      let sectionContent = '';
      const nextUL = sectionHeader.closest('div').find('ul').first();
      if (nextUL.length) {
        sectionContent = nextUL.find('li').map((i, li) => $(li).text().trim()).get().join('\n');
      }

      trivia += `\n\n**${sectionTitle}**\n${sectionContent}`;
    }
  });

  return trivia.trim();
}

function parseInfo($) {
  const summary = { age: '', exp: '', ht: '', wt: '' };

  $('p').each((i, el) => {
    const text = $(el).text().trim();
    if (text.startsWith('Age:')) summary.age = text.replace('Age:', '').trim();
    if (text.startsWith('Experience:')) summary.exp = text.replace('Experience:', '').trim();
    if (text.startsWith('Height:')) summary.ht = text.replace('Height:', '').trim();
    if (text.startsWith('Weight:')) summary.wt = text.replace('Weight:', '').trim();
  });

  return `AGE ${summary.age} | EXP ${summary.exp} | HT/WT ${summary.ht}/${summary.wt}`;
}

function parseStats($) {
  const stats = {};
  $('.nfl-t-stats-tile__list li').each((i, li) => {
    const label = $(li).find('.nfl-t-stats-tile__label-full').text().trim();
    const value = $(li).find('.nfl-t-stats-tile__value').text().trim();
    if (label && value) stats[label] = value;
  });
  return stats;
}

// ---------- MAIN ----------
async function fetchPlayer(url) {
  const res = await axios.get(url);
  const $ = cheerio.load(res.data);

  // Basic info
  const name = $('h1.d3-o-media-object__title').first().text().trim() || 'Unknown';
  const position = $('h3.d3-o-media-object__primary-subtitle').first().text().trim() || null;
  const number = $('h3.d3-o-media-object__secondary-subtitle').first().text().replace('#', '').trim() || null;

  // Image local path as instructed
  const firstName = name.split(' ')[0].toLowerCase();
  const lastName = name.split(' ')[1].toLowerCase();
  const image = `fetchimages/active/${firstName}_${lastName}.jpg`;

  const player = {
    player_name: name,
    number,
    position,
    group: 'Active Roster',
    image,
    info: parseInfo($),
    career: '',
    achievements: '',
    trivia: parseTriviaSections($),
    stats: parseStats($)
  };

  return player;
}

async function main() {
  let roster = [];
  try {
    const data = await fs.readFile(OUTPUT_JSON, 'utf-8');
    roster = JSON.parse(data);
  } catch {
    roster = [];
  }

  const player = await fetchPlayer(TEST_PLAYER_URL);

  // For test, overwrite any existing single-player entry
  roster = [player];

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(roster, null, 2), 'utf-8');
  console.log('Roster updated successfully.');
}

main().catch(err => console.error(err));