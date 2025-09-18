// short-quiz.js
// Single-page quiz controller for SHORT QUIZ (10 random players)

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

///// Short quiz storage keys
const SHORT_POOL_KEY     = 'shortCurrentRoster';
const SHORT_TOTAL_KEY    = 'shortTotalQuestions';
const SHORT_SCORE_KEY    = 'shortScore';
const SHORT_ASKED_KEY    = 'shortQuestionsAsked';
const SHORT_LAST_PLAYER  = 'shortLastPlayer';
const SHORT_LAST_ANSWER  = 'shortLastAnswer';

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
function chooseRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

///// Initialization
async function init() {
  log('init() start');

  // Load trivia
  try { await loadTrivia(); log('Trivia module loaded'); } 
  catch (err) { console.error('[short-quiz] loadTrivia() failed:', err); }

  // Load full roster
  let loadedRoster = [];
  try {
    const resp = await fetch('currentroster.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    loadedRoster = await resp.json();
    if (!Array.isArray(loadedRoster) || loadedRoster.length === 0) throw new Error('currentroster.json is not a non-empty array');
    log(`Fetched currentroster.json — ${loadedRoster.length} players`);
  } catch (err) {
    console.error('[short-quiz] Could not fetch currentroster.json:', err);
    questionDisplay.textContent = `Error loading roster: ${err.message}`;
    showView('quiz1');
    return;
  }

  // Shuffle and pick 10 players
  shuffleArray(loadedRoster);
  loadedRoster = loadedRoster.slice(0, 10);
  log('Short quiz: selected 10 random players');

  // Initialize working pool in localStorage
  try {
    const rawSaved = localStorage.getItem(SHORT_POOL_KEY);
    let saved = safeParseJSON(rawSaved);
    if (!Array.isArray(saved) || saved.length === 0) {
      const fresh = [...loadedRoster];
      localStorage.setItem(SHORT_POOL_KEY, JSON.stringify(fresh));
      localStorage.setItem(SHORT_TOTAL_KEY, '10');
      localStorage.setItem(SHORT_ASKED_KEY, '0');
      localStorage.setItem(SHORT_SCORE_KEY, '0');
      localStorage.removeItem(SHORT_LAST_PLAYER);
      localStorage.removeItem(SHORT_LAST_ANSWER);
      log('Saved fresh short quiz pool to localStorage');
    } else {
      log(`Found existing short quiz pool — ${saved.length} players remain`);
    }
    initialRosterCount = 10;
  } catch (err) {
    console.error('[short-quiz] Error initializing roster in localStorage:', err);
    questionDisplay.textContent = `Error initializing roster: ${err.message}`;
    showView('quiz1');
    return;
  }

  // Resume last player if exists
  const lastPlayerRaw = localStorage.getItem(SHORT_LAST_PLAYER);
  const lastAnswerRaw = localStorage.getItem(SHORT_LAST_ANSWER);

  if (lastPlayerRaw && lastAnswerRaw !== null) {
    log('Resuming short quiz from storage');
    try { currentPlayer = safeParseJSON(lastPlayerRaw) || null; showAnswerView(); return; } 
    catch (err) { console.warn('[short-quiz] Could not parse lastPlayer; will pick next player', err); }
  }

  pickNextPlayer();
}

///// Pick next player
function pickNextPlayer() {
  const raw = localStorage.getItem(SHORT_POOL_KEY);
  const pool = Array.isArray(safeParseJSON(raw)) ? safeParseJSON(raw) : [];

  log('pickNextPlayer: pool length before pick =', pool.length);

  if (pool.length === 0) { 
    log('No players left; redirecting to short-quiz-end.html'); 
    window.location.href = 'short-quiz-end.html'; 
    return; 
  }

  currentPlayer = pool.shift();
  localStorage.setItem(SHORT_POOL_KEY, JSON.stringify(pool));
  localStorage.setItem(SHORT_LAST_PLAYER, JSON.stringify(currentPlayer));
  answerDisplay.value = '';

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
  const phrase = chooseRandom(questionPhrases);
  questionDisplay.textContent = phrase.replace('{player}', currentPlayer.player_name);

  showView('quiz1');
  log(`Picked player ${currentPlayer.player_id} - ${currentPlayer.player_name}. Remaining in pool: ${pool.length}`);
}

///// Handle submit
function handleSubmit() {
  const raw = answerDisplay.value.trim();
  if (!raw) return;
  const userAnswer = parseInt(raw, 10);
  if (Number.isNaN(userAnswer)) return;

  localStorage.setItem(SHORT_LAST_ANSWER, String(userAnswer));

  let questionsAsked = parseInt(localStorage.getItem(SHORT_ASKED_KEY), 10) || 0;
  questionsAsked += 1;
  localStorage.setItem(SHORT_ASKED_KEY, String(questionsAsked));

  let score = parseInt(localStorage.getItem(SHORT_SCORE_KEY), 10) || 0;
  const correctNumber = Number(currentPlayer?.number ?? NaN);
  if (!Number.isNaN(correctNumber) && correctNumber === userAnswer) score += 1;
  localStorage.setItem(SHORT_SCORE_KEY, String(score));

  log(`Answer submitted for player ${currentPlayer?.player_id}: guess=${userAnswer} correct=${correctNumber === userAnswer}`);

  showAnswerView();
}

///// Show answer/trivia
function showAnswerView() {
  const rawLast = localStorage.getItem(SHORT_LAST_PLAYER);
  const last = safeParseJSON(rawLast) || currentPlayer;
  if (!last) { feedbackEl.textContent = 'Player not found.'; showView('quiz1'); return; }
  currentPlayer = last;

  playerImageEl.src = currentPlayer.player_image || '';
  giantNumberEl.textContent = currentPlayer.number ?? '';
  playerInfoEl.textContent = `${currentPlayer.player_name} - ${currentPlayer.position ?? ''}`;

  const storedAnswer = parseInt(localStorage.getItem(SHORT_LAST_ANSWER), 10);
  const correctNumber = Number(currentPlayer?.number ?? NaN);
  feedbackEl.textContent = !Number.isNaN(correctNumber) && storedAnswer === correctNumber
    ? chooseRandom(["Nice job!","That's right!","You got it!","Exactly!","Spot on!","Great work!","Correct!"])
    : chooseRandom(["Oops, try again.","Not quite.","Wrong number.","Almost, keep going.","Try once more.","Incorrect, keep going."]);

  let triviaRes = { paragraph: '', selectedStrings: [], debug: null };
  try {
    triviaRes = generateTriviaParagraph(currentPlayer.player_id) || triviaRes;
    playerTriviaEl.textContent = (triviaRes.paragraph || '').trim();
  } catch { playerTriviaEl.textContent = ''; }

  const score = parseInt(localStorage.getItem(SHORT_SCORE_KEY) || '0', 10);
  const questionsAsked = parseInt(localStorage.getItem(SHORT_ASKED_KEY) || '0', 10);
  scoreEl.textContent = score;
  remainingEl.textContent = (initialRosterCount - questionsAsked);

  showView('quiz2');
}

///// Event listeners
goButton.addEventListener('click', handleSubmit);
clearButton.addEventListener('click', () => { answerDisplay.value = ''; });
keypadButtons.forEach(btn => btn.addEventListener('click', () => { answerDisplay.value += btn.textContent; }));
nextButton.addEventListener('click', pickNextPlayer);

///// Start quiz
init();