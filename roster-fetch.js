// roster-fetch.js
import fs from 'fs/promises';
import axios from 'axios';
import { JSDOM } from 'jsdom';

// ---------- CONFIG ----------
const TEST_PLAYER_URL = 'https://www.steelers.com/team/players-roster/dk-metcalf/';
const OUTPUT_JSON = './roster.json';

// ---------- HELPERS ----------
function normalizeText(text) {
  return text?.replace(/\s+/g, ' ').trim() || '';
}

function parseInfo(document) {
  const summary = [...document.querySelectorAll('p')].reduce((acc, p) => {
    const txt = normalizeText(p.textContent);
    if (txt.toLowerCase().startsWith('age:')) acc.age = txt.split(':')[1].trim();
    if (txt.toLowerCase().startsWith('experience:')) acc.exp = txt.split(':')[1].trim();
    if (txt.toLowerCase().startsWith('height:')) acc.ht = txt.split(':')[1].trim();
    if (txt.toLowerCase().startsWith('weight:')) acc.wt = txt.split(':')[1].trim();
    return acc;
  }, { age: '', exp: '', ht: '', wt: '' });

  return `AGE ${summary.age} | EXP ${summary.exp} | HT/WT ${summary.ht}/${summary.wt}`;
}

function parseTriviaSections(document) {
  const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
  let trivia = '';

  allowedSections.forEach(sectionTitle => {
    const sectionHeader = [...document.querySelectorAll('strong, span')]
      .find(el => normalizeText(el.textContent).toUpperCase().includes(sectionTitle));

    if (sectionHeader) {
      // look for first <ul> after header in parent nodes
      let nextUL = sectionHeader.parentElement?.querySelector('ul') ||
                   sectionHeader.closest('div')?.querySelector('ul');

      if (nextUL) {
        const lis = [...nextUL.querySelectorAll('li')];
        const sectionContent = lis.map(li => normalizeText(li.textContent)).join('\n');
        trivia += `\n\n**${sectionTitle}**\n${sectionContent}`;
      }
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
    if (labelEl && valueEl) stats[normalizeText(labelEl.textContent)] = normalizeText(valueEl.textContent);
  });

  return stats;
}

function parseImage(document) {
  // Attempt to find image from ld+json
  const ldJsonScript = document.querySelector('script[type="application/ld+json"]');
  if (!ldJsonScript) return '';

  try {
    const data = JSON.parse(ldJsonScript.textContent);
    const person = data.member?.member;
    if (person?.image?.contentUrl) {
      // Map to local path
      const name = normalizeText(person.name).toLowerCase().replace(/ /g, '_');
      return `fetchimages/active/${name}.jpg`;
    }
  } catch {
    return '';
  }

  return '';
}

// ---------- MAIN ----------
async function fetchPlayer(url) {
  const res = await axios.get(url);
  const dom = new JSDOM(res.data);
  const doc = dom.window.document;

  const nameEl = doc.querySelector('h1.d3-o-media-object__title');
  const positionEl = doc.querySelector('h3.d3-o-media-object__primary-subtitle');
  const numberEl = doc.querySelector('h3.d3-o-media-object__secondary-subtitle');

  const player = {
    player_name: normalizeText(nameEl?.textContent) || 'Unknown',
    number: numberEl ? numberEl.textContent.replace('#','').trim() : null,
    position: normalizeText(positionEl?.textContent) || null,
    group: 'Active Roster',
    image: parseImage(doc),
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

  // Overwrite test roster with single player
  roster = [player];

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(roster, null, 2), 'utf-8');
  console.log('Roster updated successfully.');
}

main().catch(err => console.error(err));