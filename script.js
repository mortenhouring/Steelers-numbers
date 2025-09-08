// ======== script.js ========

// Global state
let currentQuestionIndex = 0;
let score = 0;
let totalQuestions = 0;
let roster = [];

// Load the JSON roster
async function loadRoster() {
  const response = await fetch('currentroster.json');
  roster = await response.json();
  totalQuestions = roster.length;
}

// Helper: pick random feedback phrase
const correctPhrases = [
  "That's right!", "Correct!", "Well done!", "Nice!", "Exactly!", "You got it!", 
  "Spot on!", "Bullseye!", "Perfect!", "Good job!", "Right on!", "Yes!", 
  "Absolutely!", "Fantastic!", "You nailed it!"
];
const incorrectPhrases = [
  "Incorrect.", "Not quite.", "Wrong!", "Try again next time.", 
  "Oops, that's not it.", "Nope.", "Better luck next.", "Almost!", 
  "Not correct.", "Incorrect guess.", "Uh-oh!", "Missed it.", 
  "Wrong answer.", "Keep trying!", "No."
];

function getRandomFeedback(correct) {
  if (correct) {
    return correctPhrases[Math.floor(Math.random() * correctPhrases.length)];
  } else {
    return incorrectPhrases[Math.floor(Math.random() * incorrectPhrases.length)];
  }
}

// Initialize quiz1.html
function initQuiz1() {
  const questionEl = document.getElementById('question');
  const answerBox = document.getElementById('answer-box');
  const numberButtons = document.querySelectorAll('.num');
  const goButton = document.querySelector('.go-button');

  if (!roster.length) {
    console.error("Roster not loaded yet!");
    return;
  }

  const player = roster[currentQuestionIndex];
  const questionPhrases = [
    `What jersey number does ${player.player_name} wear?`,
    `Guess the number for ${player.player_name}`,
    `Which number is ${player.player_name}'s jersey?`,
    `Enter ${player.player_name}'s jersey number`,
    `${player.player_name}'s number is?`
  ];
  questionEl.textContent = questionPhrases[Math.floor(Math.random() * questionPhrases.length)];

  // Numeric grid buttons
  numberButtons.forEach(button => {
    button.addEventListener('click', () => {
      answerBox.value += button.textContent;
      if (answerBox.value.length > 2) answerBox.value = answerBox.value.slice(0, 2);
    });
  });

  // Go button
  goButton.addEventListener('click', () => {
    const answer = parseInt(answerBox.value, 10);
    if (answer === player.number) score++;
    // Save answer correctness and move to quiz2.html
    localStorage.setItem('currentQuestionIndex', currentQuestionIndex);
    localStorage.setItem('score', score);
    window.location.href = 'quiz2.html';
  });
}

// Initialize quiz2.html
function initQuiz2() {
  currentQuestionIndex = parseInt(localStorage.getItem('currentQuestionIndex'), 10) || 0;
  score = parseInt(localStorage.getItem('score'), 10) || 0;

  const player = roster[currentQuestionIndex];
  const feedbackEl = document.getElementById('feedback');
  const scoreEl = document.getElementById('score');
  const remainingEl = document.getElementById('remaining');
  const nextButton = document.querySelector('.go-button');

  // Show score and remaining
  scoreEl.textContent = `${score}/${totalQuestions}`;
  remainingEl.textContent = `Remaining: ${totalQuestions - currentQuestionIndex - 1}/${totalQuestions}`;

  // Feedback phrase
  // Simple check: was previous answer correct?
  const lastAnswerCorrect = parseInt(localStorage.getItem('lastAnswer'), 10) === player.number;
  feedbackEl.textContent = getRandomFeedback(lastAnswerCorrect);

  // Populate player info
  document.getElementById('player-image').src = player.player_image;
  document.getElementById('player-name').textContent = player.player_name;
  document.getElementById('player-position').textContent = player.position;
  document.getElementById('player-trivia').textContent = player.trivia;

  // Next question button
  nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex >= roster.length) {
      // Quiz finished
      localStorage.setItem('finalScore', score);
      window.location.href = 'quizEnd.html';
    } else {
      localStorage.setItem('currentQuestionIndex', currentQuestionIndex);
      window.location.href = 'quiz1.html';
    }
  });
}

// Initialize quizEnd.html
function initQuizEnd() {
  const finalScoreEl = document.getElementById('final-score');
  const personalBestEl = document.getElementById('personal-best-message');
  const retryButton = document.getElementById('retry-button');
  const menuButton = document.getElementById('menu-button');

  const finalScore = parseInt(localStorage.getItem('finalScore'), 10) || 0;
  finalScoreEl.textContent = `${finalScore}/${totalQuestions}`;

  if (finalScore === totalQuestions) {
    personalBestEl.textContent = "Who are you? Mike Tomlin!?";
  } else if (finalScore > parseInt(localStorage.getItem('highScore') || 0, 10)) {
    personalBestEl.textContent = "That's a personal best!";
    localStorage.setItem('highScore', finalScore);
  }

  retryButton.addEventListener('click', () => {
    score = 0;
    currentQuestionIndex = 0;
    localStorage.setItem('currentQuestionIndex', 0);
    localStorage.setItem('score', 0);
    window.location.href = 'quiz1.html';
  });

  menuButton.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

// Load roster first, then init
loadRoster().then(() => {
  if (document.body.classList.contains('quiz1')) {
    initQuiz1();
  } else if (document.body.classList.contains('quiz2')) {
    initQuiz2();
  } else if (document.body.classList.contains('quizEnd')) {
    initQuizEnd();
  }
});