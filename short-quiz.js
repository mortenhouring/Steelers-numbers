// short-quiz.js
// Copied from one-page-quiz.js, minimal changes for 10-player short quiz

import { loadTrivia, generateTriviaParagraph } from './main-trivia-shuffle.js';

///// Elements (quiz1 + quiz2)
const quiz1View = document.getElementById('quiz1-view');
const quiz2View = document.getElementById('quiz2-view');

const questionDisplay = document.getElementById('player-name');
const answerDisplay = document.getElementById('answer-display');
const goButton = document.getElementById('go-button');
const clearButton = document.getElementById('clear-button');
const keypadButtons = document.querySelectorAll('.num');

const feedbackEl = document.getElementById('feedback');
const playerImageEl = document.getElementById('player-image');
const giantNumberEl = document.getElementById('giant-number');
const playerInfoEl = document.getElementById('player-info');
const playerTriviaEl = document.getElementById('player-trivia');
const scoreEl = document.getElementById('score');
const remainingEl = document.getElementById('remaining');
const nextButton = document.getElementById('next-button');

///// State
let currentPlayer = null;
let initialRosterCount = 0;

///// Utility helpers
function log(...args) { console.log('[short-quiz]', ...args); }
function safeParseJSON(raw) { try { return JSON.parse(raw); } catch { return null; } }
function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
function showView(viewId) {
  if (viewId === 'quiz1') {
    quiz1View.style.display = 'block';
    quiz2View.style.display = 'none';
    quiz1View.setAttribute('aria-hidden', 'false');
    quiz2View.setAttribute('aria-hidden', 'true');
  } else {
    quiz1View.style.display = 'none';
    quiz2View.style.display = 'block';
    quiz1View.setAttribute('aria-hidden', 'true');
    quiz2View.setAttribute('aria-hidden', 'false');
  }
}

///// Roster loading / initialization
async function init() {
  log('init() start');

  try { await loadTrivia(); log('Trivia module loaded'); } 
  catch (err) { console.error('[short-quiz] loadTrivia() failed:', err); }

  // --- Load full roster ---
  let loadedRoster = [];
  try {
    const resp = await fetch('currentroster.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    loadedRoster = await resp.json();
    if (!Array.isArray(loadedRoster) || loadedRoster.length === 0) {
      throw new Error('currentroster.json is not a non-empty array');
    }
    log(`Fetched currentroster.json — ${loadedRoster.length} players`);
  } catch (err) {
    console.error('[short-quiz] Could not fetch currentroster.json:', err);
    questionDisplay.textContent = `Error loading roster: ${err.message}`;
    showView('quiz1');
    return;
  }

  // --- SHORT QUIZ: shuffle + take 10 ---
  shuffleArray(loadedRoster);
  loadedRoster = loadedRoster.slice(0, 10);
  log('Short quiz: selected 10 random players');

  // --- Initialize short quiz storage ---
  try {
    const rawSaved = localStorage.getItem('shortCurrentRoster');
    let saved = safeParseJSON(rawSaved);
    if (!Array.isArray(saved) || saved.length === 0) {
      const fresh = [...loadedRoster];
      shuffleArray(fresh);
      localStorage.setItem('shortCurrentRoster', JSON.stringify(fresh));
      log('Saved fresh shuffled shortCurrentRoster to localStorage');
      localStorage.setItem('shortTotalQuestions', '10');
      localStorage.setItem('shortQuestionsAsked', '0');
      localStorage.setItem('shortScore', '0');
    } else {
      log(`Found existing shortCurrentRoster in localStorage — ${saved.length} players remain`);
    }

    initialRosterCount = parseInt(localStorage.getItem('shortTotalQuestions'), 10) || 10;
  } catch (err) {
    console.error('[short-quiz] Error initializing roster in localStorage:', err);
    questionDisplay.textContent = `Error initializing roster: ${err.message}`;
    showView('quiz1');
    return;
  }

  // Resume if lastPlayer exists
  const lastPlayerRaw = localStorage.getItem('shortLastPlayer');
  const lastAnswerRaw = localStorage.getItem('shortLastAnswer');

  if (lastPlayerRaw && lastAnswerRaw !== null) {
    log('Resuming: lastPlayer and lastAnswer found in storage — showing feedback view');
    try { 
      currentPlayer = safeParseJSON(lastPlayerRaw) || null;
      showAnswerView(); 
      return; 
    } catch (err) { console.warn('[short-quiz] Could not parse lastPlayer; will pick next player', err); }
  }

  pickNextPlayer();
}

///// Pick next player
function pickNextPlayer() {
  const raw = localStorage.getItem('shortCurrentRoster');
  const pool = Array.isArray(safeParseJSON(raw)) ? safeParseJSON(raw) : [];

  log('pickNextPlayer: pool length before pick =', pool.length);

  if (pool.length === 0) {
    log('No players left; redirecting to short-quiz-end.html');
    window.location.href = 'short-quiz-end.html';
    return;
  }

  currentPlayer = pool.shift();
  localStorage.setItem('shortCurrentRoster', JSON.stringify(pool));
  localStorage.setItem('shortLastPlayer', JSON.stringify(currentPlayer));

  const questionPhrases = [
    "What number is {player}?",
    "Which digits are on {player}'s jersey?",
    "Which number’s on {player}'s back?",
    "What’s {player}'s Steel Curtain number?",
    "What jersey number is {player}?",
    "What digits does {player} rep for Steelers Nation?",
    "What’s {player}'s jersey number?",
    "What number’s on {player}'s helmet stripe?",
    "Which jersey number does {player} wear?",
    "What number’s stitched on {player}'s uniform?",
  ];

  const phrase = questionPhrases[Math.floor(Math.random() * questionPhrases.length)];
  questionDisplay.textContent = phrase.replace('{player}', currentPlayer.player_name);
  answerDisplay.value = '';

  showView('quiz1');

  const remaining = safeParseJSON(localStorage.getItem('shortCurrentRoster'))?.length ?? 0;
  log(`Picked player ${currentPlayer.player_id} - ${currentPlayer.player_name}. Remaining in pool: ${remaining}`);
}

///// Handle submit
function handleSubmit() {
  const raw = answerDisplay.value.trim();
  if (raw.length === 0) return;
  const userAnswer = parseInt(raw, 10);
  if (Number.isNaN(userAnswer)) return;

  localStorage.setItem('shortLastAnswer', String(userAnswer));

  let questionsAsked = parseInt(localStorage.getItem('shortQuestionsAsked'), 10) || 0;
  questionsAsked += 1;

  let score = parseInt(localStorage.getItem('shortScore'), 10) || 0;
  const correctNumber = Number(currentPlayer?.number ?? NaN);
  if (!Number.isNaN(correctNumber) && correctNumber === userAnswer) score += 1;

  localStorage.setItem('shortQuestionsAsked', String(questionsAsked));
  localStorage.setItem('shortScore', String(score));

  log(`Answer submitted for player ${currentPlayer?.player_id}: guess=${userAnswer} correct=${correctNumber === userAnswer}`);

  showAnswerView();
}

///// Show answer/trivia view
function showAnswerView() {
  const rawLast = localStorage.getItem('shortLastPlayer');
  const last = safeParseJSON(rawLast) || currentPlayer;
  if (!last) {
    feedbackEl.textContent = 'Player not found.';
    showView('quiz1');
    return;
  }
  currentPlayer = last;

  playerImageEl.src = currentPlayer.player_image || '';
  giantNumberEl.textContent = currentPlayer.number ?? '';
  playerInfoEl.textContent = `${currentPlayer.player_name} - ${currentPlayer.position ?? ''}`;

  const storedAnswer = parseInt(localStorage.getItem('shortLastAnswer'), 10);
  const correctNumber = Number(currentPlayer?.number ?? NaN);
  if (!Number.isNaN(correctNumber) && storedAnswer === correctNumber) {
    feedbackEl.textContent = chooseRandom([
      "Nice job!", "That's right!", "You got it!", "Exactly!", "Spot on!", "Great work!", "Correct!"
    ]);
  } else {
    feedbackEl.textContent = chooseRandom([
      "Oops, try again.", "Not quite.", "Wrong number.", "Almost, keep going.", "Try once more.", "Incorrect, keep going."
    ]);
  }

  let triviaRes = { paragraph: '', selectedStrings: [], debug: null };
  try {
    const res = generateTriviaParagraph(currentPlayer.player_id);
    triviaRes = res ?? triviaRes;
    playerTriviaEl.textContent = (triviaRes.paragraph || '').trim();
    if (!triviaRes.paragraph) log('No trivia paragraph returned for player', currentPlayer.player_id);
    log('Trivia debug:', triviaRes.debug ?? '(no debug)');
  } catch (err) { console.error('[short-quiz] Error generating trivia paragraph:',