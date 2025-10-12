// /fetchimages/trivia.js
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const rosterUrl = "https://raw.githubusercontent.com/mortenhouring/Steelers-numbers/main/fetchimages/images-rosterupdate.json";
const triviaFile = path.join('.', 'trivia.json');

// Converts player names to Steelers.com URL slug
function nameToSlug(name) {
  let cleanName = name.replace(/\.(?=\S)/g, '-'); // replace internal periods with -
  cleanName = cleanName.replace(/\.$/, '');       // remove trailing period
  cleanName = cleanName.replace(/['’]/g, '-');    // replace apostrophes with -
  cleanName = cleanName.replace(/\s+/g, '-');     // spaces → hyphens
  cleanName = cleanName.toLowerCase();
  cleanName = cleanName.replace(/[^a-z0-9-]/g, ''); // remove other invalid chars
  cleanName = cleanName.replace(/-+/g, '-');     // collapse multiple hyphens
  return cleanName;
}

async function fetchRosterData() {
  try {
    const res = await fetch(rosterUrl);
    if (!res.ok) throw new Error(`Roster fetch failed: ${res.status}`);
    const data = await res.json();
    console.log('✅ Successfully fetched roster JSON');
    console.log('Sample keys from JSON:', Object.keys(data[0] || {}));
    return data;
  } catch (err) {
    console.error('❌ Error fetching/parsing roster JSON:', err.message);
    return [];
  }
}

// read existing trivia (if present)
function loadExistingTrivia() {
  if (!fs.existsSync(triviaFile)) return {};
  const raw = fs.readFileSync(triviaFile, 'utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ Existing trivia.json invalid JSON, starting fresh');
    return {};
  }
}

async function tryClickReadMore(page) {
  try {
    const ctaHandle = await page.$('.d3-o-section__cta a[role="button"]');
    if (ctaHandle) {
      await ctaHandle.evaluate(el => el.scrollIntoView({ block: 'center' }));
      await ctaHandle.click().catch(() => {});
      await page.waitForSelector('.nfl-c-biography', { visible: true, timeout: 3000 }).catch(()=>{});
      console.log('ℹ️ Clicked READ MORE via .d3-o-section__cta');
      return;
    }

    const readMoreXPath = `//section//*[translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') 
      [contains(., 'READ MORE') or contains(., 'SHOW MORE') or contains(., 'EXPAND')]]`;

    const handles = await page.$x(readMoreXPath);
    if (handles && handles.length) {
      const h = handles[0];
      await h.evaluate(el => el.scrollIntoView({block: 'center'}));
      await h.click().catch(()=>{});
      await page.waitForSelector('.nfl-c-biography', { visible: true, timeout: 3000 }).catch(()=>{});
      console.log('ℹ️ Clicked READ MORE via XPath candidate');
      return;
    }

    const bio = await page.$('.nfl-c-biography');
    if (bio) {
      const buttonHandles = await bio.$$('button, a');
      for (const btn of buttonHandles) {
        const txt = (await (await btn.getProperty('textContent')).jsonValue() || '').toString().trim().toUpperCase();
        if (!txt) continue;
        if (txt.includes('READ') || txt.includes('SHOW') || txt.includes('EXPAND')) {
          await btn.evaluate(el => el.scrollIntoView({block: 'center'}));
          await btn.click().catch(()=>{});
          await page.waitForSelector('.nfl-c-biography', { visible: true, timeout: 3000 }).catch(()=>{});
          console.log('ℹ️ Clicked READ MORE inside .nfl-c-biography');
          return;
        }
      }
    }
    console.log('ℹ️ No READ MORE button detected (ok to continue)');
  } catch (err) {
    console.warn('⚠️ Error while trying to click READ MORE:', err.message);
  }
}

async function main() {
  const roster = await fetchRosterData();
  if (!Array.isArray(roster) || roster.length === 0) {
    console.error('❌ No roster data — aborting.');
    return;
  }

  const triviaData = loadExistingTrivia();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    try { console.log(`[page] ${msg.text()}`); } catch (e) {}
  });

  for (const player of roster) {
    try {
      if (triviaData[player.player_id]) {
        console.log(`Skipping ${player.player_name} (${player.player_id}) — already present`);
        continue;
      }

      const slug = nameToSlug(player.player_name);
      const url = `https://www.steelers.com/team/players-roster/${slug}`;
      console.log(`\n➡️ Fetching trivia for ${player.player_name} — ${url}`);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      await tryClickReadMore(page);

      const playerTrivia = await page.evaluate(() => {
  const allowedSubsections = ['PRO CAREER', 'PERSONAL', 'CAREER HIGHLIGHTS', 'AWARDS'];
  const ignoreSubsections = ['TRANSACTIONS', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015', '2014', '2013', '2012', '2011'];

  const sections = {};
  const paragraphs = Array.from(document.querySelectorAll('.nfl-c-biography .nfl-c-body-part--text'));

  let currentSection = 'BIOGRAPHY';
  let currentHTML = [];

  const flush = () => {
    if (currentHTML.length) {
      sections[currentSection] = currentHTML.join('\n').trim();
      currentHTML = [];
    }
  };

  for (const el of paragraphs) {
    const strong = el.querySelector('strong');
    const header = strong ? strong.textContent.trim().toUpperCase() : '';

    if (allowedSubsections.includes(header)) {
      flush();
      currentSection = header;
      continue;
    }

    if (ignoreSubsections.includes(header)) {
      flush();
      currentSection = 'IGNORE';
      continue;
    }

    if (currentSection === 'IGNORE') continue;

    // collect inner HTML of <p> and <ul> to preserve formatting
    const contentHTML = Array.from(el.children)
      .filter(c => c.tagName === 'P' || c.tagName === 'UL')
      .map(c => c.outerHTML)
      .join('\n');

    if (contentHTML) currentHTML.push(contentHTML);
  }

  flush();

  // fallback if nothing found
  if (Object.keys(sections).length === 0 || !sections["BIOGRAPHY"]) {
    const paras = Array.from(document.querySelectorAll('.nfl-c-biography .nfl-c-body-part--text p'));
    const htmls = paras.map(p => p.outerHTML).filter(Boolean);
    if (htmls.length) sections["BIOGRAPHY"] = htmls.join('\n');
  }

  if (Object.keys(sections).length === 0) return '';

  // combine all sections into one string
  const combinedHTML = Object.entries(sections)
    .map(([heading, html]) => `<strong>${heading}</strong>\n${html}`)
    .join('\n\n');

  return combinedHTML;
});

      const keys = Object.keys(playerTrivia || {});
      if (keys.length === 0) {
        console.log(`⚠️ No biography headings found for ${player.player_name}`);
      } else {
        console.log(`✅ Found sections for ${player.player_name}: ${keys.map(k => `${k} (${playerTrivia[k].length})`).join(', ')}`);
      }

      triviaData[player.player_id] = {
        player_name: player.player_name,
        player_url: url,
        player_id: player.player_id,
        trivia: playerTrivia
      };

    } catch (err) {
      console.error(`Failed to fetch trivia for ${player.player_name} (${player.player_id}):`, err.message);
    }
  }

  await browser.close();
  fs.writeFileSync(triviaFile, JSON.stringify(triviaData, null, 2), 'utf8');
  console.log(`\nTrivia saved to ${triviaFile}`);
}

main().catch(err => {
  console.error('Fatal error in trivia scraper:', err);
  process.exit(1);
});