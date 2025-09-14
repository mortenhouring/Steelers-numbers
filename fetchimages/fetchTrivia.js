// fetchTrivia.js
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Converts player names to Steelers.com URL slug.
 * Handles special cases: periods, apostrophes, III/IV, hyphens, etc.
 */
function nameToSlug(name) {
  // Remove periods unless at end of name (like "Jr.")
  let cleanName = name.replace(/\.(?=\S)/g, '-'); // replace internal periods with -
  cleanName = cleanName.replace(/\.$/, '');       // remove trailing period
  cleanName = cleanName.replace(/['’]/g, '-');    // replace apostrophes with -
  cleanName = cleanName.replace(/\s+/g, '-');     // spaces → hyphens
  cleanName = cleanName.toLowerCase();
  cleanName = cleanName.replace(/[^a-z0-9-]/g, ''); // remove other invalid chars
  cleanName = cleanName.replace(/-+/g, '-');     // collapse multiple hyphens
  return cleanName;
}

/**
 * Fetches a random trivia snippet for a given Steelers player.
 * Returns a string max 450 characters, truncated at last full word.
 */
export async function fetchSteelersTrivia(playerName) {
  const slug = nameToSlug(playerName);
  const url = `https://www.steelers.com/team/players-roster/${slug}/`;

  const allowedSections = [
    'PRO CAREER',
    '2024',
    'PERSONAL',
    'CAREER HIGHLIGHTS (REGULAR SEASON)',
    'CAREER HIGHLIGHTS (POSTSEASON)',
    '2025 SEASON'
  ];

  const MAX_CHARS = 450;
  const MAX_RETRIES = 3;

  let response = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Fetching trivia for ${playerName}, attempt ${attempt}...`);
      response = await axios.get(url);
      break; // success
    } catch (err) {
      console.warn(`Attempt ${attempt} failed for ${playerName}: ${err.message}`);
      if (attempt === MAX_RETRIES) {
        console.error(`Trivia fetch failed for ${playerName} after ${MAX_RETRIES} attempts`);
        return '';
      }
      await new Promise(res => setTimeout(res, 1000));
    }
  }

  const $ = cheerio.load(response.data);
  const triviaLines = [];

  $('.player-bio-section').each((i, section) => {
    const header = $(section).find('h3').first().text().trim().toUpperCase();

    if (header === 'BIOGRAPHY') {
      // iterate sub-sections
      $(section).find('.player-bio-subsection').each((j, sub) => {
        const subHeader = $(sub).find('h4').text().trim().toUpperCase();
        if (allowedSections.includes(subHeader)) {
          $(sub).find('li, p').each((k, el) => {
            const text = $(el).text().trim();
            if (text.length > 0) triviaLines.push(text);
          });
        }
      });
    } else if (allowedSections.includes(header)) {
      // top-level sections like "2025 SEASON"
      $(section).find('li, p').each((j, el) => {
        const text = $(el).text().trim();
        if (text.length > 0) triviaLines.push(text);
      });
    }
  });

  if (triviaLines.length === 0) {
    console.log(`No trivia found for ${playerName}`);
    return '';
  }

  // Pick one random line
  let selected = triviaLines[Math.floor(Math.random() * triviaLines.length)];

  // Truncate at last full word under MAX_CHARS
  if (selected.length > MAX_CHARS) {
    selected = selected.slice(0, MAX_CHARS);
    const lastSpace = selected.lastIndexOf(' ');
    if (lastSpace > 0) selected = selected.slice(0, lastSpace);
  }

  console.log(`Trivia for ${playerName}: ${selected}`);
  return selected;
}