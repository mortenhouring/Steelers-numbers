// ======== script.js ========

// Global state
let currentQuestionIndex = parseInt(localStorage.getItem('currentQuestionIndex'), 10) || 0;
let score = parseInt(localStorage.getItem('score'), 10) || 0;
let totalQuestions = 0;
let roster = [];

// Feedback phrases
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

// Helper: pick random feedback phrase
function getRandomFeedback(correct) {
  if (correct) {
    return correctPhrases[Math.floor(Math.random() * correctPhrases.length)];
  } else {
    return incorrectPhrases[Math.floor(Math.random() * incorrectPhrases.length)];
  }
}

// Load JSON roster
async function loadRoster() {
  const response = await fetch('currentroster.json');
  roster = await response.json();
  totalQuestions = roster.length;
}

// ===== Quiz1 =====
function initQuiz1() {
  const answerDisplay = document.getElementById('answer-display');
  const numberButtons = document.querySelectorAll('.num');
  const goButton = document.querySelector('.go-button');

  if (!roster.length) return;

  const player = roster[currentQuestionIndex];
  const questionPhrases = [
    `What jersey number does ${player.player_name} wear?`,
    `Guess the number for ${player.player_name}`,
    `Which number is ${player.player_name}'s jersey?`,
    `Enter ${player.player_name}'s jersey number`,
    `${player.player_name}'s number is?`
  ];
  document.getElementById('question').textContent =
    questionPhrases[Math.floor(Math.random() * questionPhrases.length)];

  let currentAnswer = '';

  // Numeric button logic
  numberButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (currentAnswer.length < 2) {
        currentAnswer += button.textContent;
        answerDisplay.textContent = currentAnswer;
      }
    });
  });

  // Go button
  goButton.addEventListener('click', () => {
    const answer = parseInt(currentAnswer, 10);
    localStorage.setItem('lastAnswer', answer);

    if (answer === player.number) score++;
    localStorage.setItem('score', score);

    // Move to quiz2.html
    window.location.href = 'quiz2.html';
  });
}

// ===== Quiz2 =====
function initQuiz2() {
  const player = roster[currentQuestionIndex];
  const feedbackEl = document.getElementById('feedback');
  const scoreEl = document.getElementById('score');
  const remainingEl = document.getElementById('remaining');
  const nextButton = document.querySelector('.go-button');

  // Show score and remaining questions
  scoreEl.textContent = `${score}/${totalQuestions}`;
  remainingEl.textContent = `Remaining: ${totalQuestions - currentQuestionIndex - 1}/${totalQuestions}`;

  // Feedback phrase
  const lastAnswer = parseInt(localStorage.getItem('lastAnswer'), 10);
  const lastCorrect = lastAnswer === player.number;
  feedbackEl.textContent = getRandomFeedback(lastCorrect);

  // Populate player info
  document.getElementById('player-image').src = player.player_image;
  document.getElementById('player-name').textContent = player.player_name;
  document.getElementById('player-position').textContent = player.position;
  document.getElementById('player-trivia').textContent = player.trivia;

  // Next question button
  nextButton.addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex >= totalQuestions) {
      // End quiz
      localStorage.setItem('finalScore', score);
      window.location.href = 'quizEnd.html';
    } else {
      localStorage.setItem('currentQuestionIndex', currentQuestionIndex);
      window.location.href = 'quiz1.html';
    }
  });
}

// ===== QuizEnd =====
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

// ===== Init based on body class =====
loadRoster().then(() => {
  const bodyClass = document.body.className;
  if (bodyClass.includes('quiz1')) initQuiz1();
  else if (bodyClass.includes('quiz2')) initQuiz2();
  else if (bodyClass.includes('quizEnd')) initQuizEnd();
});