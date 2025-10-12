// roster-fetch.js
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

async function fetchPlayer(url) {
  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    // Basic info
    const player_name = $('h1.d3-o-media-object__title').text().trim();
    const position = $('h3.d3-o-media-object__primary-subtitle').text().trim();
    const number = parseInt($('h3.d3-o-media-object__secondary-subtitle').text().replace('#','').trim());

    // Info string: AGE, EXP, HT/WT
    const statsDiv = $('div.nfl-t-person-tile__stat-details');
    let age = statsDiv.find('p:contains("Age")').text().replace('Age:','').trim();
    let exp = statsDiv.find('p:contains("Experience")').text().replace('Experience:','').trim();
    let ht = statsDiv.find('p:contains("Height")').text().replace('Height:','').trim();
    let wt = statsDiv.find('p:contains("Weight")').text().replace('Weight:','').trim();

    const info = `AGE ${age} | EXP ${exp} | HT/WT ${ht}/${wt}`;

    // Career string (optional)
    const career = ''; // leave empty for now

    // Trivia extraction
    let trivia = '';
    $('div.nfl-c-body-part--text').each((i, el) => {
      const sectionTitle = $(el).find('p strong').text().trim();
      if(['PRO CAREER','CAREER HIGHLIGHTS','AWARDS'].includes(sectionTitle)) {
        trivia += `<p><b>${sectionTitle}</b></p>\n`;
        // Look for sibling <ul> for items
        const ul = $(el).next('div.nfl-c-body-part--text').find('ul');
        if(ul.length) {
          ul.find('li').each((i, li) => {
            trivia += `<li>${$(li).text().trim()}</li>\n`;
          });
        }
      }
    });

    // Stats extraction
    let stats = { REC: 0, YDS: 0, AVG: 0, TDS: 0 };
    const statsTile = $('div.nfl-t-stats-tile--player').first();
    if (statsTile.length) {
      statsTile.find('ul.nfl-t-stats-tile__list li').each((i, li) => {
        const label = $(li).find('span.nfl-t-stats-tile__label-full').text().trim().toUpperCase();
        const value = $(li).find('div.nfl-t-stats-tile__value').text().trim();
        if (['REC','YDS','AVG','TDS'].includes(label)) {
          stats[label] = label === 'AVG' ? parseFloat(value) : parseInt(value);
        }
      });
    }

    // Compose JSON
    const playerJson = {
      player_name,
      number,
      position,
      group: "Active Roster",
      image: `fetchimages/active/${player_name.toLowerCase().replace(/ /g,'_')}.jpg`,
      info,
      career,
      achievements: "",
      trivia,
      stats
    };

    // Save to roster.json
    fs.writeFileSync('roster.json', JSON.stringify([playerJson], null, 2));
    console.log('roster.json written successfully!');

  } catch (err) {
    console.error('Error fetching player:', err.message);
  }
}

// Test URL (replace with DK Metcalf or Freiermuth)
fetchPlayer('https://www.steelers.com/team/players-roster/dk-metcalf/');