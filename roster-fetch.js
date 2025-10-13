// roster-fetch.js
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { JSDOM } from 'jsdom';

// ---------- CONFIG ----------
const TEST_PLAYER_URL = 'https://www.steelers.com/team/players-roster/dk-metcalf/';
const OUTPUT_JSON = './roster.json';
const IMAGE_DIR = './fetchimages/images/';

// ---------- HELPER FUNCTIONS ----------
function sanitizeName(name) {
  return name.toLowerCase().replace(/[^a-z]/g, '_');
}

function parseInfo(document) {
  const summary = [...document.querySelectorAll('p')].reduce((acc, p) => {
    const text = p.textContent.trim();
    if (text.startsWith('Age:')) acc.age = text.replace('Age:', '').trim();
    if (text.startsWith('Experience:')) acc.exp = text.replace('Experience:', '').trim();
    if (text.startsWith('Height:')) acc.ht = text.replace('Height:', '').trim();
    if (text.startsWith('Weight:')) acc.wt = text.replace('Weight:', '').trim();
    return acc;
  }, { age: '', exp: '', ht: '', wt: '' });

  return `AGE ${summary.age} | EXP ${summary.exp} | HT/WT ${summary.ht}/${summary.wt}`;
}

function parseTriviaSections(document) {
  const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
  let trivia = '';

  allowedSections.forEach((sectionTitle) => {
    const sectionHeader = [...document.querySelectorAll('strong, span')]
      .find(el => el.textContent.trim().toUpperCase() === sectionTitle);

    if (sectionHeader) {
      let sectionContent = '';
      const nextUL = sectionHeader.closest('div')?.querySelector('ul');
      if (nextUL) {
        const lis = [...nextUL.querySelectorAll('li')];
        sectionContent = lis.map(li => li.textContent.trim()).join('\n');
      }

      trivia += `\n\n**${sectionTitle}**\n${sectionContent}`;
    }
  });

  return trivia.trim();
}

function parseStats(document) {
  const statsList = [...document.querySelectorAll('.nfl-t-stats-tile__list li')];
  if (!statsList.length) return {};

  const stats = {};
  statsList.forEach(li => {
    const labelEl = li.querySelector('.nfl-t-stats-tile__label-full');
    const valueEl = li.querySelector('.nfl-t-stats-tile__value');
    if (labelEl && valueEl) stats[labelEl.textContent.trim()] = valueEl.textContent.trim();
  });

  return stats;
}

async function downloadImage(url, filepath) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, response.data);
}

// ---------- MAIN ----------
async function fetchPlayer(url) {
  const res = await axios.get(url);
  const dom = new JSDOM(res.data);
  const doc = dom.window.document;

  // Basic info
  const nameEl = doc.querySelector('h1.d3-o-media-object__title');
  const positionEl = doc.querySelector('h3.d3-o-media-object__primary-subtitle');
  const numberEl = doc.querySelector('h3.d3-o-media-object__secondary-subtitle');

  // Extract image URL from JSON-LD script
  const jsonLdScript = [...doc.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => s.textContent)
    .find(t => t.includes('"@type": "Person"'));
  let imageUrl = '';
  if (jsonLdScript) {
    try {
      const ld = JSON.parse(jsonLdScript);
      imageUrl = ld?.member?.image?.contentUrl || '';
    } catch {}
  }

  const playerName = nameEl?.textContent.trim() || 'Unknown';
  const imageFilename = sanitizeName(playerName) + '.jpg';
  const imagePath = path.join(IMAGE_DIR, imageFilename);

  // Download image locally
  if (imageUrl) await downloadImage(imageUrl, imagePath);

  const player = {
    player_name: playerName,
    number: numberEl?.textContent.replace('#', '').trim() || null,
    position: positionEl?.textContent.trim() || null,
    group: 'Active Roster',
    image: imagePath,
    info: parseInfo(doc),
    career: '',
    achievements: '',
    trivia: parseTriviaSections(doc),
    stats: parseStats(doc)
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

  // Overwrite roster for single-player test
  roster = [player];

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(roster, null, 2), 'utf-8');
  console.log('Roster updated successfully.');
}

main().catch(err => console.error(err));