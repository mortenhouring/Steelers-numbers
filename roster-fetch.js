// roster-fetch.js
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { load } from 'cheerio';

// ---------- CONFIG ----------
const TEST_PLAYER_URL = 'https://www.steelers.com/team/players-roster/dk-metcalf/';
const OUTPUT_JSON = './roster.json';
const IMAGE_FOLDER = './fetchimages/images/'; // <-- corrected to what you asked

// ---------- HELPERS ----------
async function downloadImage(url, filepath) {
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, res.data);
}

function normalizeText(s = '') {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Build trivia as HTML:
 * <p><strong>SECTION</strong></p>
 * <ul> <li>...</li> </ul>
 */
function parseTriviaSections($) {
  const allowedSections = ['PRO CAREER', 'CAREER HIGHLIGHTS', 'AWARDS'];
  let html = '';

  allowedSections.forEach(sectionTitle => {
    // find element whose text contains the section title (loose match)
    const headerEl = $('strong, span').filter((i, el) => normalizeText($(el).text()).toUpperCase().includes(sectionTitle)).first();
    if (!headerEl || !headerEl.length) return;

    // Try several ways to find the <ul> that contains the items:
    let listEl = headerEl.closest('div').find('ul').first();
    if (!listEl || !listEl.length) {
      // check siblings / next ul
      listEl = headerEl.parent().nextAll('ul').first();
    }
    if (!listEl || !listEl.length) {
      // fallback: search within same section wrapper (some pages nest differently)
      listEl = headerEl.parents().find('ul').first();
    }

    if (listEl && listEl.length) {
      // preserve the list markup exactly (but trimmed)
      const items = listEl.find('li').toArray().map(li => `<li>${normalizeText($(li).text())}</li>`).join('');
      html += `<p><strong>${sectionTitle}</strong></p>\n<ul>\n${items}\n</ul>\n`;
    }
  });

  return html.trim();
}

// Info string: AGE X | EXP X | HT/WT X/Y
function parseInfo($) {
  const summary = { age: '', exp: '', ht: '', wt: '' };

  $('div.nfl-t-person-tile__stat-details p, div.nfl-t-person-tile__stat-details').each((i, el) => {
    const text = normalizeText($(el).text() || '');
    // sometimes the label is inside <strong>, sometimes not — do startsWith to be safe
    if (/^age[:\s]/i.test(text) || text.toLowerCase().startsWith('age:')) {
      summary.age = text.replace(/age[:\s]*/i, '').trim();
    }
    if (/^experience[:\s]/i.test(text) || text.toLowerCase().startsWith('experience:')) {
      summary.exp = text.replace(/experience[:\s]*/i, '').trim();
    }
    if (/^height[:\s]/i.test(text) || text.toLowerCase().startsWith('height:')) {
      summary.ht = text.replace(/height[:\s]*/i, '').trim();
    }
    if (/^weight[:\s]/i.test(text) || text.toLowerCase().startsWith('weight:')) {
      summary.wt = text.replace(/weight[:\s]*/i, '').trim();
    }
  });

  // final formatting (if a piece missing, it's left blank)
  return `AGE ${summary.age || ''} | EXP ${summary.exp || ''} | HT/WT ${summary.ht || ''}/${summary.wt || ''}`.trim();
}

function parseStats($) {
  const stats = {};
  const liList = $('.nfl-t-stats-tile__list li');
  if (!liList.length) return stats;

  liList.each((i, li) => {
    const label = normalizeText($(li).find('.nfl-t-stats-tile__label-full').text() || '');
    const value = normalizeText($(li).find('.nfl-t-stats-tile__value').text() || '');
    if (label) stats[label] = value;
  });

  return stats;
}

// parse ld+json for image contentUrl; returns remote URL or empty string
function findImageUrlFromLdJson($, playerName) {
  let imageUrl = '';
  $('script[type="application/ld+json"]').each((i, s) => {
    const txt = $(s).html();
    if (!txt) return;
    try {
      const data = JSON.parse(txt);
      // handle nested structures robustly
      const person = data?.member?.member || data?.member || data;
      if (person && person.name && person.image) {
        // sometimes image is object with contentUrl
        const candidate = person.image.contentUrl || person.image['contentUrl'] || person.image.url || person.image;
        if (candidate) {
          // optional: only accept if person.name matches playerName (loose)
          if (String(person.name).toLowerCase().includes(String(playerName).split(' ')[0].toLowerCase())) {
            imageUrl = candidate;
          } else if (!imageUrl) {
            imageUrl = candidate; // fallback if no better match
          }
        }
      }
    } catch (e) {
      // ignore JSON parse errors
    }
  });
  return imageUrl || '';
}

// ---------- MAIN ----------
async function fetchPlayer(url) {
  const res = await axios.get(url);
  const $ = load(res.data);

  const name = normalizeText($('h1.d3-o-media-object__title').first().text() || 'Unknown');
  const position = normalizeText($('h3.d3-o-media-object__primary-subtitle').first().text() || '');
  const number = normalizeText($('h3.d3-o-media-object__secondary-subtitle').first().text() || '').replace('#', '');

  // local image filename: firstname_lastname.jpg
  const nameParts = name.toLowerCase().split(/\s+/).filter(Boolean);
  const filename = nameParts.join('_') + '.jpg';
  const localImagePath = path.join(IMAGE_FOLDER, filename);

  // find remote image URL via ld+json (preferred)
  const remoteImage = findImageUrlFromLdJson($, name);

  // fallback: meta og:image or first player picture tag
  let finalImageUrl = remoteImage;
  if (!finalImageUrl) {
    const og = $('meta[property="og:image"]').attr('content');
    if (og) finalImageUrl = og;
  }
  if (!finalImageUrl) {
    const actionshot = $('figure.d3-o-media-object__figure img').first().attr('data-src') || $('figure.d3-o-media-object__figure img').first().attr('src');
    if (actionshot) finalImageUrl = actionshot;
  }

  // download the image if we have a URL
  if (finalImageUrl) {
    try {
      await downloadImage(finalImageUrl, localImagePath);
    } catch (err) {
      console.error('Image download failed:', err.message || err);
    }
  } else {
    // ensure folder exists so path is consistent even if file missing
    await fs.mkdir(IMAGE_FOLDER, { recursive: true });
  }

  const player = {
    player_name: name,
    number: number || null,
    position: position || null,
    group: 'Active Roster',
    image: localImagePath, // local reference as you requested
    info: parseInfo($),
    career: '',
    achievements: '',
    trivia: parseTriviaSections($), // HTML string
    stats: parseStats($)
  };

  return player;
}

async function main() {
  let roster = [];
  try {
    const raw = await fs.readFile(OUTPUT_JSON, 'utf-8');
    roster = JSON.parse(raw);
  } catch {
    roster = [];
  }

  const player = await fetchPlayer(TEST_PLAYER_URL);

  // For test, replace entire roster with single player entry
  roster = [player];

  await fs.writeFile(OUTPUT_JSON, JSON.stringify(roster, null, 2), 'utf-8');
  console.log('Wrote roster.json and image (if available).');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});