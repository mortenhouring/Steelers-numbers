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
  // Try a few selectors; also attempt to find a button/link with "read more" / "show more" text
  try {
    // Prefer known class first
    const candidates = [
      ".nfl-c-biography__read-more",
      "button.nfl-c-biography__read-more",
      "button",
      "a"
    ];

    // Try to find a read-more element inside biography by XPath containing text "read more" / "show more"
    const readMoreXPath = `//section//*[translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') 
      [contains(., 'READ MORE') or contains(., 'SHOW MORE') or contains(., 'EXPAND')]]`;

    // First try smart XPath search (more likely to hit the actual control)
    const handles = await page.$x(readMoreXPath);
    if (handles && handles.length) {
      const h = handles[0];
      await h.evaluate(el => el.scrollIntoView({block: 'center'}));
      await h.click().catch(()=>{});
      await page.waitForTimeout(600);
      console.log('ℹ️ Clicked READ MORE via XPath candidate');
      return;
    }

    // Fallback: search for button inside biography that contains "read" or "show"
    const bio = await page.$('.nfl-c-biography');
    if (bio) {
      const buttonHandles = await bio.$$('button, a');
      for (const btn of buttonHandles) {
        const txt = (await (await btn.getProperty('textContent')).jsonValue() || '').toString().trim().toUpperCase();
        if (!txt) continue;
        if (txt.includes('READ') || txt.includes('SHOW') || txt.includes('EXPAND')) {
          await btn.evaluate(el => el.scrollIntoView({block: 'center'}));
          await btn.click().catch(()=>{});
          await page.waitForTimeout(600);
          console.log('ℹ️ Clicked READ MORE inside .nfl-c-biography');
          return;
        }
      }
    }
    // if none found, just continue
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

  // forward page console messages to node logs (helpful for debugging evaluate() logs)
  page.on('console', msg => {
    try {
      console.log(`[page] ${msg.text()}`);
    } catch (e) {}
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

      // try to expand hidden biography content (if applicable)
      await tryClickReadMore(page);

      // now extract subsectioned bullets robustly
      const playerTrivia = await page.evaluate(() => {
        // allowed subsections we care about (we normalize variants later)
        const allowedSubsections = [
          'PRO CAREER',
          'PERSONAL',
          'CAREER HIGHLIGHTS',
          'AWARDS',
          '2024' // match headings that include 2024
        ];

        function headingAllowed(h) {
          if (!h) return false;
          const UH = h.toUpperCase();
          for (const s of allowedSubsections) {
            if (UH.includes(s)) return true;
          }
          return false;
        }

        // Find all potential heading nodes (p strong, h3, h4)
        const headingNodes = Array.from(document.querySelectorAll('p strong, h3, h4'));

        const sections = {};

        for (const hn of headingNodes) {
          const rawHeading = (hn.textContent || '').trim();
          if (!rawHeading) continue;
          if (!headingAllowed(rawHeading)) continue;

          // Ensure the heading is inside the "Biography" area:
          let inBiography = false;
          for (let anc = hn.parentElement; anc; anc = anc.parentElement) {
            // if an ancestor explicitly has the biography class
            if (anc.classList && anc.classList.contains('nfl-c-biography')) {
              inBiography = true;
              break;
            }
            // if ancestor contains an H2 with 'Biography' text, treat it as inside biography
            const h2 = anc.querySelector && anc.querySelector('h2');
            if (h2 && (h2.textContent || '').toUpperCase().includes('BIOGRAPHY')) {
              inBiography = true;
              break;
            }
          }
          if (!inBiography) continue;

          // Normalize heading key
          let key = rawHeading.toUpperCase();
          if (key.includes('CAREER HIGHLIGHT')) key = 'CAREER HIGHLIGHTS';
          if (/\b2024\b/.test(key)) key = '2024';

          // Start collecting bullets:
          const bullets = [];

          // Case A: the heading container itself may include ULs
          const container = hn.closest('.nfl-c-body-part') || hn.parentElement;
          if (container) {
            // collect ULs inside the same container
            const innerUls = container.querySelectorAll('ul li');
            innerUls.forEach(li => {
              const t = (li.textContent || '').trim();
              if (t) bullets.push(t);
            });
          }

          // Case B: also scan next siblings until next heading or until a safe limit
          let next = (container && container.nextElementSibling) || hn.parentElement.nextElementSibling;
          let guard = 0;
          while (next && guard < 12) {
            // stop if the next block contains a heading we might treat as a new section
            const nextHeading = next.querySelector && next.querySelector('p strong, h3, h4');
            if (nextHeading && (nextHeading.textContent || '').trim()) break;

            if (next.tagName === 'UL') {
              const lis = next.querySelectorAll('li');
              lis.forEach(li => {
                const t = (li.textContent || '').trim();
                if (t) bullets.push(t);
              });
            } else {
              // if the next block contains ULs deeper inside (often the site wraps lists)
              const innerLis = next.querySelectorAll && next.querySelectorAll('ul li');
              if (innerLis && innerLis.length) {
                innerLis.forEach(li => {
                  const t = (li.textContent || '').trim();
                  if (t) bullets.push(t);
                });
              } else if (next.tagName === 'P') {
                // some subsections are paragraphs, capture those (single-line)
                const txt = (next.textContent || '').trim();
                if (txt) {
                  // small guard to avoid repeating the heading text itself
                  const UH = txt.toUpperCase();
                  if (!UH.includes((rawHeading || '').toUpperCase())) bullets.push(txt);
                }
              }
            }

            // move on
            next = next.nextElementSibling;
            guard++;
          }

          // remove duplicates & empty and trim
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

        return sections;
      });

      // Log what we found for this player (counts per section)
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

  // save to trivia.json
  fs.writeFileSync(triviaFile, JSON.stringify(triviaData, null, 2), 'utf8');
  console.log(`\nTrivia saved to ${triviaFile}`);
}

main().catch(err => {
  console.error('Fatal error in trivia scraper:', err);
  process.exit(1);
});