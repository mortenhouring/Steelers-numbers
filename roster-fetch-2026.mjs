import axios from 'axios';
import { JSDOM } from 'jsdom';
import fs from 'fs/promises';
import path from 'path';

const TEAM_ABBR = 'pit';
const TEAM_SLUG = 'pittsburgh-steelers';
const ROSTER_URL = `https://www.espn.com/nfl/team/roster/_/name/${TEAM_ABBR}/${TEAM_SLUG}`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36';

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function fetchHtml(url) {
  const res = await axios.get(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.google.com/'
    },
    timeout: 30000
  });
  return res.data;
}

// Try to extract inline JS-initialized JSON blobs from the raw HTML
function extractInlineState(html) {
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;/i,
    /window\[['"]__INITIAL_STATE__['"]\]\s*=\s*(\{[\s\S]*?\})\s*;/i,
    /window\.__DATA__\s*=\s*(\{[\s\S]*?\})\s*;/i,
    /window\.__CONFIG__\s*=\s*(\{[\s\S]*?\})\s*;/i,
    /__dataLayer\s*=\s*(\{[\s\S]*?\})\s*;/i,
    /var\s+espnBootData\s*=\s*(\{[\s\S]*?\})\s*;/i
  ];

  for (const re of patterns) {
    const m = re.exec(html);
    if (m && m[1]) {
      try {
        return JSON.parse(m[1]);
      } catch (e) {
        // Could be JS object literal not strict JSON; return raw string for inspection
        return m[1];
      }
    }
  }
  return null;
}

async function downloadImage(url, destPath) {
  if (!url) return false;
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': USER_AGENT }, timeout: 30000 });
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, res.data);
    return true;
  } catch (err) {
    console.warn(`Failed to download image ${url}: ${err.message}`);
    return false;
  }
}

function chooseExtFromUrl(url) {
  try {
    const parsed = new URL(url);
    const ext = path.extname(parsed.pathname).split('?')[0];
    if (ext) return ext.split('.').pop();
  } catch (e) {}
  return 'jpg';
}

async function parseRosterPage(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const tables = Array.from(doc.querySelectorAll('table'));
  console.log(`parseRosterPage: tables=${tables.length}`);

  // Try to find table with headers including No and Name and Pos
  for (const table of tables) {
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim().toLowerCase());
    if (!headers.length) continue;
    const hasNo = headers.some(h => /no\.?/.test(h));
    const hasName = headers.some(h => /name/.test(h));
    const hasPos = headers.some(h => /pos/.test(h));
    if (hasNo && hasName && hasPos) {
      const nameIdx = headers.findIndex(h => /name/.test(h));
      const noIdx = headers.findIndex(h => /no\.?/.test(h));
      const posIdx = headers.findIndex(h => /pos/.test(h));
      const htIdx = headers.findIndex(h => /ht/.test(h));
      const wtIdx = headers.findIndex(h => /wt/.test(h));
      const ageIdx = headers.findIndex(h => /age/.test(h));

      const players = [];
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      for (const tr of rows) {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (!tds.length) continue;
        const nameCell = tds[nameIdx];
        if (!nameCell) continue;
        const anchor = nameCell.querySelector('a');
        const player_name = anchor ? anchor.textContent.trim() : nameCell.textContent.trim();
        if (!player_name) continue;
        const href = anchor ? anchor.getAttribute('href') : null;
        const espnProfileUrl = href ? (href.startsWith('http') ? href : `https://www.espn.com${href}`) : null;
        const numberText = (tds[noIdx] && tds[noIdx].textContent.trim()) || '';
        const number = Number(numberText.replace('#', '').trim()) || null;
        const position = (tds[posIdx] && tds[posIdx].textContent.trim()) || '';
        const ht = (htIdx >= 0 && tds[htIdx]) ? tds[htIdx].textContent.trim() : '';
        const wt = (wtIdx >= 0 && tds[wtIdx]) ? tds[wtIdx].textContent.trim() : '';
        const age = (ageIdx >= 0 && tds[ageIdx]) ? tds[ageIdx].textContent.trim() : '';

        const infoParts = [];
        if (ht) infoParts.push(`HT: ${ht}`);
        if (wt) infoParts.push(`WT: ${wt}`);
        if (age) infoParts.push(`AGE: ${age}`);
        const info = infoParts.join(' | ');

        players.push({ player_name, number, position, espnProfileUrl, info, stats: [], achievements: [], trivia: { pro_career: [], career_highlights_regular: [], career_highlights_post: [] } });
      }
      if (players.length) {
        console.log(`parseRosterPage: found ${players.length} players via table`);
        return players;
      }
    }
  }

  // Anchor-based fallback
  const anchors = Array.from(doc.querySelectorAll('a'));
  console.log(`parseRosterPage: anchors=${anchors.length}`);
  const playerAnchors = anchors.filter(a => {
    const href = a.getAttribute('href') || '';
    return /player\//.test(href) && a.textContent && a.textContent.trim().length > 1;
  });
  const unique = new Map();
  for (const a of playerAnchors) {
    const name = a.textContent.trim();
    const href = a.getAttribute('href') || '';
    const url = href.startsWith('http') ? href : `https://www.espn.com${href}`;
    if (!unique.has(name)) unique.set(name, { player_name: name, number: null, position: '', espnProfileUrl: url, info: '', stats: [], achievements: [], trivia: { pro_career: [], career_highlights_regular: [], career_highlights_post: [] } });
  }
  if (unique.size) {
    console.log(`parseRosterPage: found ${unique.size} players via anchors`);
    return Array.from(unique.values());
  }

  // Embedded JSON fallback (scan raw HTML)
  const jsonRegex = /"name":"([^"]+)"[\s\S]*?"headshot":"([^"]+)"/g;
  const jsonMatches = [];
  let m;
  while ((m = jsonRegex.exec(html)) !== null) {
    const name = m[1].trim();
    let headshot = m[2].trim();
    if (headshot && headshot.startsWith('//')) headshot = 'https:' + headshot;
    else if (headshot && !headshot.startsWith('http')) headshot = 'https:' + headshot;
    jsonMatches.push({ player_name: name, number: null, position: '', espnProfileUrl: null, info: '', stats: [], achievements: [], trivia: { pro_career: [], career_highlights_regular: [], career_highlights_post: [] }, _headshotUrl: headshot });
  }
  if (jsonMatches.length) {
    console.log(`parseRosterPage: fallback found ${jsonMatches.length} players in embedded JSON`);
    return jsonMatches;
  }

  console.log('parseRosterPage: no players found');
  return [];
}

async function fetchProfileImageUrl(profileUrl) {
  try {
    const html = await fetchHtml(profileUrl);
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const ld = doc.querySelector('script[type="application/ld+json"]');
    if (ld) {
      try {
        const json = JSON.parse(ld.textContent);
        if (json && json.image) {
          if (typeof json.image === 'string') return json.image;
          if (Array.isArray(json.image) && json.image.length) return json.image[0];
          if (json.image && json.image['@type'] === 'ImageObject' && json.image.url) return json.image.url;
        }
      } catch (e) {
        // ignore
      }
    }

    // Fallback: look for img in page
    const img = doc.querySelector('img[src*="/headshots/"]') || doc.querySelector('img');
    if (img) {
      const src = img.getAttribute('data-src') || img.getAttribute('src') || img.getAttribute('data-original');
      if (src) return src.startsWith('http') ? src : `https:${src}`;
    }
    return null;
  } catch (err) {
    console.warn(`Profile fetch failed ${profileUrl}: ${err.message}`);
    return null;
  }
}

async function buildRoster() {
  console.log(`Fetching ESPN roster: ${ROSTER_URL}`);
  const html = await fetchHtml(ROSTER_URL);

  // Save the raw roster HTML for debugging
  try {
    await fs.mkdir('fetch-debug', { recursive: true });
    await fs.writeFile('fetch-debug/espn-roster.html', html);
    console.log('Saved fetch-debug/espn-roster.html');
  } catch (e) {
    console.warn('Failed to save debug HTML:', e.message);
  }

  // Try to extract inline initial-state if present and save it for inspection
  try {
    const state = extractInlineState(html);
    if (state) {
      const data = typeof state === 'string' ? state : JSON.stringify(state, null, 2);
      await fs.writeFile('fetch-debug/initial-state.raw.txt', data);
      console.log('Saved fetch-debug/initial-state.raw.txt');
    } else {
      console.log('No inline initial-state JSON found in roster HTML');
    }
  } catch (e) {
    console.warn('Failed to extract/save inline state:', e.message);
  }

  const players = await parseRosterPage(html);
  console.log(`Found ${players.length} players on ESPN roster`);

  const out = [];
  for (const p of players) {
    const name = p.player_name;
    const slug = slugify(name);
    const ext = 'png';
    const fileName = `${slug}.${ext}`;
    const espnFile = `fetchimages/images/espn-images/${fileName}`;
    const filePath = `fetchimages/images/${fileName}`;
    const lazyFile = `fetchimages/images/lazy-images/${slug}_lazy.${ext}`;

    // Try to fetch profile image (prefer embedded headshot if present)
    let imageUrl = null;
    if (p._headshotUrl) {
      imageUrl = p._headshotUrl;
      console.log(`Using embedded headshot for ${p.player_name}: ${imageUrl}`);
    } else if (p.espnProfileUrl) {
      imageUrl = await fetchProfileImageUrl(p.espnProfileUrl);
    }

    // If imageUrl absent, try common ESPN headshot pattern (skip)
    if (!imageUrl && p.espnProfileUrl) {
      // try to construct from player id in url
      // not guaranteed; skip
    }

    if (imageUrl) {
      const imageExt = chooseExtFromUrl(imageUrl);
      const targetExt = imageExt || ext;
      const finalFileName = `${slug}.${targetExt}`;
      const finalFilePath = `fetchimages/images/${finalFileName}`;
      const finalEspnPath = `fetchimages/images/espn-images/${finalFileName}`;
      const finalLazyPath = `fetchimages/images/lazy-images/${slug}_lazy.${targetExt}`;

      const downloaded = await downloadImage(imageUrl, finalFilePath);
      if (downloaded) {
        // copy to espn and lazy paths if different
        try {
          await fs.mkdir(path.dirname(finalEspnPath), { recursive: true });
          await fs.copyFile(finalFilePath, finalEspnPath);
          await fs.mkdir(path.dirname(finalLazyPath), { recursive: true });
          await fs.copyFile(finalFilePath, finalLazyPath);
        } catch (e) {
          // ignore
        }
      }

      out.push({
        player_name: name,
        number: p.number,
        position: p.position,
        image: finalFilePath,
        'espn-image': finalEspnPath,
        lazyimage: finalLazyPath,
        info: p.info || '',
        stats: p.stats || [],
        achievements: p.achievements || [],
        trivia: p.trivia || {}
      });
    } else {
      // No image available — still include record with null image fields
      out.push({
        player_name: name,
        number: p.number,
        position: p.position,
        image: filePath,
        'espn-image': espnFile,
        lazyimage: lazyFile,
        info: p.info || '',
        stats: p.stats || [],
        achievements: p.achievements || [],
        trivia: p.trivia || {}
      });
    }
  }

  return out;
}

async function main() {
  try {
    const roster = await buildRoster();
    await fs.writeFile('roster.json', JSON.stringify(roster, null, 2));
    console.log(`Wrote roster.json with ${roster.length} players`);
  } catch (err) {
    console.error('Failed to build roster:', err);
    process.exitCode = 1;
  }
}

// ESM-friendly execution check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => { console.error(err); process.exitCode = 1; });
}
