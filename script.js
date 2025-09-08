let players = [];
let currentQuestionIndex = 0;

// Display element
const questionEl = document.getElementById('question');
const answerDisplay = document.getElementById('answer-display');
const numButtons = document.querySelectorAll('.num');
const goButton = document.querySelector('.go-button');

// Fetch player JSON from the same folder
fetch('currentroster.json')
  .then(response => response.json())
  .then(data => {
    players = data;
    showQuestion();
  })
  .catch(err => {
    console.error('Error loading player JSON:', err);
    questionEl.textContent = 'Failed to load question.';
  });

// Display the current question
function showQuestion() {
  if (currentQuestionIndex < players.length) {
    const player = players[currentQuestionIndex];
    questionEl.textContent = `What number does ${player.player_name} wear?`;
    answerDisplay.textContent = '';
  } else {
    // If all questions done, go to quizEnd
    window.location.href = 'quizEnd.html';
  }
}

// Numeric buttons input
numButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    answerDisplay.textContent += btn.textContent;
  });
});

// Go button logic
goButton.addEventListener('click', () => {
  const player = players[currentQuestionIndex];
  const answer = answerDisplay.textContent;

  // Store answer in sessionStorage
  sessionStorage.setItem('quiz1_answer_' + currentQuestionIndex, answer);

  // Move to next question
  currentQuestionIndex++;
  showQuestion();
});