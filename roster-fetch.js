// roster-fetch.js
import fs from 'fs/promises';
import { JSDOM } from 'jsdom';
import axios from 'axios';

// ---------- CONFIG ----------
const TEST_PLAYER_URL = 'https://www.steelers.com/team/players-roster/dk-metcalf/';
const OUTPUT_JSON = './roster.json';

// ---------- HELPER FUNCTIONS ----------
function parseTriviaSections(document) {
  const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
  let trivia = '';

  allowedSections.forEach((sectionTitle) => {
    const sectionHeader = [...document.querySelectorAll('strong, span')]
      .find(el => el.textContent.trim().toUpperCase() === sectionTitle);

    if (sectionHeader) {
      let sectionContent = '';
      const nextUL = sectionHeader.parentElement.nextElementSibling?.querySelector('ul') ||
                     sectionHeader.closest('div')?.querySelector('ul');
      if (nextUL) {
        const lis = [...nextUL.querySelectorAll('li')];
        sectionContent = lis.map(li => li.textContent.trim()).join('\n');
      }

      trivia += `\n\n**${sectionTitle}**\n${sectionContent}`;
    }
  });

  return trivia.trim();
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

function parseStats(document) {
  const statsList = [...document.querySelectorAll('.nfl-t-stats-tile__list li')];
  if (!statsList.length) return {};

  const stats = {};
  statsList.forEach(li => {
    const labelEl = li.querySelector('.nfl-t-stats-tile__label-full');
    const valueEl = li.querySelector('.nfl-t-stats-tile__value');
    if (labelEl && valueEl) stats[labelEl.textContent.trim()] = Number(valueEl.textContent.trim());
  });

  return stats;
}

// ---------- MAIN ----------
async function fetchPlayer(url) {
  const res = await axios.get(url);
  const html = res.data;
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const nameEl = doc.querySelector('h1.d3-o-media-object__title');
  const positionEl = doc.querySelector('h3.d3-o-media-object__primary-subtitle');
  const numberEl = doc.querySelector('h3.d3-o-media-object__secondary-subtitle');
  const imageEl = doc.querySelector('.nfl-t-person-tile__photo img');

  const player = {
    player_name: nameEl?.textContent.trim() || 'Unknown',
    number: numberEl?.textContent.replace('#', '').trim() || null,
    position: positionEl?.textContent.trim() || null,
    group: 'Active Roster',
    image: imageEl?.src || '',
    info: parseInfo(doc),
    career: '',        // optional
    achievements: '',  // optional
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

  // Overwrite roster for test
  roster = [player];

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(roster, null, 2), 'utf-8');
  console.log('Roster updated successfully.');
}

main().catch(err => console.error(err));