// one-page-quiz.js
// Single-page quiz controller.
// - Uses currentroster.json as source of truth
// - Maintains a working pool in localStorage: "currentRoster" (players left to ask)
// - Preserves UI layouts from your quiz1 & quiz2 HTMLs (IDs unchanged)
// - Uses trivia functions exported by main-trivia-shuffle.js:
//     import { loadTrivia, generateTriviaParagraph } from './main-trivia-shuffle.js';
//
// Notes:
// - This script is written to be defensive: it validates localStorage, falls back to the JSON,
//   initializes totalQuestions once, and logs detailed debug information.

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
let currentPlayer = null; // object (the player currently in play - same structure as currentroster entries)
let initialRosterCount = 0; // total at start (persisted to localStorage as totalQuestions)

///// Utility helpers
function log(...args) {
  // Centralized logger so we can change verbosity easily
  console.log('[one-page-quiz]', ...args);
}
function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
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

  // 1) Load trivia (external module may do network work or parse a file)
  try {
    await loadTrivia();
    log('Trivia module loaded');
  } catch (err) {
    console.error('[one-page-quiz] loadTrivia() failed:', err);
    // proceed — generateTriviaParagraph may still work if trivia.json is embedded in module
  }

  // 2) Load roster JSON (source of truth)
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
    console.error('[one-page-quiz] Could not fetch currentroster.json:', err);
    questionDisplay.textContent = `Error loading roster: ${err.message}`;
    // show quiz1 to display error
    showView('quiz1');
    return;
  }

  // 3) Initialize working pool in localStorage (currentRoster)
  // If there is a saved working pool, validate it; otherwise save a shuffled fresh pool.
  try {
    const rawSaved = localStorage.getItem('currentRoster');
    let saved = safeParseJSON(rawSaved);
    if (!Array.isArray(saved) || saved.length === 0) {
      // no valid saved pool — create one from loadedRoster
      const fresh = [...loadedRoster];
      shuffleArray(fresh);
      localStorage.setItem('currentRoster', JSON.stringify(fresh));
      log('Saved fresh shuffled currentRoster to localStorage');
    } else {
      log(`Found existing currentRoster in localStorage — ${saved.length} players remain`);
    }

    // Ensure totalQuestions is set (the initial roster length)
    let totalQ = parseInt(localStorage.getItem('totalQuestions'), 10);
    if (isNaN(totalQ)) {
      totalQ = loadedRoster.length;
      localStorage.setItem('totalQuestions', String(totalQ));
      log('Initialized totalQuestions in localStorage to', totalQ);
    } else {
      log('totalQuestions (from storage):', totalQ);
    }
    initialRosterCount = totalQ;
  } catch (err) {
    console.error('[one-page-quiz] Error initializing roster in localStorage:', err);
    questionDisplay.textContent = `Error initializing roster: ${err.message}`;
    showView('quiz1');
    return;
  }

  // 4) If we already have a lastPlayer and lastAnswer stored, show quiz2 (resume), otherwise show next question
  const lastPlayerRaw = localStorage.getItem('lastPlayer');
  const lastAnswerRaw = localStorage.getItem('lastAnswer');

  if (lastPlayerRaw && lastAnswerRaw !== null) {
    log('Resuming: lastPlayer and lastAnswer found in storage — showing feedback view');
    // parse and display
    try {
      currentPlayer = safeParseJSON(lastPlayerRaw) || null;
      showAnswerView(); // uses currentPlayer or stored lastPlayer
      return;
    } catch (err) {
      console.warn('[one-page-quiz] Could not parse lastPlayer; will pick next player', err);
    }
  }

  // Default behavior: present the next player
  pickNextPlayer();
}

///// Pick next player from working pool (removes chosen player from pool)
function pickNextPlayer() {
  // read working pool
  const raw = localStorage.getItem('currentRoster');
  const pool = Array.isArray(safeParseJSON(raw)) ? safeParseJSON(raw) : [];

  log('pickNextPlayer: pool length before pick =', pool.length);

  if (pool.length === 0) {
    log('No players left; redirecting to currentquizend.html');
    window.location.href = 'currentquizend.html';
    return;
  }

  // take first player (FIFO)
  currentPlayer = pool.shift();
  localStorage.setItem('currentRoster', JSON.stringify(pool));
  localStorage.setItem('lastPlayer', JSON.stringify(currentPlayer));
  // don't set lastAnswer here — set it when user submits

  // Update UI for question (quiz1)
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

  // show the question view
  showView('quiz1');

  // Logging for CI/dev
  const remaining = safeParseJSON(localStorage.getItem('currentRoster'))?.length ?? 0;
  log(`Picked player ${currentPlayer.player_id} - ${currentPlayer.player_name}. Remaining in pool: ${remaining}`);
}

///// Handle user submitting an answer (Go button)
function handleSubmit() {
  const raw = answerDisplay.value.trim();
  if (raw.length === 0) {
    // nothing typed
    return;
  }
  const userAnswer = parseInt(raw, 10);
  if (Number.isNaN(userAnswer)) return;

  // store lastAnswer (persist so page reload on feedback still works)
  localStorage.setItem('lastAnswer', String(userAnswer));
  // lastPlayer already set when pickNextPlayer ran.

  // Now process and show answer/feedback (quiz2)
  // Update counters (questionsAsked and score)
  let questionsAsked = parseInt(localStorage.getItem('questionsAsked'), 10);
  if (isNaN(questionsAsked)) questionsAsked = 0;
  questionsAsked += 1;

  let score = parseInt(localStorage.getItem('score'), 10);
  if (isNaN(score)) score = 0;

  // Check correctness using currentPlayer.number (coerce to int)
  const correctNumber = Number(currentPlayer?.number ?? NaN);
  if (!Number.isNaN(correctNumber) && correctNumber === userAnswer) {
    score += 1;
  }

  localStorage.setItem('questionsAsked', String(questionsAsked));
  localStorage.setItem('score', String(score));

  log(`Answer submitted for player ${currentPlayer?.player_id}: guess=${userAnswer} correct=${correctNumber === userAnswer}`);

  // Show quiz2 with the result
  showAnswerView();
}

///// Build and show the answer/trivia view using lastPlayer from storage (or currentPlayer)
function showAnswerView() {
  // Ensure we have a player to show
  const rawLast = localStorage.getItem('lastPlayer');
  const last = safeParseJSON(rawLast) || currentPlayer;
  if (!last) {
    feedbackEl.textContent = 'Player not found.';
    showView('quiz1');
    return;
  }
  currentPlayer = last; // set global

  // Fill UI
  playerImageEl.src = currentPlayer.player_image || '';
  giantNumberEl.textContent = currentPlayer.number ?? '';
  playerInfoEl.textContent = `${currentPlayer.player_name} - ${currentPlayer.position ?? ''}`;

  // Feedback (correct/incorrect)
  const storedAnswer = parseInt(localStorage.getItem('lastAnswer'), 10);
  const correctNumber = Number(currentPlayer?.number ?? NaN);
  if (!Number.isNaN(correctNumber) && storedAnswer === correctNumber) {
    feedbackEl.textContent = chooseRandom([
      "Nice job!",
      "That's right!",
      "You got it!",
      "Exactly!",
      "Spot on!",
      "Great work!",
      "Correct!"
    ]);
  } else {
    feedbackEl.textContent = chooseRandom([
      "Oops, try again.",
      "Not quite.",
      "Wrong number.",
      "Almost, keep going.",
      "Try once more.",
      "Incorrect, keep going."
    ]);
  }

  // Trivia paragraph using your trivia module
  let triviaRes = { paragraph: '', selectedStrings: [], debug: null };
  try {
    const res = generateTriviaParagraph(currentPlayer.player_id);
    // generateTriviaParagraph may return {paragraph, selectedStrings, debug}
    triviaRes = res ?? triviaRes;
    playerTriviaEl.textContent = (triviaRes.paragraph || '').trim();
    if (!triviaRes.paragraph) {
      playerTriviaEl.textContent = '';
      log('No trivia paragraph returned for player', currentPlayer.player_id);
    }
    log('Trivia debug:', triviaRes.debug ?? '(no debug)');
  } catch (err) {
    console.error('[one-page-quiz] Error generating trivia paragraph:', err);
    playerTriviaEl.textContent = '';
  }

  // Counters
  let totalQuestions = parseInt(localStorage.getItem('totalQuestions'), 10);
  if (isNaN(totalQuestions)) {
    // fallback to initialRosterCount if something odd happened
    totalQuestions = initialRosterCount || 0;
    localStorage.setItem('totalQuestions', String(totalQuestions));
  }

  const score = parseInt(localStorage.getItem('score') || '0', 10);
  const questionsAsked = parseInt(localStorage.getItem('questionsAsked') || '0', 10);
  scoreEl.textContent = `Score: ${score} / ${questionsAsked}`;

  // Remaining = number of players left in working pool
  const pool = Array.isArray(safeParseJSON(localStorage.getItem('currentRoster')))
    ? safeParseJSON(localStorage.getItem('currentRoster'))
    : [];
  const remaining = pool.length;
  remainingEl.textContent = `Remaining: ${remaining} / ${totalQuestions}`;

  // Show the answer view
  showView('quiz2');

  // Debug log
  log(`Displayed quiz2 for player ${currentPlayer.player_id}. score=${score}, asked=${questionsAsked}, remaining=${remaining}`);
}

///// Next handler — called when user clicks "Next Player"
function handleNext() {
  // After user sees the trivia & feedback, we clear lastPlayer + lastAnswer (we have recorded the result)
  localStorage.removeItem('lastPlayer');
  localStorage.removeItem('lastAnswer');

  // Move to next player
  pickNextPlayer();
}

///// Small utility to choose a random string
function chooseRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

///// Setup event handlers (called once)
function setupHandlers() {
  log('Attaching handlers');
  keypadButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // append digit
      answerDisplay.value = (answerDisplay.value || '') + btn.textContent;
    });
  });

  clearButton.addEventListener('click', () => {
    answerDisplay.value = '';
  });

  goButton.addEventListener('click', () => {
    handleSubmit();
  });

  // Also support Enter key for accessibility
  answerDisplay.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      handleSubmit();
    }
  });

  nextButton.addEventListener('click', () => {
    handleNext();
  });
}
// Also support Enter key for accessibility
answerDisplay.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') {
    handleSubmit();
  }
});

nextButton.addEventListener('click', () => {
  handleNext();
});

// ===== DEBUG: Fake end tester with wrong answers input =====
function setupFakeEndTester() {
  const totalQuestions = 54; // total number of quiz questions

  // Create container div
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.left = '20px';
  container.style.zIndex = 9999;
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '10px';
  document.body.appendChild(container);

  // Input field for number of wrong answers
  const wrongInput = document.createElement('input');
  wrongInput.type = 'number';
  wrongInput.min = '0';
  wrongInput.max = String(totalQuestions);
  wrongInput.value = '0';
  wrongInput.style.width = '60px';
  wrongInput.style.padding = '5px';
  wrongInput.style.fontWeight = 'bold';
  container.appendChild(wrongInput);

  // Fake end quiz button
  const btn = document.createElement('button');
  btn.textContent = 'FAKE END QUIZ';
  btn.style.padding = '10px';
  btn.style.backgroundColor = 'darkred';
  btn.style.color = 'white';
  btn.style.fontWeight = 'bold';
  btn.style.border = 'none';
  btn.style.cursor = 'pointer';
  container.appendChild(btn);

  btn.addEventListener('click', () => {
    let wrong = parseInt(wrongInput.value, 10);
    if (isNaN(wrong) || wrong < 0) wrong = 0;
    if (wrong > totalQuestions) wrong = totalQuestions;

    const score = totalQuestions - wrong;

    // Set localStorage for fake end
    localStorage.setItem('score', String(score));
    localStorage.setItem('questionsAsked', String(totalQuestions));
    localStorage.setItem('currentRoster', JSON.stringify([])); // empty pool → triggers redirect

    alert(`Fake end quiz set: ${score} / ${totalQuestions} (Wrong answers: ${wrong})`);

    // Redirect to end page immediately
    window.location.href = 'currentquizend.html';
  });
}

// ===== Kick off after DOM loaded =====
document.addEventListener('DOMContentLoaded', async () => {
  setupHandlers();          // normal keypad & next button handlers
  setupFakeEndTester();     // attach debug button + input
  await init();             // start quiz
});

///// Kick off after debug, uncomment:
//document.addEventListener('DOMContentLoaded', async () => {
  //setupHandlers();
  //await init();
//});