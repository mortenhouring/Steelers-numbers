// HOF quiz adapted from depth-quiz.js
///////////////////////////
// CONFIGURATION
///////////////////////////
const CONFIG = {
  // JSON source
  ROSTER_JSON: 'hof.json',

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
    PLAYER_IMAGE: 'player-image',
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

  // Question phrases (adapted if needed)
  QUESTION_PHRASES: [
    "Which jersey is associated with {player}?",
    "Who is {player}?",
    "Identify {player}.",
    "Which Hall of Famer is {player}?"
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

    // Filter out entries without a number
    loadedRoster = loadedRoster.filter(player => player.number !== null);
    log(`Fetched roster — ${loadedRoster.length} players (only entries with number)`);

    if(loadedRoster.length === 0) throw new Error('No players with numbers in roster');
  } catch(err){
    console.error('[hof-quiz] Could not fetch roster:',err);
    questionDisplay.textContent=`Error loading roster: ${err.message}`;
    showView('quiz1'); 
    return;
  }

  // Initialize working pool
  try {
    const rawSaved = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER);
    let saved = safeParseJSON(rawSaved);
    if(!Array.isArray(saved) || saved.length === 0){
      const fresh = [...loadedRoster];
      shuffleArray(fresh);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER, JSON.stringify(fresh));
      log('Saved fresh shuffled currentRoster to localStorage');
    } else {
      log(`Found existing pool — ${saved.length} players remain`);
    }

    let totalQ = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS), 10);
    if(isNaN(totalQ)){
      totalQ = loadedRoster.length;
      localStorage.setItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS, String(totalQ));
      log('Initialized totalQuestions', totalQ);
    } else {
      log('totalQuestions(from storage):', totalQ);
    }
    initialRosterCount = totalQ;
  } catch(err){
    console.error('[hof-quiz] Error init roster:',err);
    questionDisplay.textContent=`Error initializing roster: ${err.message}`;
    showView('quiz1'); 
    return; 
  }

  // Resume if lastPlayer & lastAnswer exist
  const lastPlayerRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  const lastAnswerRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ANSWER);
  if(lastPlayerRaw && lastAnswerRaw !== null){
    log('Resuming lastPlayer and lastAnswer found');
    try { 
      currentPlayer = safeParseJSON(lastPlayerRaw) || null; 
      showAnswerView(); 
      return; 
    } catch(err){ 
      console.warn('[hof-quiz] Could not parse lastPlayer',err); 
    }
  }

  pickNextPlayer();
}

///////////////////////////
// PICK NEXT PLAYER
///////////////////////////
function pickNextPlayer(){
  const raw=localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER);
  const pool=Array.isArray(safeParseJSON(raw))?safeParseJSON(raw):[];
  log('pickNextPlayer pool length before pick=',pool.length);
  if(pool.length===0){ 
    log('No players left; redirecting'); 
    const score = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.SCORE), 10) || 0;
    const total = parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS), 10) || 0;
    saveScore("hof", score, total);
    window.location.href=CONFIG.END_PAGE; 
    return; 
  }
  currentPlayer=pool.shift();
  localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER,JSON.stringify(pool));
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_PLAYER,JSON.stringify(currentPlayer));
  answerDisplay.value='';

  const phrase=chooseRandom(CONFIG.QUESTION_PHRASES).replace('{player}',currentPlayer.player_name);
  questionDisplay.textContent=phrase;

  showView('quiz1');
  log(`Picked player ${currentPlayer.player_name}, remaining=${pool.length}`);
}

///////////////////////////
// SUBMIT
///////////////////////////
function handleSubmit(){
  const raw=answerDisplay.value.trim();
  if(raw.length===0) return;
  const userAnswer=parseInt(raw,10);
  if(isNaN(userAnswer)) return;
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ANSWER,String(userAnswer));

  let questionsAsked=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED),10); if(isNaN(questionsAsked)) questionsAsked=0; questionsAsked+=1;
  let score=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.SCORE),10); if(isNaN(score)) score=0;

  localStorage.setItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED,String(questionsAsked));
  localStorage.setItem(CONFIG.STORAGE_KEYS.SCORE,String(score));

  log(`Answer submitted for player ${currentPlayer?.player_name}`);
  showAnswerView();
}

///////////////////////////
// SHOW ANSWER / TRIVIA
///////////////////////////
function showAnswerView(){
  const rawLast=localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  const last=safeParseJSON(rawLast)||currentPlayer;
  if(!last){ feedbackEl.textContent='Player not found.'; showView('quiz1