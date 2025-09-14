import fs from 'fs';
import path from 'path';
import axios from 'axios';
import cheerio from 'cheerio';

const rosterPath = path.join('./fetchimages', 'images-rosterupdate.json');

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

function parseStats($) {
    const statsSection = $('p:contains("2025 (STEELERS)")').next('ul');
    if (!statsSection.length) return '';
    const statsItems = [];
    statsSection.find('li').each((i, el) => {
        const text = $(el).text().trim();
        if (/games/i.test(text)) statsItems.push(`Games Played: ${text.match(/\d+/)[0]}`);
        else if (/tackle/i.test(text)) statsItems.push(`Tackles: ${text.match(/\d+(\.\d+)?/)[0]}`);
        else if (/sack/i.test(text)) statsItems.push(`Sacks: ${text.match(/\d+(\.\d+)?/)[0]}`);
    });
    return statsItems.join(' - ');
}

async function fetchTrivia(player) {
    try {
        const url = player.url;
        const res = await axios.get(url);
        const $ = cheerio.load(res.data);

        // Allowed subsections
        const allowedSubsections = [
            'PRO CAREER',
            'AWARDS',
            'CAREER HIGHLIGHTS',
            'PERSONAL'
        ];

        // Collect all bullet points from allowed sections
        const bullets = [];
        $('div.nfl-c-body-part--text').each((i, el) => {
            const strong = $(el).find('p strong').text().trim();
            if (!strong) return;

            let sectionName = strong.toUpperCase();
            if (allowedSubsections.includes(sectionName)) {
                $(el).find('li').each((j, li) => {
                    bullets.push($(li).text().trim());
                });
            }
        });

        const trivia = getRandomTrivia(bullets, 450);
        const stats = parseStats($);

        return { trivia, stats };
    } catch (err) {
        console.error(`Error fetching trivia for ${player.name}:`, err.message);
        return { trivia: '', stats: '' };
    }
}

export async function enrichRosterWithTrivia(roster) {
    for (let player of roster) {
        const { trivia, stats } = await fetchTrivia(player);
        player.trivia = trivia;
        player.stats = stats;
    }
    return roster;
}

// Example usage:
// (async () => {
//     const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf-8'));
//     const updatedRoster = await enrichRosterWithTrivia(roster);
//     fs.writeFileSync(rosterPath, JSON.stringify(updatedRoster, null, 2), 'utf-8');
// })();