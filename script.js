const QUIZ_JSON_URL = 'https://raw.githubusercontent.com/mortenhouring/Steelers-numbers/refs/heads/main/currentroster.json';

let roster = [];
let currentQuestionIndex = 0;
let userAnswer = null;
let score = 0;

// --- Utility ---
function getBodyClass() {
  return document.body.className;
}

// --- Quiz 1 ---
async function initQuiz1() {
  try {
    const response = await fetch(QUIZ_JSON_URL);
    if (!response.ok) throw new Error('Network response was not ok');
    roster = await response.json();

    showQuestion();
    setupKeypad();
    setupGoButton();
  } catch (err) {
    console.error('Failed to load roster JSON:', err);
    document.getElementById('question').textContent = 'Failed to load questions.';
  }
}

function showQuestion() {
  const questionEl = document.getElementById('question');
  if (roster.length === 0) return;
  questionEl.textContent = `Enter the jersey number for: ${roster[currentQuestionIndex].player_name}`;
}

function setupKeypad() {
  const buttons = document.querySelectorAll('.num');
  const display = document.getElementById('answer-display');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      display.textContent += btn.textContent;
    });
  });
}

function setupGoButton() {
  const goBtn = document.getElementById('go-button');
  goBtn.addEventListener('click', () => {
    const display = document.getElementById('answer-display');
    userAnswer = display.textContent.trim();

    if (!userAnswer) return alert('Please enter a number.');

    // Store selected answer and current question index in localStorage
    localStorage.setItem('quiz1_answer', userAnswer);
    localStorage.setItem('quiz1_questionIndex', currentQuestionIndex);

    // Navigate to quiz2
    window.location.href = 'quiz2.html';
  });
}

// --- Quiz 2 ---
function initQuiz2() {
  if (!roster.length) {
    fetch(QUIZ_JSON_URL)
      .then(res => res.json())
      .then(data => {
        roster = data;
        displayQuiz2();
      })
      .catch(err => {
        console.error('Failed to load roster JSON:', err);
        document.getElementById('player-name').textContent = 'Failed to load player info.';
      });
  } else {
    displayQuiz2();
  }
}

function displayQuiz2() {
  const questionIndex = parseInt(localStorage.getItem('quiz1_questionIndex'));
  const answer = localStorage.getItem('quiz1_answer');
  const player = roster[questionIndex];

  document.getElementById('player-name').textContent = player.player_name;
  document.getElementById('player-info').textContent = `${player.position} - Jersey: ${player.number}`;
  document.getElementById('player-trivia').textContent = player.trivia;
  document.getElementById('player-image').src = player.player_image;

  // Feedback
  const feedbackEl = document.getElementById('feedback');
  if (answer === player.number.toString()) {
    feedbackEl.textContent = 'Correct!';
    score = 1;
  } else {
    feedbackEl.textContent = `Incorrect. You entered ${answer}.`;
    score = 0;
  }

  document.getElementById('score').textContent = `Score: ${score}`;
  document.getElementById('remaining').textContent = `Remaining Questions: ${roster.length - questionIndex - 1}`;

  // Next button
  const nextBtn = document.getElementById('next-button');
  nextBtn.addEventListener('click', () => {
    const nextIndex = questionIndex + 1;
    if (nextIndex < roster.length) {
      localStorage.setItem('quiz1_questionIndex', nextIndex);
      window.location.href = 'quiz1.html';
    } else {
      alert('Quiz complete!');
      localStorage.clear();
      window.location.href = 'quiz1.html';
    }
  });
}

// --- Init ---
window.addEventListener('DOMContentLoaded', () => {
  const bodyClass = getBodyClass();
  if (bodyClass === 'quiz1') {
    initQuiz1();
  } else if (bodyClass === 'quiz2') {
    initQuiz2();
  }
});