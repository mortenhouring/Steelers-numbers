// roster-fetch.js
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import cheerio from 'cheerio';

// ---------- CONFIG ----------
const TEST_PLAYER_URL = 'https://www.steelers.com/team/players-roster/dk-metcalf/';
const OUTPUT_JSON = './roster.json';
const IMAGE_DIR = './fetchimages/images/';

// ---------- HELPERS ----------
async function downloadImage(url, filepath) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, response.data);
}

// Robust trivia extraction
function parseTriviaSections($) {
  const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
  let trivia = '';

  allowedSections.forEach((sectionTitle) => {
    const heading = $(`strong, span`).filter((i, el) => $(el).text().trim().toUpperCase() === sectionTitle).first();
    if (heading.length) {
      // Look for closest <ul> after the heading
      let listItems = heading.closest('div').find('ul li');
      if (!listItems.length) {
        // fallback: next ul sibling
        listItems = heading.nextAll('ul').first().find('li');
      }

      if (listItems.length) {
        const content = listItems.map((i, li) => $(li).text().trim()).get().join('\n');
        trivia += `\n\n**${sectionTitle}**\n${content}`;
      }
    }
  });

  return trivia.trim();
}

// Info string
function parseInfo($) {
  let summary = { age: '', exp: '', ht: '', wt: '' };
  $('p').each((i, p) => {
    const text = $(p).text().trim();
    if (text.startsWith('Age:')) summary.age = text.replace('Age:', '').trim();
    if (text.startsWith('Experience:')) summary.exp = text.replace('Experience:', '').trim();
    if (text.startsWith('Height:')) summary.ht = text.replace('Height:', '').trim();
    if (text.startsWith('Weight:')) summary.wt = text.replace('Weight:', '').trim();
  });
  return `AGE ${summary.age} | EXP ${summary.exp} | HT/WT ${summary.ht}/${summary.wt}`;
}

// Stats extraction
function parseStats($) {
  const statsList = $('.nfl-t-stats-tile__list li');
  if (!statsList.length) return {};
  const stats = {};
  statsList.each((i, li) => {
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
  const name = $('h1.d3-o-media-object__title').first().text().trim();
  const position = $('h3.d3-o-media-object__primary-subtitle').first().text().trim();
  const number = $('h3.d3-o-media-object__secondary-subtitle').first().text().replace('#','').trim();

  // Local image path
  const firstLast = name.toLowerCase().replace(/\s+/g, '_');
  const imagePath = path.join(IMAGE_DIR, `${firstLast}.jpg`);

  // Try to find image from ld+json
  let imageUrl = '';
  $('script[type="application/ld+json"]').each((i, s) => {
    try {
      const data = JSON.parse($(s).html());
      if (data?.member?.member?.name === name && data?.member?.member?.image?.contentUrl) {
        imageUrl = data.member.member.image.contentUrl;
      }
    } catch {}
  });

  if (imageUrl) await downloadImage(imageUrl, imagePath);

  const player = {
    player_name: name || 'Unknown',
    number: number || null,
    position: position || null,
    group: 'Active Roster',
    image: imagePath,
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