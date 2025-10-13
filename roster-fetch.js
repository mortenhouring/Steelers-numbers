// roster-fetch.js
import fs from 'fs';
import puppeteer from 'puppeteer';

// ---------- CONFIG ----------
const TEST_PLAYER_URL = 'https://www.steelers.com/team/players-roster/dk-metcalf/';
const OUTPUT_JSON = './roster.json';

// ---------- HELPER FUNCTIONS ----------
function formatInfo(age, exp, ht, wt) {
  return `AGE ${age} | EXP ${exp} | HT/WT ${ht}/${wt}`;
}

function parseTriviaSections(doc) {
  const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
  let trivia = '';

  allowedSections.forEach((sectionTitle) => {
    const headers = [...doc.querySelectorAll('strong, span')]
      .filter(el => el.textContent.trim().toUpperCase() === sectionTitle);

    headers.forEach(sectionHeader => {
      let sectionContent = '';
      const nextUL = sectionHeader.closest('div')?.querySelector('ul');
      if (nextUL) {
        const lis = [...nextUL.querySelectorAll('li')];
        sectionContent = lis.map(li => li.textContent.trim()).join('\n');
      }
      trivia += `\n\n**${sectionTitle}**\n${sectionContent}`;
    });
  });

  return trivia.trim();
}

function parseStats(doc) {
  const statsList = [...doc.querySelectorAll('.nfl-t-stats-tile__list li')];
  if (!statsList.length) return {};

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
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const player = await page.evaluate(() => {
    // Basic info
    const nameEl = document.querySelector('h1.d3-o-media-object__title');
    const positionEl = document.querySelector('h3.d3-o-media-object__primary-subtitle');
    const numberEl = document.querySelector('h3.d3-o-media-object__secondary-subtitle');
    const imageEl = document.querySelector('img');

    // Info
    let age = '';
    let exp = '';
    let ht = '';
    let wt = '';
    [...document.querySelectorAll('p')].forEach(p => {
      const text = p.textContent.trim();
      if (text.startsWith('Age:')) age = text.replace('Age:', '').trim();
      if (text.startsWith('Experience:')) exp = text.replace('Experience:', '').trim();
      if (text.startsWith('Height:')) ht = text.replace('Height:', '').trim();
      if (text.startsWith('Weight:')) wt = text.replace('Weight:', '').trim();
    });

    // Trivia
    function parseTrivia() {
      const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
      let trivia = '';
      allowedSections.forEach(title => {
        const headers = [...document.querySelectorAll('strong, span')]
          .filter(el => el.textContent.trim().toUpperCase() === title);

        headers.forEach(h => {
          let sectionContent = '';
          const nextUL = h.closest('div')?.querySelector('ul');
          if (nextUL) {
            sectionContent = [...nextUL.querySelectorAll('li')].map(li => li.textContent.trim()).join('\n');
          }
          trivia += `\n\n**${title}**\n${sectionContent}`;
        });
      });
      return trivia.trim();
    }

    // Stats
    const statsList = [...document.querySelectorAll('.nfl-t-stats-tile__list li')];
    const stats = {};
    statsList.forEach(li => {
      const labelEl = li.querySelector('.nfl-t-stats-tile__label-full');
      const valueEl = li.querySelector('.nfl-t-stats-tile__value');
      if (labelEl && valueEl) stats[labelEl.textContent.trim()] = valueEl.textContent.trim();
    });

    return {
      player_name: nameEl?.textContent.trim() || 'Unknown',
      number: numberEl?.textContent.replace('#', '').trim() || null,
      position: positionEl?.textContent.trim() || null,
      group: 'Active Roster',
      image: imageEl?.src || '',
      info: `AGE ${age} | EXP ${exp} | HT/WT ${ht}/${wt}`,
      career: '',        // optional, can populate later
      achievements: '',  // optional
      trivia: parseTrivia(),
      stats
    };
  });

  await browser.close();
  return player;
}

async function main() {
  let roster = [];
  try {
    const data = await fs.promises.readFile(OUTPUT_JSON, 'utf-8');
    roster = JSON.parse(data);
  } catch {
    roster = [];
  }

  const player = await fetchPlayer(TEST_PLAYER_URL);

  // For test, overwrite any existing single-player entry
  roster = [player];

  await fs.promises.writeFile(OUTPUT_JSON, JSON.stringify(roster, null, 2), 'utf-8');
  console.log('Roster updated successfully.');
}

main().catch(err => console.error(err));