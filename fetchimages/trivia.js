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
        const allowedSubsections = [
          'PRO CAREER',
          'PERSONAL',
          'CAREER HIGHLIGHTS',
          'AWARDS'
        ];

        const ignoredSubsections = [
          'COLLEGE',
          'COLLEGE CAREER'
        ];

        function headingAllowed(h) {
          if (!h) return false;
          const UH = h.toUpperCase();
          for (const skip of ignoredSubsections) {
            if (UH.includes(skip)) return false;
          }
          for (const s of allowedSubsections) {
            if (UH.includes(s)) return true;
          }
          return false;
        }

        const headingNodes = Array.from(document.querySelectorAll('p strong, h3, h4'));
        const sections = {};

        for (const hn of headingNodes) {
          const rawHeading = (hn.textContent || '').trim();
          if (!rawHeading) continue;
          if (/^\d{4}\s*\(/.test(rawHeading)) continue;
          if (!headingAllowed(rawHeading)) continue;

          let inBiography = false;
          for (let anc = hn.parentElement; anc; anc = anc.parentElement) {
            if (anc.classList && anc.classList.contains('nfl-c-biography')) {
              inBiography = true;
              break;
            }
            const h2 = anc.querySelector && anc.querySelector('h2');
            if (h2 && (h2.textContent || '').toUpperCase().includes('BIOGRAPHY')) {
              inBiography = true;
              break;
            }
          }
          if (!inBiography) continue;

          let key = rawHeading.toUpperCase();
          if (key.includes('CAREER HIGHLIGHT')) key = 'CAREER HIGHLIGHTS';
          if (/\b2024\b/.test(key)) key = '2024';

          const bullets = [];
          const container = hn.closest('.nfl-c-body-part') || hn.parentElement;
          if (container) {
            const innerUls = container.querySelectorAll('ul li');
            innerUls.forEach(li => {
              const t = (li.textContent || '').trim();
              if (/^\d{4}\s*\(/.test(t)) return;
              if (t) bullets.push(t);
            });
          }

          let next = (container && container.nextElementSibling) || hn.parentElement.nextElementSibling;
          let guard = 0;
          while (next && guard < 12) {
            const nextHeading = next.querySelector && next.querySelector('p strong, h3, h4');
            if (nextHeading && (nextHeading.textContent || '').trim()) break;

            if (next.tagName === 'UL') {
              const lis = next.querySelectorAll('li');
              lis.forEach(li => {
                const t = (li.textContent || '').trim();
                if (/^\d{4}\s*\(/.test(t)) return;
                if (t) bullets.push(t);
              });
            } else {
              const innerLis = next.querySelectorAll && next.querySelectorAll('ul li');
              if (innerLis && innerLis.length) {
                innerLis.forEach(li => {
                  const t = (li.textContent || '').trim();
                  if (/^\d{4}\s*\(/.test(t)) return;
                  if (t) bullets.push(t);
                });
              } else if (next.tagName === 'P') {
                const txt = (next.textContent || '').trim();
                if (txt && !/^\d{4}\s*\(/.test(txt)) {
                  const UH = txt.toUpperCase();
                  if (!UH.includes((rawHeading || '').toUpperCase())) bullets.push(txt);
                }
              }
            }
            next = next.nextElementSibling;
            guard++;
          }

          const unique = [];
          bullets.forEach(b => {
            const clean = (b || '').replace(/\s+/g, ' ').trim();
            if (!clean) return;
            if (!unique.includes(clean)) unique.push(clean);
          });

          if (unique.length) {
            sections[key] = (sections[key] || []).concat(unique);
          }
        }

        // ✅ Fixed: fallback only if no sections at all
        if (Object.keys(sections).length === 0) {
          const paras = Array.from(document.querySelectorAll('.nfl-c-biography .nfl-c-body-part--text p'));
          const texts = paras.map(p => (p.textContent || '').trim()).filter(Boolean);
          if (texts.length) sections["BIOGRAPHY"] = texts;
        }

        return sections;
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