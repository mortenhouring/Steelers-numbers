// main-trivia-shuffle.js
// Browser-ready ES module for Trivia shuffling
// Usage: import { loadTrivia, generateTriviaParagraph } from './main-trivia-shuffle.js';

let triviaData = {};
const MAX_CHAR_DEFAULT = 350;
const STOPWORDS = new Set([
  'the','a','an','and','or','in','on','of','for','to','has','have','had','is','are','with','at','by','from','over',
  'as','his','her','he','she','they','them','their','that','this','which','was','were','it','its','but','be','been',
  'who','whom','will','would','can','could','did','do','does','i','you','we','us','our'
]);

/* ---------- Helpers ---------- */
export async function loadTrivia(path = 'fetchimages/trivia.json') {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load trivia.json from ${path}`);
    triviaData = await response.json();
    console.log('[trivia-shuffle] Loaded trivia for', Object.keys(triviaData).length, 'players');
  } catch (err) {
    console.error('[trivia-shuffle] Error loading trivia:', err);
    triviaData = {};
  }
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function filterStatHeavyTrivia(triviaList) {
  return triviaList.filter(line => {
    // Too many numbers (e.g. tackles, sacks, field goals, etc.)
    const numberCount = (line.match(/\d+/g) || []).length;
    if (numberCount >= 5) return false;

    // Looks like a pure stat list (lots of commas, short phrases)
    const commaCount = (line.match(/,/g) || []).length;
    if (commaCount >= 5) return false;

    // Reject lines that start with "Registered", "Has registered", "Converted", "Has made"
    if (/^(Registered|Has registered|Converted|Has made)/i.test(line.trim())) return false;

    return true; // keep everything else
  });
}

function wordsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const cleaned = text.toLowerCase().replace(/[^a-z0-9.\-']/g, ' ');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts.filter(w => !STOPWORDS.has(w) && w.length >= 2);
}

function isSimilarAgainst(existingText, candidateText, threshold = 0.6) {
  const eWords = new Set(wordsFromText(existingText));
  const cWords = wordsFromText(candidateText);
  if (cWords.length === 0) return false;
  let common = 0;
  for (const w of new Set(cWords)) {
    if (eWords.has(w)) common++;
  }
  return (common / new Set(cWords).size) >= threshold;
}

function getCategoryWeight(category) {
  if (!category || typeof category !== 'string') return 2;
  const upper = category.toUpperCase().trim();
  const highest = new Set(['CAREER HIGHLIGHTS', 'AWARDS']);
  const lowest = new Set(['2024']);
  if (highest.has(upper)) return 3;
  if (lowest.has(upper)) return 1;
  return 2;
}

function buildParagraph(selected) {
  const cleaned = selected.map(s => s.trim().replace(/\.+$/, '')).filter(Boolean);
  if (!cleaned.length) return '';
  return cleaned.join('. ') + '.';
}

/* ---------- Core ---------- */
export function generateTriviaParagraph(playerId, options = {}) {
  const maxChars = Number(options.maxChars ?? MAX_CHAR_DEFAULT);
  const startThreshold = Number(options.similarityThreshold ?? 0.6);
  const key = String(playerId).trim();
  const player = triviaData[key];

  if (!player || !player.trivia) return { paragraph: '', selectedStrings: [] };

  const categories = Object.keys(player.trivia);
  // Deduplicate exact strings across categories & assign weights
  const itemsByText = new Map();
  for (const cat of categories) {
    const arr = player.trivia[cat];
    if (!Array.isArray(arr)) continue;
    const filteredArr = filterStatHeavyTrivia(arr);
    const weight = getCategoryWeight(cat);
    for (const raw of filteredArr) {
      if (typeof raw !== 'string') continue;
      const text = raw.trim();
      if (!text) continue;
      if (itemsByText.has(text)) {
        const existing = itemsByText.get(text);
        existing.categories.add(cat);
        existing.weight = Math.max(existing.weight, weight);
      } else {
        itemsByText.set(text, { text, categories: new Set([cat]), weight });
      }
    }
  }

  if (itemsByText.size === 0) return { paragraph: '', selectedStrings: [] };

  // Weighted pool
  const uniqueItems = Array.from(itemsByText.values());
  const pool = uniqueItems.flatMap(it => Array(it.weight).fill(it));
  const shuffledPool = shuffleArray(pool);

  let selected = [];
  let totalChars = 0;
  let usedThreshold = startThreshold;

  const trySelection = (threshold) => {
    selected = [];
    totalChars = 0;
    const seenTexts = new Set();
    for (const it of shuffledPool) {
      const text = it.text;
      if (seenTexts.has(text)) continue;
      const addSpace = selected.length > 0 ? 1 : 0;
      const prospectiveLen = totalChars + addSpace + text.length;
      if (prospectiveLen > maxChars) continue;
      if (selected.some(s => isSimilarAgainst(s, text, threshold))) continue;
      selected.push(text);
      seenTexts.add(text);
      totalChars = prospectiveLen;
      if (totalChars >= maxChars) break;
    }
    return { selected, totalChars };
  };

  const thresholdsToTry = [startThreshold, 0.5, 0.4, 0.3];
  for (const t of thresholdsToTry) {
    const result = trySelection(t);
    if (result.selected.length > 0) {
      usedThreshold = t;
      selected = result.selected;
      totalChars = result.totalChars;
      break;
    }
  }

  if (selected.length === 0) {
    const sortedByLen = uniqueItems.map(it => it.text).filter(t => t.length <= maxChars).sort((a,b)=>a.length-b.length);
    if (sortedByLen.length > 0) selected = [sortedByLen[0]];
    else return { paragraph: '', selectedStrings: [] };
  }

  return {
    paragraph: buildParagraph(selected),
    selectedStrings: selected
  };
}