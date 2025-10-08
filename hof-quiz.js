// HOF quiz
// template from depth-quiz.js
// Single-page quiz controller adapted for hof.json
// All configurable paths, filenames, HTML IDs, and localStorage keys
// are defined at the top for easy modification.

///////////////////////////
// CONFIGURATION
///////////////////////////
const CONFIG = {
  // JSON
  ROSTER_JSON: 'hof.json',          // hof roster source

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
    PLAYER_IMAGE: 'hof-player-image',
    PLAYER_INFO: 'player-info',
    PLAYER_TRIVIA: 'player-trivia',
    SCORE: 'score',
    REMAINING: 'remaining',
    KEYPAD_BUTTONS_CLASS: 'num'
  },

  // LocalStorage keys
  STORAGE_KEYS: {
    CURRENT_ROSTER: 'hof-currentRoster',
    TOTAL_QUESTIONS: 'hof-totalQuestions',
    LAST_PLAYER: 'hof-lastPlayer',
    LAST_ANSWER: 'hof-lastAnswer',
    QUESTIONS_ASKED: 'hof-questionsAsked',
    SCORE: 'hof-score'
  },

  // End page
  END_PAGE: 'hof-quiz-end.html',

  // Question phrases
  QUESTION_PHRASES: [
    "What number did {player} wear?",
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
const playerImageEl = document.getElementById(ids.PLAYER_IMAGE);
const playerInfoEl = document.getElementById(ids.PLAYER_INFO);
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
function debugMsg(msg) {
  let el = document.getElementById('debug-log');
  if (!el) {
    el = document.createElement('div');
    el.id = 'debug-log';
    el.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;background:#111;color:#0f0;padding:5px;font-size:12px;z-index:9999;';
    document.body.appendChild(el);
  }
  el.innerText = msg;
}

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

  playerImageEl.src = currentPlayer.image || '';
  playerInfoEl.textContent = `${currentPlayer.player_name} - ${currentPlayer.position ?? ''}`;

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

  // --- Trivia display logic ---
  const triviaText = currentPlayer.trivia || "";
  if (triviaText.trim().length > 0) {
    // Split paragraphs by \n\n\
    const paragraphs = triviaText.split("\\n\\n\\");
    const first = paragraphs[0] || "";
    const second = paragraphs[1] || "";
    const firstTwo = [first, second].filter(Boolean).join("\n\n");
    const shouldShowTwo = firstTwo.length <= 450;

    let displayText = shouldShowTwo ? firstTwo : first;
    playerTriviaEl.textContent = displayText;

    // Add "read more" if there are extra paragraphs beyond shown ones
    if (paragraphs.length > (shouldShowTwo ? 2 : 1)) {
      const readMoreBtn = document.createElement("button");
      readMoreBtn.textContent = "Read more";
      readMoreBtn.className = "read-more-btn";
      readMoreBtn.addEventListener("click", () => {
        playerTriviaEl.textContent = paragraphs.join("\n\n");
        readMoreBtn.remove();
      });
      playerTriviaEl.appendChild(readMoreBtn);
    }
  } else {
    playerTriviaEl.textContent = "No trivia available.";
  }

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

///////////////////////////
// KEYPAD & INPUT LOGIC
///////////////////////////

// Unified input handler for numeric buttons
keypadButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const val = btn.textContent.trim();
    if(!val) return;
    answerDisplay.value += val;
    console.log('[hof-quiz] Keypad input:', val, 'Current answer:', answerDisplay.value);
  });
});

// Clear button
clearButton.addEventListener("click", () => {
  answerDisplay.value = "";
  console.log('[hof-quiz] Cleared input');
});

// Go button
goButton.addEventListener("click", () => {
  console.log('[hof-quiz] Go button clicked. Current player:', currentPlayer);
  
  if(!currentPlayer){
    alert("No player loaded yet. Please wait.");
    return;
  }

  const raw = answerDisplay.value.trim();
  if(raw.length === 0){
    alert("Please enter a number using the keypad.");
    return;
  }

  const userAnswer = parseInt(raw, 10);
  if(isNaN(userAnswer)){
    alert("Invalid number. Please use the keypad.");
    return;
  }

  // Save last answer before showing feedback
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ANSWER, String(userAnswer));
  console.log(`[hof-quiz] Submitted answer: ${userAnswer} for player ${currentPlayer.player_name}`);

  // Increment counters
  let questionsAsked = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED),10) || 0;
  questionsAsked += 1;
  localStorage.setItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED, String(questionsAsked));

  let score = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.SCORE),10) || 0;
  const correctNumber = Number(currentPlayer?.number ?? NaN);
  if(!isNaN(correctNumber) && userAnswer === correctNumber) score += 1;
  localStorage.setItem(CONFIG.STORAGE_KEYS.SCORE, String(score));

  showAnswerView();
});
///////////////////////////
// DOM
///////////////////////////
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[hof-quiz] DOMContentLoaded fired → setupHandlers() starting...');
    setupHandlers();
    console.log('[hof-quiz] setupHandlers() done → init() starting...');
    await init();
    console.log('[hof-quiz] init() done ✅');
});