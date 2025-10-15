// roster-fetch.js
import fs from 'fs';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import path from 'path';

///////////////////////////////////
// Fetch active roster players ///
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

    // Name
    const nameEl = document.querySelector('.d3-o-media-object__title');
    const name = nameEl ? nameEl.textContent.trim() : player.name;

    // Position
    const positionEl = document.querySelector('.d3-o-media-object__primary-subtitle');
    const position = positionEl ? positionEl.textContent.trim() : 'N/A';

    // Number
    const numberEl = document.querySelector('.d3-o-media-object__secondary-subtitle');
    const numberText = numberEl ? numberEl.textContent.replace('#', '').trim() : null;
    const number = numberText ? Number(numberText) : null;

    // Info (Experience, Height, Weight, Age)
    const summaryEl = document.querySelector('.d3-o-media-object__summary');
    let info = '';
    if (summaryEl) {
      const stats = {};
      summaryEl.querySelectorAll('p').forEach(p => {
        const label = p.querySelector('strong')?.textContent.replace(':', '').trim().toLowerCase();
        const value = p.textContent.replace(p.querySelector('strong')?.textContent || '', '').trim();
        if (label && value) stats[label] = value;
      });

      const exp = stats['experience'] ? (stats['experience'].includes('0') ? 'rookie' : stats['experience'].replace('years', '').trim()) : '';
      const height = stats['height'] || '';
      const weight = stats['weight'] || '';
      const age = stats['age'] || '';

      info = `EXP: ${exp} | HT/WT: ${height}/${weight} | AGE: ${age}`;
    }

    // Trivia
    const bioSections = [...document.querySelectorAll('.nfl-c-body-part.nfl-c-body-part--text')];
    let triviaStr = '';
    for (let i = 0; i < bioSections.length; i++) {
      const section = bioSections[i];
      const headingEl = section.querySelector('p strong');
      if (!headingEl) continue;
      const heading = headingEl.textContent.trim().toUpperCase();

      let contentSection = section.nextElementSibling;
      let entries = [];

      if (contentSection) {
        const listItems = [...contentSection.querySelectorAll('li')].map(li => li.textContent.trim());
        const paragraphs = [...contentSection.querySelectorAll('p')].map(p => p.textContent.trim());
        entries = listItems.length ? listItems : paragraphs;
      }

      if (entries.length) {
        triviaStr += entries.join(' | ') + ' ';
      }
    }
    triviaStr = triviaStr.trim();

    // Achievements
    let achievementsStr = '';
    try {
      const last = name.split(' ').slice(-1)[0];
      const first = name.split(' ')[0];
      const pfrId = `${last.slice(0, 4)}${first.slice(0, 2)}00`;
      const pfrLink = `https://www.pro-football-reference.com/players/${last[0]}/${pfrId}.htm`;

      const { data: pfrHtml } = await axios.get(pfrLink);
      const domPFR = new JSDOM(pfrHtml);
      const documentPFR = domPFR.window.document;

      const awardEls = Array.from(documentPFR.querySelectorAll('#bling li a'));
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

      if (foundAwards.length) achievementsStr = foundAwards.join(' | ');
    } catch (err) {
      console.error(`Error fetching awards for ${player.name}:`, err.message);
    }

    // Image
    let imagePath = '';
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

          const dir = path.resolve('fetchimages/images');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const filePath = path.join(dir, fileName);

          const response = await axios.get(imgUrl, { responseType: 'arraybuffer', maxRedirects: 5 });
          fs.writeFileSync(filePath, response.data);
          imagePath = `fetchimages/images/${fileName}`;
        }
      } catch (err) {
        console.error(`Error fetching image for ${player.name}:`, err.message);
      }
    }

    // Build final flat player object
    return {
      player_name: name,
      number,
      position,
      group: 'ROSTER',
      image: imagePath,
      info,
      career: '',
      achievements: achievementsStr,
      trivia: triviaStr,
      stats: ''
    };

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

  // Write JSON as array of flat objects
  fs.writeFileSync('roster.json', JSON.stringify(results, null, 2));
  console.log('Roster saved to roster.json');
}

main();