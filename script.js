// script.js

let roster = [];
let currentPlayer = null; 
let questionDisplay; 
let answerDisplay; 
let goButton;
let quiz1Initialized = false;
let currentIndex = parseInt(localStorage.getItem('currentIndex') || '0', 10);

const correctResponses = [
  "Nice job!",
  "That's right!",
  "You got it!",
  "Exactly!",
  "Spot on!",
  "Great work!",
  "Correct!"
];

const incorrectResponses = [
  "Oops, try again.",
  "Not quite.",
  "Wrong number.",
  "Almost, keep going.",
  "Try once more.",
  "Incorrect, keep going."
];

const questionPhrases = [
"What number is {player} in black and gold?",  
"Which digits are on {player}'s jersey?",  
"What number does {player} wear at Acrisure?",  
"Which number’s on {player}'s back?",  
"What’s {player}'s Steel Curtain number?",  
"What jersey number is {player}?",  
"What digits does {player} rep for Steelers Nation?",  
"What’s on {player}'s chest in Pittsburgh?",  
"What number do Terrible Towel fans wave for {player}?",  
"What number’s on {player}'s helmet stripe?",  
"Which jersey does {player} wear for the Burgh?",  
"What digits mark {player} in the Steel City?",  
"What number’s stitched on {player}'s uniform?",  
"When the announcer calls {player}, what number goes with it?",  
"What’s {player}'s lineup number in black and gold?"  
];

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
async function loadRoster() {
  try {
    console.log('Fetching roster...');
    const response = await fetch('currentroster.json');
    console.log('Fetch response:', response);

    if (!response.ok) throw new Error("Could not load roster");
    roster = await response.json();
    console.log('Roster loaded:', roster);

    shuffleArray(roster);
    console.log('Roster shuffled:', roster);

// Initialize counters only if they don't exist
if (!localStorage.getItem('totalQuestions')) {
    localStorage.setItem('totalQuestions', roster.length);
    localStorage.setItem('score', 0);
    localStorage.setItem('questionsAsked', 0);
}

    setupQuiz1();
    console.log('Quiz setup completed');
  } catch (err) {
    console.error('Error during roster loading:', err);
    document.getElementById('player-name').textContent = `Error: ${err.message}`;
  }
}

function setupQuiz1() {
  if (!document.body.classList.contains('quiz1')) return;
  if (quiz1Initialized) return; // Prevent double-init
  quiz1Initialized = true;

  questionDisplay = document.getElementById('player-name');
  answerDisplay = document.getElementById('answer-display');
  goButton = document.getElementById('go-button');

  pickNextPlayer();

  // Numeric keypad buttons
  document.querySelectorAll('.num').forEach(btn => {
    btn.addEventListener('click', () => {
      answerDisplay.value += btn.textContent;
    });
  });

  // Clear button
  const clearBtn = document.getElementById('clear-button');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      answerDisplay.value = '';
    });
  }

  // Go button
  goButton.addEventListener('click', () => {
    const userAnswer = parseInt(answerDisplay.value, 10);
    if (isNaN(userAnswer)) return;

    localStorage.setItem('lastAnswer', userAnswer);
    localStorage.setItem('lastPlayerId', currentPlayer.player_id);
    window.location.href = 'quiz2.html';
  });
}

function pickNextPlayer() {
  if (currentIndex >= roster.length) {
    window.location.href = 'quiz_end.html';
    return;
  }

  currentPlayer = roster[currentIndex];
  currentIndex++;
  localStorage.setItem('currentIndex', currentIndex); // save progress

  const phrase = questionPhrases[Math.floor(Math.random() * questionPhrases.length)];
  questionDisplay.textContent = phrase.replace('{player}', currentPlayer.player_name);
  answerDisplay.value = '';
}

// --- Quiz2 setup ---
function setupQuiz2() {
  if (!document.body.classList.contains('quiz2')) return;

  const playerImage = document.getElementById('player-image');
  const playerInfo = document.getElementById('player-info');
  const playerTrivia = document.getElementById('player-trivia');
  const feedback = document.getElementById('feedback');
  const scoreDisplay = document.getElementById('score');
  const remainingDisplay = document.getElementById('remaining');
  const nextButton = document.getElementById('next-button');

  const lastAnswer = parseInt(localStorage.getItem('lastAnswer'), 10);
  const lastPlayerId = localStorage.getItem('lastPlayerId');
  const player = roster.find(p => p.player_id === lastPlayerId);
  if (!player) {
    feedback.textContent = "Player not found.";
    return;
  }

  playerImage.src = player.player_image;
  playerInfo.textContent = `${player.player_name} - ${player.position}`;
  playerTrivia.textContent = player.trivia;

  if (lastAnswer === player.number) {
    feedback.textContent = correctResponses[Math.floor(Math.random() * correctResponses.length)];
  } else {
    feedback.textContent = incorrectResponses[Math.floor(Math.random() * incorrectResponses.length)];
  }

let score = parseInt(localStorage.getItem('score') || '0', 10);
let questionsAsked = parseInt(localStorage.getItem('questionsAsked') || '0', 10);
const totalQuestions = parseInt(localStorage.getItem('totalQuestions') || roster.length, 10);

questionsAsked++;  // increment per answered question

if (lastAnswer === player.number) {
    score++;  // increment only on correct answer
}

localStorage.setItem('score', score);
localStorage.setItem('questionsAsked', questionsAsked);

// Display counters in desired format
scoreDisplay.textContent = `Score: ${score} / ${questionsAsked}`;
const remaining = totalQuestions - questionsAsked;
remainingDisplay.textContent = `Remaining: ${remaining} / ${totalQuestions}`;
  nextButton.addEventListener('click', () => {
    window.location.href = 'quiz1.html';
  });
}

// Auto-detect which quiz page
document.addEventListener('DOMContentLoaded', async () => {
  await loadRoster();   // This will call setupQuiz1() if on quiz1 page
  setupQuiz2();         // Only needed if on quiz2 page
});
