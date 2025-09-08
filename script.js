const QUIZ_JSON_URL = 'currentroster.json';
let roster = [];
let currentQuestionIndex = 0;
let selectedAnswer = '';

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.classList.contains('quiz1')) {
    setupQuiz1();
  } else if (document.body.classList.contains('quiz2')) {
    setupQuiz2();
  }
});

async function loadRoster() {
  if (roster.length === 0) {
    const response = await fetch(QUIZ_JSON_URL);
    roster = await response.json();
  }
  return roster;
}

// ----------- Quiz 1 -----------
async function setupQuiz1() {
  await loadRoster();
  displayQuestion();

  const numButtons = document.querySelectorAll('.num');
  const display = document.getElementById('answer-display');
  numButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      display.textContent += btn.textContent;
      selectedAnswer = display.textContent;
    });
  });

  document.getElementById('go-button').addEventListener('click', () => {
    if (!selectedAnswer) return;
    localStorage.setItem('quiz1-answer', selectedAnswer);
    currentQuestionIndex++;
    // Move to quiz2.html
    window.location.href = 'quiz2.html';
  });
}

function displayQuestion() {
  const questionEl = document.getElementById('question');
  const player = roster[currentQuestionIndex];
  questionEl.textContent = `Enter the number for: ${player.player_name}`;
}

// ----------- Quiz 2 -----------
function setupQuiz2() {
  const player = roster[currentQuestionIndex - 1]; // previous quiz1 answer
  document.getElementById('player-name').textContent = player.player_name;
  document.getElementById('player-image').src = player.player_image;
  document.getElementById('player-info').textContent = `Position: ${player.position}, Jersey: ${player.number}`;
  document.getElementById('player-trivia').textContent = player.trivia;

  document.getElementById('next-button').addEventListener('click', () => {
    currentQuestionIndex++;
    if (currentQuestionIndex >= roster.length) {
      currentQuestionIndex = 0; // restart
    }
    window.location.href = 'quiz1.html';
  });
}