// fetchTrivia.js
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Fetches a random trivia snippet for a given Steelers player.
 * Returns a string max 450 characters.
 */
export async function fetchSteelersTrivia(playerName) {
  try {
    // Convert player name to URL slug
    const slug = playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const url = `https://www.steelers.com/team/players-roster/${slug}/`;

    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const allowedSections = [
      'PRO CAREER',
      '2024',
      'PERSONAL',
      'CAREER HIGHLIGHTS (REGULAR SEASON)',
      'CAREER HIGHLIGHTS (POSTSEASON)',
      '2025 SEASON'
    ];

    const triviaLines = [];

    // Iterate over sections
    $('.player-bio-section').each((i, section) => {
      const header = $(section).find('h3').text().trim().toUpperCase();
      if (allowedSections.includes(header)) {
        // Grab bullet points or paragraphs
        $(section).find('li, p').each((j, el) => {
          const text = $(el).text().trim();
          if (text.length > 0) triviaLines.push(text);
        });
      }
    });

    if (triviaLines.length === 0) return '';

    // Pick random line(s)
    const selected = triviaLines[Math.floor(Math.random() * triviaLines.length)];

    // Limit to 450 chars
    return selected.slice(0, 450);
  } catch (err) {
    console.error(`Trivia fetch failed for ${playerName}: ${err.message}`);
    return '';
  }
}