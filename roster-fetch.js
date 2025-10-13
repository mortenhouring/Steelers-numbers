// roster-fetch.js
import fs from 'fs/promises';
import axios from 'axios';
import { load } from 'cheerio';

// ---------- CONFIG ----------
const TEST_PLAYER_URL = 'https://www.steelers.com/team/players-roster/dk-metcalf/';
const OUTPUT_JSON = './roster.json';
const IMAGE_FOLDER = 'fetchimages/active/'; // local image folder

// ---------- HELPER FUNCTIONS ----------

/**
 * Parse allowed trivia sections
 */
function parseTriviaSections($) {
  const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
  let trivia = '';

  allowedSections.forEach((sectionTitle) => {
    // Look for strong or span that matches the section title
    const sectionHeader = $(`strong, span`).filter((_, el) =>
      $(el).text().trim().toUpperCase() === sectionTitle
    ).first();

    if (sectionHeader.length) {
      let sectionContent = '';
      const nextUL = sectionHeader.closest('div').find('ul').first();
      if (nextUL.length) {
        sectionContent = nextUL.find('li').toArray().map(li => $(li).text().trim()).join('\n');
      }
      trivia += `\n\n**${sectionTitle}**\n${sectionContent}`;
    }
  });

  return trivia.trim();
}

/**
 * Parse info string
 */
function parseInfo($) {
  const summary = { age: '', exp: '', ht: '', wt: '' };

  $('p').each((_, p) => {
    const text = $(p).text().trim();
    if (text.startsWith('Age:')) summary.age = text.replace('Age:', '').trim();
    if (text.startsWith('Experience:')) summary.exp = text.replace('Experience:', '').trim();
    if (text.startsWith('Height:')) summary.ht = text.replace('Height:', '').trim();
    if (text.startsWith('Weight:')) summary.wt = text.replace('Weight:', '').trim();
  });

  return `AGE ${summary.age} | EXP ${summary.exp} | HT/WT ${summary.ht}/${summary.wt}`;
}

/**
 * Parse stats if present
 */
function parseStats($) {
  const statsList = $('.nfl-t-stats-tile__list li').toArray();
  if (!statsList.length) return {};

  const stats = {};
  statsList.forEach(li => {
    const label = $(li).find('.nfl-t-stats-tile__label-full').text().trim();
    const value = $(li).find('.nfl-t-stats-tile__value').text().trim();
    if (label && value) stats[label] = value;
  });

  return stats;
}

/**
 * Format local image path
 */
function formatImagePath(name) {
  const formattedName = name.toLowerCase().replace(/\s+/g, '_');
  return `${IMAGE_FOLDER}${formattedName}.jpg`;
}

// ---------- MAIN ----------

async function fetchPlayer(url) {
  // Fetch HTML
  const res = await axios.get(url);
  const $ = load(res.data);

  // Basic info
  const name = $('h1.d3-o-media-object__title').first().text().trim() || 'Unknown';
  const position = $('h3.d3-o-media-object__primary-subtitle').first().text().trim() || null;
  const number = $('h3.d3-o-media-object__secondary-subtitle').first().text().replace('#', '').trim() || null;

  const player = {
    player_name: name,
    number,
    position,
    group: 'Active Roster',
    image: formatImagePath(name), // local reference
    info: parseInfo($),
    career: '',        // can populate later
    achievements: '',  // optional
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

  // Test: overwrite with single player
  roster = [player];

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(roster, null, 2), 'utf-8');
  console.log('Roster updated successfully.');
}

// Run
main().catch(err => {
  console.error('Error fetching player:', err);
});