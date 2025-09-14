// fetchTrivia.js
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const rosterPath = path.join('./fetchimages', 'images-rosterupdate.json');

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

// Pick random bullets without exceeding maxChars
function getRandomTrivia(bullets, maxChars) {
  const shuffled = bullets.sort(() => Math.random() - 0.5);
  let combined = '';
  for (let bullet of shuffled) {
    const plain = bullet.replace(/\s+/g, ' ').trim();
    if ((combined + ' ' + plain).trim().length <= maxChars) {
      combined += (combined ? ' ' : '') + plain;
    } else {
      break;
    }
  }
  return combined;
}

// Parse the 2025 Season stats from the player's page
function parseStats($) {
  const statsItems = [];
  // Example: "2025 SEASON" section might have a table or bullets
  $('h2, h3').each((i, el) => {
    const heading = $(el).text().toUpperCase();
    if (heading.includes('2025 SEASON')) {
      $(el).next('ul').find('li').each((j, li) => {
        const text = $(li).text().trim();
        if (/games/i.test(text)) statsItems.push(`Games Played: ${text.match(/\d+/)[0]}`);
        else if (/tackle/i.test(text)) statsItems.push(`Tackles: ${text.match(/\d+(\.\d+)?/)[0]}`);
        else if (/sack/i.test(text)) statsItems.push(`Sacks: ${text.match(/\d+(\.\d+)?/)[0]}`);
      });
    }
  });
  return statsItems.join(' - ');
}

// Fetch trivia and stats for a single player
async function fetchTriviaForPlayer(player) {
  try {
    const slug = nameToSlug(player.player_name);
    const url = `https://www.steelers.com/team/players-roster/${slug}`;
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    const bullets = [];
    // Allowed Biography subsections
    const allowedSubsections = [
      'PRO CAREER',
      'PERSONAL',
      'CAREER HIGHLIGHTS (REGULAR SEASON)',
      'CAREER HIGHLIGHTS (POSTSEASON)',
    ];

    $('h3, h4').each((i, el) => {
      const heading = $(el).text().toUpperCase().trim();
      if (allowedSubsections.includes(heading)) {
        $(el).next('ul').find('li').each((j, li) => {
          bullets.push($(li).text().trim());
        });
      }
    });

    const trivia = getRandomTrivia(bullets, 450);
    const stats = parseStats($);

    return { trivia, stats };
  } catch (err) {
    console.error(`Error fetching trivia for ${player.player_name}:`, err.message);
    return { trivia: '', stats: '' };
  }
}

// Fetch trivia for an entire roster array
export async function fetchTriviaForRoster(roster) {
  for (let player of roster) {
    const { trivia, stats } = await fetchTriviaForPlayer(player);
    player.trivia = trivia;
    player.stats = stats;
  }
  return roster;
}