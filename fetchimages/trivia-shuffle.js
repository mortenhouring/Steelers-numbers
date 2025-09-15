import fs from 'fs';
import path from 'path';

/**
 * Load trivia JSON
 * Use relative path from current folder (works in GitHub Actions and locally)
 */
const triviaFile = path.join(process.cwd(), 'trivia.json');
let triviaData = {};
try {
    triviaData = JSON.parse(fs.readFileSync(triviaFile, 'utf-8'));
} catch (err) {
    console.error('Error loading trivia.json:', err);
    triviaData = {}; // continue gracefully
}

/**
 * Utility: shuffle array in-place
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Utility: check similarity based on shared words
 */
function isSimilar(existing, candidate, threshold = 0.7) {
    const existingWords = new Set(existing.toLowerCase().split(/\W+/));
    const candidateWords = new Set(candidate.toLowerCase().split(/\W+/));
    const common = [...candidateWords].filter(w => existingWords.has(w));
    return common.length / candidateWords.size >= threshold;
}

/**
 * Assign weight based on category
 */
function getCategoryWeight(category) {
    const highest = ["CAREER HIGHLIGHTS", "AWARDS"];
    const lowest = ["2024"];
    if (highest.includes(category)) return 3;
    if (lowest.includes(category)) return 1;
    return 2; // medium for all others
}

/**
 * Generate trivia paragraph with weighted categories
 * @param {string} playerId
 * @param {number} maxChars
 * @returns {Object} { paragraph: string, selectedStrings: string[] }
 */
function generateTriviaParagraph(playerId, maxChars = 450) {
    const player = triviaData[playerId];
    if (!player) {
        console.warn(`Player ID ${playerId} not found`);
        return { paragraph: '', selectedStrings: [] };
    }

    // Flatten trivia with category info and weight
    let allTrivia = [];
    for (const category in player.trivia) {
        const weight = getCategoryWeight(category);
        const strings = player.trivia[category].map(text => ({ text, category, weight }));
        allTrivia = allTrivia.concat(strings);
    }

    // Weighted shuffle: replicate each string by its weight
    allTrivia = allTrivia.flatMap(item => Array(item.weight).fill(item));
    allTrivia = shuffle(allTrivia);

    const selected = [];
    let totalChars = 0;

    for (const item of allTrivia) {
        const text = item.text;
        if (totalChars + text.length > maxChars) continue;

        // Avoid very similar strings
        if (selected.some(s => isSimilar(s, text))) continue;

        selected.push(text);
        totalChars += text.length;

        if (totalChars >= maxChars) break;
    }

    console.log(`Player ${player.player_name} - total trivia strings available: ${allTrivia.length}`);
    console.log(`Selected ${selected.length} strings, total characters: ${totalChars}`);

    return { paragraph: selected.map(s => s.text).join(' '), selectedStrings: selected.map(s => s.text) };
}

// Export function using ES module syntax
export { generateTriviaParagraph };

/**
 * Standalone test block using import.meta.url
 * Only runs if the script is executed directly: `node trivia-shuffle.js`
 */
if (import.meta.url === `file://${process.cwd()}/trivia-shuffle.js`) {
    const testPlayerId = '13977';
    const result = generateTriviaParagraph(testPlayerId);
    console.log('\nGenerated Trivia Paragraph:\n', result.paragraph);
    console.log('\nUsed Trivia Strings:\n', result.selectedStrings);
}