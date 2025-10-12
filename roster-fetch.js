// roster-fetch.js
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

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

function parseInfo(document) {
  const ageEl = document.querySelector('p strong:contains("Age")') || document.querySelector('p:contains("Age")');
  const expEl = document.querySelector('p strong:contains("Experience")') || document.querySelector('p:contains("Experience")');
  const heightEl = document.querySelector('p strong:contains("Height")') || document.querySelector('p:contains("Height")');
  const weightEl = document.querySelector('p strong:contains("Weight")') || document.querySelector('p:contains("Weight")');

  // fallback using textContent parsing if :contains doesn't work
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
  if (!statsList.length) return null;

  const stats = {};
  statsList.forEach(li => {
    const labelEl = li.querySelector('.nfl-t-stats-tile__label-full');
    const valueEl = li.querySelector('.nfl-t-stats-tile__value');
    if (labelEl && valueEl) stats[labelEl.textContent.trim()] = valueEl.textContent.trim();
  });

  return stats;
}

// ---------- MAIN ----------
async function fetchPlayer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Basic info
  const nameEl = doc.querySelector('h1.d3-o-media-object__title');
  const positionEl = doc.querySelector('h3.d3-o-media-object__primary-subtitle');
  const numberEl = doc.querySelector('h3.d3-o-media-object__secondary-subtitle');
  const imageEl = doc.querySelector('img');

  const player = {
    player_name: nameEl?.textContent.trim() || 'Unknown',
    number: numberEl?.textContent.replace('#', '').trim() || null,
    position: positionEl?.textContent.trim() || null,
    group: 'Active Roster',
    image: imageEl?.src || '',
    info: parseInfo(doc),
    career: '',        // optional, can populate later
    achievements: '',  // optional
    trivia: parseTriviaSections(doc),
    stats: parseStats(doc) || {}
  };

  return player;
}

async function main() {
  let roster = [];
  try {
    // load existing JSON if present
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