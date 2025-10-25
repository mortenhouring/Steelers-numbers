//  roster-quiz.js v2 WORKING 19/10/25 00:36
// Single-page quiz controller adapted for hof.json
// All configurable paths, filenames, HTML IDs, and localStorage keys
// are defined at the top for easy modification.

///////////////////////////
// CONFIGURATION
///////////////////////////
const CONFIG = {
  // JSON
  ROSTER_JSON: 'roster.json',          // hof roster source

  // HTML element IDs
  ELEMENT_IDS: {
    QUIZ1_VIEW: 'quiz1-view',
    QUIZ2_VIEW: 'quiz2-view',
    QUESTION_DISPLAY: 'player-name',
    ANSWER_DISPLAY: 'answer-display',
    GO_BUTTON: 'go-button',
    CLEAR_BUTTON: 'clear-button',
    NEXT_BUTTON: 'next-button',
    FEEDBACK: 'feedback',
    PLAYER_IMAGE: 'roster-player-image',
    PLAYER_INFO: 'player-info',
    PLAYER_TRIVIA: 'player-trivia',
    SCORE: 'score',
    REMAINING: 'remaining',
    KEYPAD_BUTTONS_CLASS: 'num'
  },

  // LocalStorage keys
  STORAGE_KEYS: {
    CURRENT_ROSTER: 'roster-currentRoster',
    TOTAL_QUESTIONS: 'roster-totalQuestions',
    LAST_PLAYER: 'roster-lastPlayer',
    LAST_ANSWER: 'roster-lastAnswer',
    QUESTIONS_ASKED: 'roster-questionsAsked',
    SCORE: 'roster-score'
  },

  // End page
  END_PAGE: 'roster-quiz-end.html',

  // Question phrases
  QUESTION_PHRASES: [
    "What number is {player}?",
    "Which digits are on {player}'s jersey?",
    "Which number’s on {player}'s back?",
    "What’s {player}'s Steel Curtain number?",
    "What jersey number is {player}?",
    "Which digits does {player} rep for Steelers Nation?",
    "What’s {player}'s jersey number?",
    "What number’s on {player}'s helmet stripe?",
    "Which jersey number does {player} wear?",
    "What number’s stitched on {player}'s uniform?"
  ]
};

///////////////////////////
// PREFILL QUIZ2 ELEMENTS (WITHOUT FEEDBACK)
///////////////////////////
function prefillQuiz2Elements(player) {
  if (!player) return;

  // --- Player image (sync both quiz1/quiz2 views) ---
updatePlayerImages(player['espn-image'] || player.image || '');
  
  const lazyImageEl = document.getElementById('lazy-image');
  if (lazyImageEl) lazyImageEl.src = player['lazyimage'] || '';

  // --- Quiz2 player name ---
  const quiz2PlayerNameEl = document.getElementById('quiz2-player-name');
  if (quiz2PlayerNameEl) quiz2PlayerNameEl.textContent = player.player_name || '';

  // --- Player overlay ---
  const overlayEl = document.getElementById('player-overlay');
  if (overlayEl) {
    const num = player.number ?? '';
    const pos = player.position ?? '';
    overlayEl.textContent = `#${num || '—'} ${pos || ''}`;
  }

  // --- Player info ---
  if (playerInfoEl) {
    if (player.info) {
      playerInfoEl.innerHTML = player.info
        .split('|')
        .map(item => item.trim())
        .join('<br>');
    } else {
      playerInfoEl.textContent = `${player.player_name} - ${player.position ?? ''}`;
    }
  }

  // --- Trivia ---
  const triviaObj = player.trivia || {};
  let triviaHTML = "";
  const renderParagraphs = arr => arr.map(p => `<p>${p}</p>`).join("");

  if (Array.isArray(triviaObj.pro_career)) triviaHTML += `<h3>Pro Career</h3>` + renderParagraphs(triviaObj.pro_career);
  if (Array.isArray(triviaObj.career_highlights_regular)) triviaHTML += `<h3>Career Highlights (Regular)</h3>` + renderParagraphs(triviaObj.career_highlights_regular);
  if (Array.isArray(triviaObj.career_highlights_post)) triviaHTML += `<h3>Career Highlights (Postseason)</h3>` + renderParagraphs(triviaObj.career_highlights_post);
  if (!triviaHTML) triviaHTML = "<p>No trivia available.</p>";
  playerTriviaEl.innerHTML = triviaHTML;
  // --- Stats
  const playerStatsEl = document.getElementById('player-stats');
if (playerStatsEl) {
  const statsArr = Array.isArray(player.stats) ? player.stats : [];
  if (statsArr.length) {
    playerStatsEl.innerHTML = statsArr.map(s => (s+'').trim()).join('<br>');
    playerStatsEl.style.display = 'block';
  } else {
    playerStatsEl.innerHTML = '';
    playerStatsEl.style.display = 'none';
  }
}
  // --- Achievements ---
  const achievementsBox = document.getElementById('player-achievements');
  if (achievementsBox) {
    const achArr = Array.isArray(player?.achievements) ? player.achievements : [];
    achievementsBox.innerHTML = achArr.length ? achArr.map(a => a.trim()).join('<br>') : '';
    achievementsBox.style.display = achArr.length ? 'block' : 'none';
  }
  // --- Player stats ---
const statsEl = document.getElementById('player-stats');
if (statsEl) {
  const statsArr = Array.isArray(player.stats) ? player.stats : [];

  // Keep only stats with a label and a non-zero/non-- value
  const visibleStats = statsArr.filter(s => s.label && s.value && s.value !== "0" && s.value !== "--");

  if (visibleStats.length) {
    statsEl.innerHTML = visibleStats
      .map(s => `<span>${s.label.trim()}: ${s.value.trim()}</span>`)
      .join('');
    statsEl.style.display = 'flex';
  } else {
    statsEl.innerHTML = '';
    statsEl.style.display = 'none';
  }
}
  // --- Scoreboard (correct / incorrect) ---
const scoreboardcorrectvalue = document.getElementById('scoreboardcorrectvalue');
const scoreboardincorrectvalue = document.getElementById('scoreboardincorrectvalue');
// Populate values from localStorage (or 0 if not set)
if (scoreboardcorrectvalue) {
  scoreboardcorrectvalue.textContent = parseInt(localStorage.getItem('correctAnswers'), 10) || 0;
}
if (scoreboardincorrectvalue) {
  scoreboardincorrectvalue.textContent = parseInt(localStorage.getItem('incorrectAnswers'), 10) || 0;
}
///////////////////////////
// ELEMENTS
///////////////////////////
const playerStatsEl = document.getElementById('player-stats'); //#player-stats
const ids = CONFIG.ELEMENT_IDS;
const quiz1View = document.getElementById(ids.QUIZ1_VIEW);
const quiz2View = document.getElementById(ids.QUIZ2_VIEW);
const questionDisplay = document.getElementById(ids.QUESTION_DISPLAY);
const answerDisplay = document.getElementById(ids.ANSWER_DISPLAY);
const goButton = document.getElementById(ids.GO_BUTTON);
const clearButton = document.getElementById(ids.CLEAR_BUTTON);
const nextButton = document.getElementById(ids.NEXT_BUTTON);
const keypadButtons = document.querySelectorAll(`.${ids.KEYPAD_BUTTONS_CLASS}`);
const feedbackEl = document.getElementById(ids.FEEDBACK);
// Both quiz1 and quiz2 have roster-player-image — keep them synced
const playerImageEls = document.querySelectorAll(`#${ids.PLAYER_IMAGE}`)
const playerInfoEl = document.getElementById(ids.PLAYER_INFO) || null;
const playerTriviaEl = document.getElementById(ids.PLAYER_TRIVIA);
const scoreEl = document.getElementById(ids.SCORE);
const remainingEl = document.getElementById(ids.REMAINING);
// scoreboard
const correctEls = document.querySelectorAll('.scoreboard-value.correct');
const incorrectEls = document.querySelectorAll('.scoreboard-value.incorrect');
const scoreboardMiddle = document.querySelector('.scoreboard-middle'); // optional
//////////////////////////
// STATE
///////////////////////////
let currentPlayer = null;
let initialRosterCount = 0;

///////////////////////////
// UTILITY FUNCTIONS
///////////////////////////
function updatePlayerImages(src) {
  playerImageEls.forEach(img => {
    if (img && src && img.src !== src) img.src = src;
  });
}
//Scoreboard//
function updateScoreboard() {
  const correct = parseInt(localStorage.getItem('correctAnswers'), 10) || 0;
  const wrong = parseInt(localStorage.getItem('incorrectAnswers'), 10) || 0;

  correctEls.forEach(el => el.textContent = correct);
  incorrectEls.forEach(el => el.textContent = wrong);
}
// ---------//
function log(...args) { console.log('[hof-quiz]', ...args); }
function safeParseJSON(raw) { try { return JSON.parse(raw); } catch { return null; } }
function shuffleArray(arr) { for (let i = arr.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } }
function showView(viewId) {
  if (viewId === 'quiz1') {
    quiz1View.style.display='block';
    quiz2View.style.display='none';
    quiz1View.setAttribute('aria-hidden','false');
    quiz2View.setAttribute('aria-hidden','true');
  } else {
    quiz1View.style.display='none';
    quiz2View.style.display='block';
    quiz1View.setAttribute('aria-hidden','true');
    quiz2View.setAttribute('aria-hidden','false');
  }
}
function chooseRandom(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

///////////////////////////
// SAVE SCORE TO LEADERBOARD
///////////////////////////
function saveScore(mode, correctAnswers, totalQuestions) {
  const d = new Date();
  const options = { month: "short", day: "numeric" };
  const dateStr = `${d.toLocaleDateString("en-US", options)} '${String(d.getFullYear()).slice(-2)}`;

  const leaderboard = JSON.parse(localStorage.getItem("leaderboard")) || {};
  if (!leaderboard[mode]) leaderboard[mode] = [];

  const entry = { date: dateStr, score: correctAnswers, total: totalQuestions };

  leaderboard[mode].push(entry);
  leaderboard[mode].sort((a, b) => (b.score / b.total) - (a.score / a.total));
  leaderboard[mode] = leaderboard[mode].slice(0, 3);

  localStorage.setItem("leaderboard", JSON.stringify(leaderboard));
}

///////////////////////////
// INIT
///////////////////////////
async function init() {
    console.log('Quiz init started');

    // Wait for DOM
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            document.addEventListener('DOMContentLoaded', resolve);
        });
        console.log('DOM fully loaded');
    }

    // Load roster.json
    try {
        const resp = await fetch(CONFIG.ROSTER_JSON, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        window.loadedRoster = data;
        console.log('Roster loaded:', loadedRoster.length, 'players');
    } catch (e) {
        console.error('Failed to load roster.json:', e);
        const el = document.getElementById('quiz1-view');
        if (el) el.innerHTML = '<p style="color:red">Failed to load roster. Please reload the page.</p>';
        return;
    }

    // ✅ Initialize localStorage roster if empty or invalid
    let storedRoster = safeParseJSON(localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER));
    if (!Array.isArray(storedRoster) || storedRoster.length === 0) {
        console.log('Initializing roster-currentRoster from loadedRoster');
        localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER, JSON.stringify([...loadedRoster]));
        storedRoster = [...loadedRoster];
    }

    window.currentRoster = storedRoster;
    console.log('Current roster ready, length:', currentRoster.length);

    // Pick first player
    try {
        window.currentPlayer = pickNextPlayer();
        console.log('First player selected:', currentPlayer?.player_name || '(name missing)');
    } catch (e) {
        console.error('Error picking first player:', e);
        return;
    }

    // Update UI
    try {
        prefillQuiz2Elements(currentPlayer);
        console.log('UI initialized successfully');
    } catch (e) {
        console.error('Error updating UI:', e);
    }

    updateScoreboard();
    console.log('Quiz init complete ✅');
}

// Call init
init();

///////////////////////////
// PICK NEXT PLAYER
///////////////////////////
function pickNextPlayer(){
  const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER);
  const pool = Array.isArray(safeParseJSON(raw)) ? safeParseJSON(raw) : [];
  log('pickNextPlayer pool length before pick=', pool.length);

  if(pool.length === 0){
    log('No players left; redirecting');
    const score = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.SCORE), 10) || 0;
    const total = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS), 10) || 0;
    saveScore("hof", score, total);
    window.location.href = CONFIG.END_PAGE;
    return;
  }

  currentPlayer = pool.shift();
  localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER, JSON.stringify(pool));
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_PLAYER, JSON.stringify(currentPlayer));
  answerDisplay.value='';

  const phrase = chooseRandom(CONFIG.QUESTION_PHRASES).replace('{player}', currentPlayer.player_name);
  questionDisplay.textContent = phrase;
  //new line for quiz2 preload:
prefillQuiz2Elements(currentPlayer)
  //
  showView('quiz1');
  log(`Picked player ${currentPlayer.player_name}, remaining=${pool.length}`);
}

///////////////////////////
// SUBMIT
///////////////////////////
function handleSubmit() {
  const raw = answerDisplay.value.trim();
  if (raw.length === 0) return;
  const userAnswer = parseInt(raw, 10);
  if (isNaN(userAnswer)) return;

  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ANSWER, String(userAnswer));

  // total questions answered
  let questionsAsked = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED), 10);
  if (isNaN(questionsAsked)) questionsAsked = 0;
  questionsAsked += 1;
  localStorage.setItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED, String(questionsAsked));

  const correctNumber = Number(currentPlayer?.number ?? NaN);

  // previous counts
  let correct = parseInt(localStorage.getItem('correctAnswers'), 10);
  if (isNaN(correct)) correct = 0;
  let wrong = parseInt(localStorage.getItem('incorrectAnswers'), 10);
  if (isNaN(wrong)) wrong = 0;

  if (!isNaN(correctNumber) && correctNumber === userAnswer) {
    correct += 1;
    localStorage.setItem('correctAnswers', String(correct));
  } else {
    wrong += 1;
    localStorage.setItem('incorrectAnswers', String(wrong));
  }

  // update scoreboard in all views
  updateScoreboard();

  log(`Answer submitted for player ${currentPlayer?.player_name}: guess=${userAnswer} correct=${correctNumber === userAnswer}`);
  showAnswerView();
}

///////////////////////////
// SHOW ANSWER / TRIVIA
///////////////////////////
function showAnswerView(){
  const rawLast = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  const last = safeParseJSON(rawLast) || currentPlayer;
  if(!last){ 
    feedbackEl.textContent='Player not found.'; 
    showView('quiz1'); 
    return; 
  }

  currentPlayer = last;

  // --- Populate quiz2 elements (images, name, overlay, info, trivia, achievements, score/remaining) ---
  prefillQuiz2Elements(currentPlayer);

  // --- Feedback based on stored answer ---
  const storedAnswer = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ANSWER),10);
  const correctNumber = Number(currentPlayer?.number ?? NaN);

  if(!isNaN(correctNumber) && storedAnswer === correctNumber) {
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
      "Close, but no.",
      "Missed it.",
      "Incorrect this time."
    ]);
  }

  // --- Show quiz2 view ---
  showView("quiz2");
}

///////////////////////////
// EVENT LISTENERS
///////////////////////////

// Keypad numeric input
keypadButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const val = btn.textContent.trim();
    answerDisplay.value += val;
  });
});

// Clear button
clearButton.addEventListener("click", () => {
  answerDisplay.value = "";
});

// Go button
goButton.addEventListener("click", handleSubmit);

// Next button
nextButton.addEventListener("click", () => {
  localStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_ANSWER);
  pickNextPlayer();
});
// show/hide bottom gradient for the trivia scroll area
window.addEventListener("DOMContentLoaded", () => {
  const inner = document.getElementById('hof-trivia-inner');   // scrollable content
  const gradient = document.getElementById('scroll-gradient'); // the overlay gradient
  if (!inner || !gradient) return; // nothing to do if either element missing

  let scrollTimeout = null;

  // small helper: is there vertical overflow (enough to scroll)?
  const hasOverflow = () => inner.scrollHeight > inner.clientHeight + 1;

  // initial state: show gradient only if content overflows
  gradient.style.opacity = hasOverflow() ? '1' : '0';

  function onScroll() {
    // hide while the user is actively scrolling
    gradient.style.opacity = '0';

    // reset debounce timer
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      // compute distance from bottom after scroll settles
      const scrollBottom = inner.scrollHeight - inner.scrollTop - inner.clientHeight;

      // show gradient only if there is content below (small threshold)
      gradient.style.opacity = (scrollBottom > 2) ? '1' : '0';
    }, 250); // 250ms after scroll stops -> adjust if you want faster/slower
  }

  // attach scroll listener (passive improves performance)
  inner.addEventListener('scroll', onScroll, { passive: true });

  // Observe size/content changes so the gradient updates if trivia is injected later.
  // These are optional but make the behavior robust.
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      gradient.style.opacity = hasOverflow() ? '1' : '0';
    });
    ro.observe(inner);
  } else {
    // fallback: re-check on window resize
    window.addEventListener('resize', () => {
      gradient.style.opacity = hasOverflow() ? '1' : '0';
    }, { passive: true });
  }

  if (window.MutationObserver) {
  const mo = new MutationObserver(() => {
    inner.scrollTop = 0; // instantly jump to top
    gradient.style.opacity = hasOverflow() ? '1' : '0';
  });
  mo.observe(inner, { childList: true, subtree: true, characterData: true });
}
});
// Initialize once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  init();
  updateScoreboard();
});