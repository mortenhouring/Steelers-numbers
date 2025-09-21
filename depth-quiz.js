//DEPTH quiz//
// template from one-page-quiz.js
// Single-page quiz controller template
// All configurable paths, filenames, HTML IDs, and localStorage keys
// are defined at the top for easy modification.

///////////////////////////
// CONFIGURATION - CHANGE THESE
///////////////////////////
const CONFIG = {
  // JSON & Trivia module
  ROSTER_JSON: 'depth-roster.json',          // roster source
  TRIVIA_MODULE_PATH: './main-trivia-shuffle.js', // path to trivia JS module

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
    GIANT_NUMBER: 'giant-number',
    PLAYER_INFO: 'player-info',
    PLAYER_TRIVIA: 'player-trivia',
    SCORE: 'score',
    REMAINING: 'remaining',
    KEYPAD_BUTTONS_CLASS: 'num'
  },

  // LocalStorage keys
  STORAGE_KEYS: {
    CURRENT_ROSTER: 'depth-currentRoster',
    TOTAL_QUESTIONS: 'depth-totalQuestions',
    LAST_PLAYER: 'depth-lastPlayer',
    LAST_ANSWER: 'depth-lastAnswer',
    QUESTIONS_ASKED: 'depth-questionsAsked',
    SCORE: 'depth-score'
  },

  // End page
  END_PAGE: 'depth-quiz-end.html',

  // Question phrases
  QUESTION_PHRASES: [
    "What number is {player}?",
    "Which digits are on {player}'s jersey?",
    "Which number’s on {player}'s back?",
    "What’s {player}'s Steel Curtain number?",
    "What jersey number is {player}?",
    "What digits does {player} rep for Steelers Nation?",
    "What’s {player}'s jersey number?",
    "What number’s on {player}'s helmet stripe?",
    "Which jersey number does {player} wear?",
    "What number’s stitched on {player}'s uniform?"
  ]
};

///////////////////////////
// IMPORT TRIVIA MODULE
///////////////////////////
import { loadTrivia } from './main-trivia-shuffle.js';

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
const giantNumberEl = document.getElementById(ids.GIANT_NUMBER);
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
function log(...args) { console.log('[one-page-quiz]', ...args); }
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
// INIT
///////////////////////////
async function init() {
  log('init() start');

  // Load trivia
  try { await loadTrivia(); log('Trivia module loaded'); }
  catch(err){ console.error('[one-page-quiz] loadTrivia() failed:',err); }

  // Load roster JSON
  let loadedRoster = [];
  try {
    const resp = await fetch(CONFIG.ROSTER_JSON,{cache:'no-store'});
    if(!resp.ok) throw new Error(`HTTP ${resp.status}`);
    loadedRoster = await resp.json();
    if(!Array.isArray(loadedRoster)||loadedRoster.length===0) throw new Error('Roster not a non-empty array');
    log(`Fetched roster — ${loadedRoster.length} players`);
  } catch(err){
    console.error('[one-page-quiz] Could not fetch roster:',err);
    questionDisplay.textContent=`Error loading roster: ${err.message}`;
    showView('quiz1'); return;
  }

  // Initialize working pool
  try {
    const rawSaved=localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER);
    let saved=safeParseJSON(rawSaved);
    if(!Array.isArray(saved)||saved.length===0){
      const fresh=[...loadedRoster];
      shuffleArray(fresh);
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER,JSON.stringify(fresh));
      log('Saved fresh shuffled currentRoster to localStorage');
    } else log(`Found existing pool — ${saved.length} players remain`);

    let totalQ=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS),10);
    if(isNaN(totalQ)){ totalQ=loadedRoster.length; localStorage.setItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS,String(totalQ)); log('Initialized totalQuestions',totalQ);}
    else log('totalQuestions(from storage):',totalQ);
    initialRosterCount=totalQ;
  } catch(err){ console.error('[one-page-quiz] Error init roster:',err); questionDisplay.textContent=`Error initializing roster: ${err.message}`; showView('quiz1'); return; }

  // Resume if lastPlayer & lastAnswer exist
  const lastPlayerRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  const lastAnswerRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ANSWER);
  if(lastPlayerRaw && lastAnswerRaw !== null){
    log('Resuming lastPlayer and lastAnswer found');
    try { currentPlayer=safeParseJSON(lastPlayerRaw)||null; showAnswerView(); return; }
    catch(err){ console.warn('[one-page-quiz] Could not parse lastPlayer',err); }
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
  if(pool.length===0){ log('No players left; redirecting'); window.location.href=CONFIG.END_PAGE; return; }
  currentPlayer=pool.shift();
  localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER,JSON.stringify(pool));
  localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_PLAYER,JSON.stringify(currentPlayer));
  answerDisplay.value='';

  const phrase=chooseRandom(CONFIG.QUESTION_PHRASES).replace('{player}',currentPlayer.player_name);
  questionDisplay.textContent=phrase;

  showView('quiz1');
  log(`Picked player ${currentPlayer.player_id} - ${currentPlayer.player_name}, remaining=${pool.length}`);
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
  const correctNumber=Number(currentPlayer?.number ?? NaN);
  if(!isNaN(correctNumber) && correctNumber===userAnswer) score+=1;
  localStorage.setItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED,String(questionsAsked));
  localStorage.setItem(CONFIG.STORAGE_KEYS.SCORE,String(score));

  log(`Answer submitted for player ${currentPlayer?.player_id}: guess=${userAnswer} correct=${correctNumber===userAnswer}`);
  showAnswerView();
}

///////////////////////////
// SHOW ANSWER / TRIVIA
///////////////////////////
function showAnswerView(){
  const rawLast=localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  const last=safeParseJSON(rawLast)||currentPlayer;
  if(!last){ feedbackEl.textContent='Player not found.'; showView('quiz1'); return; }
  currentPlayer=last;

  playerImageEl.src=currentPlayer.player_image||'';
  giantNumberEl.textContent=currentPlayer.number??'';
  playerInfoEl.textContent=`${currentPlayer.player_name} - ${currentPlayer.position??''}`;

  const storedAnswer=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_ANSWER),10);
  const correctNumber=Number(currentPlayer?.number ?? NaN);
  if(!isNaN(correctNumber) && storedAnswer===correctNumber)
    feedbackEl.textContent=chooseRandom(["Nice job!","That's right!","You got it!","Exactly!","Spot on!","Great work!","Correct!"]);
  else
    feedbackEl.textContent=chooseRandom(["Oops, try again.","Not quite.","Wrong number.","Almost, keep going.","Try once more.","Incorrect, keep going."]);

  let triviaRes={paragraph:'',selectedStrings:[],debug:null};
  try{
    const res=generateTriviaParagraph(currentPlayer.player_id);
    triviaRes=res??triviaRes;
    playerTriviaEl.textContent=(triviaRes.paragraph||'').trim();
  } catch(err){ console.error('[one-page-quiz] Error generating trivia paragraph:',err); playerTriviaEl.textContent=''; }

  let totalQuestions=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS),10);
  if(isNaN(totalQuestions)){ totalQuestions=initialRosterCount||0; localStorage.setItem(CONFIG.STORAGE_KEYS.TOTAL_QUESTIONS,String(totalQuestions)); }
  const score=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.SCORE)||'0',10);
  const questionsAsked=parseInt(localStorage.getItem(CONFIG.STORAGE_KEYS.QUESTIONS_ASKED)||'0',10);
  scoreEl.textContent=`Score: ${score} / ${questionsAsked}`;

  const pool=Array.isArray(safeParseJSON(localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER)))?safeParseJSON(localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_ROSTER)):[];
  const remaining=pool.length;
  remainingEl.textContent=`Remaining: ${remaining} / ${totalQuestions}`;

  showView('quiz2');
  log(`Displayed quiz2 for player ${currentPlayer.player_id}. score=${score}, asked=${questionsAsked}, remaining=${remaining}`);
}

///////////////////////////
// NEXT
///////////////////////////
function handleNext(){
  localStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_PLAYER);
  localStorage.removeItem(CONFIG.STORAGE_KEYS.LAST_ANSWER);
  pickNextPlayer();
}

///////////////////////////
// EVENT HANDLERS
///////////////////////////
function setupHandlers(){
  keypadButtons.forEach(btn=>btn.addEventListener('click',()=>{ answerDisplay.value=(answerDisplay.value||'')+btn.textContent; }));
  clearButton.addEventListener('click',()=>{ answerDisplay.value=''; });
  goButton.addEventListener('click',handleSubmit);
  answerDisplay.addEventListener('keydown',ev=>{ if(ev.key==='Enter') handleSubmit(); });
  nextButton.addEventListener('click',handleNext);
}

///////////////////////////
// DOM CONTENT LOADED
///////////////////////////
document.addEventListener('DOMContentLoaded',async()=>{
  setupHandlers();
  await init();
});
