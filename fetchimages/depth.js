import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import fs from 'fs';

const positions = {
  LT: { text: 'Left tackle', max: 1 },
  LG: { text: 'Left guard', max: 1 },
  C: { text: 'Center', max: 1 },
  RG: { text: 'Right guard', max: 1 },
  RT: { text: 'Right tackle', max: 1 },
  TE: { text: 'Tight end', max: 3 },
  RB: { text: 'Running Back', max: 3 },
  FB: null,
  QB: { text: 'Quarterback', max: 1 },
  WR: { text: 'Wide receiver', max: 99 },
  DT: { text: 'Defensive tackle', max: 1 },
  NT: { text: 'Nose tackle', max: 1 },
  DE: { text: 'Defensive end', max: 2 },
  LOLB: { text: 'Left outside linebacker', max: 2 },
  LILB: { text: 'Left inside linebacker', max: 1 },
  RILB: { text: 'Right inside linebacker', max: 1 },
  ROLB: { text: 'Right outside linebacker', max: 2 },
  LCB: { text: 'Cornerback', max: 99 },
  FS: { text: 'Free safety', max: 1 },
  SS: { text: 'Strong safety', max: 2 },
  RCB: { text: 'Cornerback', max: 2 },
  NB: { text: 'Cornerback', max: 1 },
  K: { text: 'Kicker', max: 1 },
  P: { text: 'Punter', max: 1 },
  LS: null,
  KR: { text: 'Kick returner', max: 2 },
  PR: { text: 'Punt returner', max: 2 }
};

// Retry helper
async function fetchWithRetry(url, retries = 3, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      console.error(`Fetch attempt ${i+1} failed: ${err.message}`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
      else throw err;
    }
  }
}

async function scrapeDepth() {
  const url = 'https://www.steelers.com/team/depth-chart/';
  console.log(`Fetching depth chart from ${url}...`);

  const html = await fetchWithRetry(url);
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const depthTables = ['scroll-offense','scroll-defense','scroll-specialteams'];
  const depthData = [];

  for (const tableId of depthTables) {
    const table = document.querySelector(`#${tableId} table`);
    if (!table) {
      console.warn(`Table with ID ${tableId} not found!`);
      continue;
    }

    console.log(`Parsing table: ${tableId}`);
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach(row => {
      const tds = row.querySelectorAll('td');
      const posId = tds[0]?.textContent.trim();
      const mapping = positions[posId];
      if (!mapping) {
        if (posId) console.log(`Skipping position ${posId}`);
        return;
      }

      const maxPlayers = mapping.max;
      const posText = mapping.text;
      let playerCount = 0;

      for (let i = 1; i < tds.length; i++) {
        const links = tds[i].querySelectorAll('a');
        links.forEach(link => {
          if (playerCount >= maxPlayers) return;
          const playerName = link.textContent.trim();
          let depthString = `${playerCount+1} ${posText}`;
          if (playerCount === 1) depthString = `2 2nd ${posText}`;
          if (playerCount === 2) depthString = `3 3rd ${posText}`;
          depthData.push({ depth_name: playerName, depth_pos: depthString });
          console.log(`Added: ${playerName} - ${depthString}`);
          playerCount++;
        });
      }

      if (playerCount === 0) console.log(`No players found for position ${posId}`);
    });
  }

  fs.writeFileSync('fetchimages/depth.json', JSON.stringify(depthData, null, 2));
  console.log(`Depth chart saved to fetchimages/depth.json (${depthData.length} entries)`);
}

scrapeDepth().catch(err => {
  console.error('Failed to scrape depth chart:', err);
  process.exit(1);
});