// trivia-shuffle.js
// ES module. Exports:
//   - generateTriviaParagraph(playerId, options) -> { paragraph, selectedStrings, debug }
//   - processTempInput(inputPath = 'temp.json', outputPath = 'tempoutput.json') -> writes output file and returns result summary
//
// Behavior & decisions (summary):
// - Finds trivia.json robustly from several candidate locations (works when CWD is fetchimages or repo root).
// - Deduplicates identical strings across categories (keeps highest category weight if same text appears in multiple categories).
// - Category weights: CAREER HIGHLIGHTS & AWARDS -> 3 (highest), "2024" -> 1 (lowest), others -> 2 (medium).
// - Avoids very similar strings in same paragraph using a word-overlap heuristic with stopword removal.
// - Never cuts a string; selects whole strings only. Maintains <= maxChars (default 450). Counts spaces between selected pieces.
// - Verbose console logging about files found, keys, categories, counts, skipped entries, and validation (>=50% non-empty recommended).
// - Graceful: missing player ids or missing trivia.json will not crash the process; returns empty paragraph for missing players.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/* ---------- Helpers & config ---------- */

const MAX_CHAR_DEFAULT = 450;

// Candidate paths for trivia.json (tries in order)
function locateTriviaFile() {
  const cwd = process.cwd();
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(cwd, 'trivia.json'),                    // if running from fetchimages
    path.resolve(cwd, 'fetchimages', 'trivia.json'),     // if running from repo root
    path.resolve(moduleDir, 'trivia.json'),              // if running the module from its folder
    path.resolve(moduleDir, '..', 'fetchimages', 'trivia.json')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[trivia-shuffle] Found trivia.json at: ${p}`);
      return p;
    }
  }
  console.warn('[trivia-shuffle] trivia.json not found in candidate paths:', candidates);
  return null;
}

// Load trivia.json
const triviaFilePath = locateTriviaFile();
let triviaData = {};
if (triviaFilePath) {
  try {
    triviaData = JSON.parse(fs.readFileSync(triviaFilePath, 'utf-8'));
    console.log(`[trivia-shuffle] Loaded trivia.json — player count: ${Object.keys(triviaData).length}`);
  } catch (err) {
    console.error('[trivia-shuffle] Error parsing trivia.json:', err);
    triviaData = {};
  }
} else {
  triviaData = {};
}

/* ---------- Category weighting ---------- */
function getCategoryWeight(category) {
  if (!category || typeof category !== 'string') return 2;
  const upper = category.toUpperCase().trim();
  const highest = new Set(['CAREER HIGHLIGHTS', 'AWARDS']);
  const lowest = new Set(['2024']);
  if (highest.has(upper)) return 3;
  if (lowest.has(upper)) return 1;
  return 2;
}

/* ---------- Utilities ---------- */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STOPWORDS = new Set([
  'the','a','an','and','or','in','on','of','for','to','has','have','had','is','are','with','at','by','from','over',
  'as','his','her','he','she','they','them','their','that','this','which','was','were','it','its','but','be','been',
  'who','whom','will','would','can','could','did','do','does','i','you','we','us','our'
]);

function wordsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  // normalize: lowercase, replace non-alphanum (except decimal point and apostrophes) with space
  const cleaned = text.toLowerCase().replace(/[^a-z0-9.\-']/g, ' ');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  // filter stopwords and very short tokens
  return parts.filter(w => !STOPWORDS.has(w) && w.length >= 2);
}

// similarity: fraction of candidate's unique meaningful words that appear in existing
function isSimilarAgainst(existingText, candidateText, threshold = 0.6) {
  const eWords = new Set(wordsFromText(existingText));
  const cWords = wordsFromText(candidateText);
  if (cWords.length === 0) return false;
  let common = 0;
  for (const w of new Set(cWords)) {
    if (eWords.has(w)) common++;
  }
  const ratio = common / new Set(cWords).size;
  return ratio >= threshold;
}

/* ---------- Core logic ---------- */

/**
 * Generate a paragraph from a player's trivia.
 * @param {string|number} playerId
 * @param {Object} options
 *   - maxChars (number): maximum total characters (default 450)
 *   - similarityThreshold (number): starting similarity threshold (0-1). Lower -> more tolerant
 * @returns {Object} { paragraph, selectedStrings, debug }
 */
export function generateTriviaParagraph(playerId, options = {}) {
  const maxChars = Number(options.maxChars ?? MAX_CHAR_DEFAULT);
  const startThreshold = Number(options.similarityThreshold ?? 0.6);

  const key = String(playerId).trim();
  const player = triviaData[key];

  const debug = {
    playerId: key,
    playerName: player?.player_name ?? null,
    categoriesFound: [],
    totalUniqueFacts: 0,
    duplicatesRemoved: 0,
    blanksSkipped: 0,
    selectedCount: 0,
    selectedChars: 0,
    thresholdUsed: null
  };

  if (!player) {
    console.warn(`[trivia-shuffle] No player found for ID "${key}"`);
    return { paragraph: '', selectedStrings: [], debug };
  }
  if (!player.trivia || typeof player.trivia !== 'object') {
    console.warn(`[trivia-shuffle] Player "${key}" missing trivia object`);
    return { paragraph: '', selectedStrings: [], debug };
  }

  const categories = Object.keys(player.trivia);
  debug.categoriesFound = categories.slice();
  // Build unique items map: text -> { text, categories:Set, weight }
  const itemsByText = new Map();
  let localBlanks = 0;
  let localDuplicates = 0;

  for (const cat of categories) {
    const arr = player.trivia[cat];
    if (!Array.isArray(arr)) continue;
    const weight = getCategoryWeight(cat);
    for (const raw of arr) {
      if (typeof raw !== 'string') {
        localBlanks++;
        continue;
      }
      const text = raw.trim();
      if (text.length === 0) {
        localBlanks++;
        continue;
      }
      if (itemsByText.has(text)) {
        // already present: add category and bump weight if necessary
        const existing = itemsByText.get(text);
        existing.categories.add(cat);
        existing.weight = Math.max(existing.weight, weight);
        localDuplicates++;
      } else {
        itemsByText.set(text, { text, categories: new Set([cat]), weight });
      }
    }
  }

  debug.totalUniqueFacts = itemsByText.size;
  debug.duplicatesRemoved = localDuplicates;
  debug.blanksSkipped = localBlanks;

  if (itemsByText.size === 0) {
    console.warn(`[trivia-shuffle] Player "${key}" has no usable trivia strings (after filtering).`);
    return { paragraph: '', selectedStrings: [], debug };
  }

  // Create weighted pool (replicate items according to weight) and shuffle
  const uniqueItems = Array.from(itemsByText.values());
  const pool = uniqueItems.flatMap(it => Array(it.weight).fill(it)); // replication for weighting
  const shuffledPool = shuffleArray(pool);

  // Attempt selection with decreasing similarity thresholds if necessary
  let selected = [];
  let totalChars = 0;
  let usedThreshold = startThreshold;

  const trySelection = (threshold) => {
    selected = [];
    totalChars = 0;
    const seenTexts = new Set();
    for (const it of shuffledPool) {
      const text = it.text;
      if (seenTexts.has(text)) continue; // avoid exact duplicates
      // compute prospective length including a separating space if needed
      const addSpace = selected.length > 0 ? 1 : 0;
      const prospectiveLen = totalChars + addSpace + text.length;
      if (prospectiveLen > maxChars) continue;

      // check similarity against already selected
      let tooSimilar = false;
      for (const s of selected) {
        if (isSimilarAgainst(s, text, threshold)) {
          tooSimilar = true;
          break;
        }
      }
      if (tooSimilar) continue;

      // Accept
      selected.push(text);
      seenTexts.add(text);
      totalChars = prospectiveLen;

      // Early exit if we've reached maxChars tightly (can't fit any other)
      if (totalChars >= maxChars) break;
    }
    return { selected, totalChars };
  };

  // Try progressively relaxing threshold if we get nothing
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

  // Fallback: if still nothing selected, pick the single shortest fact that fits
  if (selected.length === 0) {
    // find shortest item that fits maxChars
    const sortedByLen = uniqueItems
      .map(it => it.text)
      .filter(txt => txt.length <= maxChars)
      .sort((a, b) => a.length - b.length);
    if (sortedByLen.length > 0) {
      selected = [sortedByLen[0]];
      totalChars = sortedByLen[0].length;
      usedThreshold = null; // fallback used
    } else {
      // nothing fits
      debug.thresholdUsed = usedThreshold;
      debug.selectedCount = 0;
      debug.selectedChars = 0;
      console.warn(`[trivia-shuffle] No trivia lines fit within ${maxChars} chars for player ${key}.`);
      return { paragraph: '', selectedStrings: [], debug };
    }
  }

  debug.thresholdUsed = usedThreshold;
  debug.selectedCount = selected.length;
  debug.selectedChars = totalChars;

  console.log(`[trivia-shuffle] player=${key} name="${player.player_name ?? ''}" categories=${categories.length} uniqueFacts=${debug.totalUniqueFacts} selected=${debug.selectedCount} chars=${debug.selectedChars} threshold=${String(debug.thresholdUsed)}`);

  return {
    paragraph: selected.join(' '),
    selectedStrings: selected,
    debug
  };
}

/* ---------- Batch helper: process temp.json -> tempoutput.json ---------- */

/**
 * Read input JSON array of ids from inputPath (relative to CWD), generate paragraphs, write to outputPath.
 * Returns an object summary with counts and the output object.
 */
export function processTempInput(inputPath = 'temp.json', outputPath = 'tempoutput.json', options = {}) {
  const inPath = path.resolve(process.cwd(), inputPath);
  const outPath = path.resolve(process.cwd(), outputPath);

  if (!fs.existsSync(inPath)) {
    const msg = `[trivia-shuffle] Input file not found: ${inPath}`;
    console.error(msg);
    throw new Error(msg);
  }

  let inputIds;
  try {
    inputIds = JSON.parse(fs.readFileSync(inPath, 'utf-8'));
    if (!Array.isArray(inputIds)) throw new Error('temp.json must be a JSON array of player IDs (strings or numbers).');
  } catch (err) {
    console.error('[trivia-shuffle] Error reading/parsing temp.json:', err);
    throw err;
  }

  const output = {};
  const perIdDebug = {};
  let nonEmptyCount = 0;

  for (const pid of inputIds) {
    try {
      const res = generateTriviaParagraph(pid, options);
      output[String(pid)] = { paragraph: res.paragraph, selectedStrings: res.selectedStrings };
      perIdDebug[String(pid)] = res.debug ?? null;
      if (Array.isArray(res.selectedStrings) && res.selectedStrings.length > 0) nonEmptyCount++;
    } catch (err) {
      console.error(`[trivia-shuffle] Error processing id ${String(pid)}:`, err);
      output[String(pid)] = { paragraph: '', selectedStrings: [] };
      perIdDebug[String(pid)] = { error: err.message };
    }
  }

  // Write output file
  try {
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`[trivia-shuffle] Wrote output for ${inputIds.length} ids to ${outPath}`);
  } catch (err) {
    console.error('[trivia-shuffle] Error writing output file:', err);
    throw err;
  }

  const ratio = inputIds.length > 0 ? (nonEmptyCount / inputIds.length) : 0;
  const summary = {
    inputCount: inputIds.length,
    nonEmptyCount,
    ratio,
    recommendation: ratio >= 0.5 ? 'OK' : 'Less than 50% non-empty — consider reviewing trivia.json or temp.json'
  };

  console.log('[trivia-shuffle] Summary:', summary);
  // Verbose: per-id debug can be returned for CI parsing
  return { summary, perIdDebug, outputPath: outPath };
}

/* ---------- Notes for maintainers (in-code documentation) ----------
 - If you run this in GitHub Actions, the runner's CWD is typically set by the workflow step.
   In the workflow we previously recommended `cd fetchimages` before invoking Node — that is compatible.
 - The function generateTriviaParagraph coerces playerId to string, trims it, and looks up in trivia.json.
 - Similarity threshold defaults to 0.6. If no items are selected, the algorithm relaxes the threshold to 0.5, 0.4, 0.3 in turn,
   then falls back to the single shortest fitting string.
 - The pool uses weight replication; identical exact strings are de-duplicated before replication.
 - Logging is intentionally verbose for debugging inside CI runs; reduce console output if you want quieter logs.
------------------------------------------------------------------ */