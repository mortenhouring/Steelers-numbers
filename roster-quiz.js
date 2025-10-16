//  roster-quiz.js WORKING 15/10/25 17:28
// template from depth-quiz.js
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
// ELEMENTS
///////////////////////////
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
const playerImageEl = document.getElementById(ids.PLAYER_IMAGE) || null;
const playerInfoEl = document.getElementById(ids.PLAYER_INFO) || null;
const playerTriviaEl = document.getElementById(ids.PLAYER_TRIVIA);
const scoreEl = document.getElementById(ids.SCORE);
const remainingEl = document.getElementById(ids.REMAINING);

///////////////////////////
// STATE
///////////////////////////
let currentPlayer = null;
let initialRosterCount = 0;

///////////////////////////
// UTILITY FUNCTIONS
///////////////////////////
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
  log('init() start');

  // Load roster JSON
  let loadedRoster = [];
  try {
    const resp = await fetch(CONFIG.ROSTER_JSON,{cache:'no-store'});
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    loadedRoster = await resp.json();
    if(!Array.isArray(loadedRoster)||loadedRoster.length===0) throw new Error('Roster not a non-empty array');

    // Filter out null-number entries
    loadedRoster = loadedRoster.filter(player => player.number !== null);
    log(`Fetched roster — ${loadedRoster.length} players`);
    log('Players loaded:', loadedRoster.map(p => p.player_name));
  } catch(err){
    console.error('[hof-quiz] Could not fetch roster:',err);
    questionDisplay.textContent=`Error loading roster: ${err.message}`;
    showView('quiz1'); return;
  }

  // Initialize working pool
  try {
    const rawSaved = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER);
    let saved = safeParseJSON(rawSaved);
    if(!Array.isArray(saved)||saved.length===0){
      const fresh = [...loadedRoster];
      shuffleArray(fresh);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER, JSON.stringify(fresh));
      log('Saved fresh shuffled currentRoster to localStorage');
    } else log(`Found existing pool — ${saved.length} players remain`);

    let totalQ=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS),10);
    if(isNaN(totalQ)){ totalQ=loadedRoster.length; localStorage.setItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS,String(totalQ)); log('Initialized totalQuestions',totalQ);}
    else log('totalQuestions(from storage):',totalQ);
    initialRosterCount=totalQ;
  } catch(err){ console.error('[hof-quiz] Error init roster:',err); questionDisplay.textContent=`Error initializing roster: ${err.message}`; showView('quiz1'); return; }

  // Resume if lastPlayer & lastAnswer exist
  const lastPlayerRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  const lastAnswerRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ANSWER);
  if(lastPlayerRaw && lastAnswerRaw !== null){
    log('Resuming lastPlayer and lastAnswer found');
    try { currentPlayer = safeParseJSON(lastPlayerRaw) || null; showAnswerView(); return; }
    catch(err){ console.warn('[hof-quiz] Could not parse lastPlayer',err); }
  }

  pickNextPlayer();
}

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

  showView('quiz1');
  log(`Picked player ${currentPlayer.player_name}, remaining=${pool.length}`);
}

///////////////////////////
// SUBMIT
///////////////////////////
function handleSubmit(){
  const raw = answerDisplay.value.trim();
  if(raw.length===0) return;
  const userAnswer = parseInt(raw,10);
  if(isNaN(userAnswer)) return;
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ANSWER,String(userAnswer));

  let questionsAsked=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED),10); if(isNaN(questionsAsked)) questionsAsked=0; questionsAsked+=1;
  let score=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.SCORE),10); if(isNaN(score)) score=0;
  const correctNumber=Number(currentPlayer?.number ?? NaN);
  if(!isNaN(correctNumber) && correctNumber===userAnswer) score+=1;
  localStorage.setItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED,String(questionsAsked));
  localStorage.setItem(CONFIG.STORAGE_KEYS.SCORE,String(score));

  log(`Answer submitted for player ${currentPlayer?.player_name}: guess=${userAnswer} correct=${correctNumber===userAnswer}`);
  showAnswerView();
}

///////////////////////////
// SHOW ANSWER / TRIVIA
///////////////////////////
function showAnswerView(){
  const rawLast = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  const last = safeParseJSON(rawLast) || currentPlayer;
  if(!last){ feedbackEl.textContent='Player not found.'; showView('quiz1'); return; }
  currentPlayer = last;

  // --- Player image and info ---
if (playerImageEl) {
  playerImageEl.src = currentPlayer.image || '';
}
// --- Player overlay (number & position) ---
const overlayEl = document.getElementById('player-overlay');
if (overlayEl && currentPlayer) {
  const num = currentPlayer.number ?? '';
  const pos = currentPlayer.position ?? '';
  overlayEl.textContent = `#${num || '—'} ${pos || ''}`;
}
if (playerInfoEl) {
  if (currentPlayer.info) {
    // Format the pipe-delimited info into line breaks
    playerInfoEl.innerHTML = currentPlayer.info
      .split('|')
      .map(item => item.trim())
      .join('<br>');
  } else {
    // Fallback if no info available
    playerInfoEl.textContent = `${currentPlayer.player_name} - ${currentPlayer.position ?? ''}`;
  }
}

  const storedAnswer = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ANSWER),10);
  const correctNumber = Number(currentPlayer?.number ?? NaN);
  if(!isNaN(correctNumber) && storedAnswer===correctNumber)
    feedbackEl.textContent = chooseRandom(["Nice job!","That's right!","You got it!","Exactly!","Spot on!","Great work!","Correct!"]);
    else {
    feedbackEl.textContent = chooseRandom([
      "Oops, try again.",
      "Not quite.",
      "Wrong number.",
      "Close, but no.",
      "Missed it.",
      "Incorrect this time."
    ]);
  }
// Achievements box logic
const achievementsBox = document.getElementById('player-achievements');
if (achievementsBox) {
  if (currentPlayer.achievements && currentPlayer.achievements.trim() !== '') {
    achievementsBox.textContent = currentPlayer.achievements;
    achievementsBox.style.display = 'block';
  } else {
    achievementsBox.style.display = 'none';
  }
}
// --- Trivia display logic ---
const triviaObj = currentPlayer.trivia || {};
let triviaHTML = "";

// Helper to render an array of strings as <p> paragraphs
function renderParagraphs(arr) {
  return arr.map(p => `<p>${p}</p>`).join("");
}

// Order: pro_career, career_highlights_regular, career_highlights_post
if (Array.isArray(triviaObj.pro_career) && triviaObj.pro_career.length > 0) {
  triviaHTML += `<h3>Pro Career</h3>` + renderParagraphs(triviaObj.pro_career);
}

if (Array.isArray(triviaObj.career_highlights_regular) && triviaObj.career_highlights_regular.length > 0) {
  triviaHTML += `<h3>Career Highlights (Regular)</h3>` + renderParagraphs(triviaObj.career_highlights_regular);
}

if (Array.isArray(triviaObj.career_highlights_post) && triviaObj.career_highlights_post.length > 0) {
  triviaHTML += `<h3>Career Highlights (Postseason)</h3>` + renderParagraphs(triviaObj.career_highlights_post);
}

// Fallback if no trivia
if (!triviaHTML) triviaHTML = "<p>No trivia available.</p>";

playerTriviaEl.innerHTML = triviaHTML;

  // Update score and remaining
  const score = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.SCORE), 10) || 0;
  const total = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS), 10) || 0;
  const pool = safeParseJSON(localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER)) || [];
  const remaining = pool.length;

  scoreEl.textContent = `Score: ${score}/${total}`;
  remainingEl.textContent = `Remaining: ${remaining}`;

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
window.addEventListener("DOMContentLoaded", init);