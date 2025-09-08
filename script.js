// ===== script.js for quiz1 =====

// Global state
let currentQuestionIndex = parseInt(localStorage.getItem('currentQuestionIndex'), 10) || 0;
let score = parseInt(localStorage.getItem('score'), 10) || 0;
let roster = [];

// Load JSON roster and initialize quiz1
async function initQuiz1() {
  // Elements
  const questionEl = document.getElementById('question');
  const answerDisplay = document.getElementById('answer-display');
  const numberButtons = document.querySelectorAll('.num');
  const goButton = document.querySelector('.go-button');

  // Fetch JSON
  const res = await fetch('currentroster.json');
  roster = await res.json();

  if (currentQuestionIndex >= roster.length) {
    // End of roster
    localStorage.setItem('score', score);
    window.location.href = 'quizEnd.html';
    return;
  }

  const player = roster[currentQuestionIndex];

  // Random question phrasing
  const questionPhrases = [
    `What jersey number does ${player.player_name} wear?`,
    `Guess the number for ${player.player_name}`,
    `Which number is ${player.player_name}'s jersey?`,
    `Enter ${player.player_name}'s jersey number`,
    `${player.player_name}'s number is?`
  ];
  questionEl.textContent = questionPhrases[Math.floor(Math.random() * questionPhrases.length)];

  // Numeric input logic
  let currentAnswer = '';
  answerDisplay.textContent = '--';

  numberButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentAnswer.length < 2) {
        currentAnswer += btn.textContent;
        answerDisplay.textContent = currentAnswer;
      }
    });
  });

  // Go button logic
  goButton.addEventListener('click', () => {
    if (currentAnswer === '') return; // Ignore empty

    const answer = parseInt(currentAnswer, 10);
    localStorage.setItem('lastAnswer', answer);

    if (answer === player.number) score++;
    localStorage.setItem('score', score);

    currentQuestionIndex++;
    localStorage.setItem('currentQuestionIndex', currentQuestionIndex);

    // Go to quiz2 page
    window.location.href = 'quiz2.html';
  });
}

// Initialize based on body class
if (document.body.className.includes('quiz1')) {
  initQuiz1();
}