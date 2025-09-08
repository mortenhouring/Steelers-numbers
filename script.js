document.addEventListener('DOMContentLoaded', () => {
  const rosterURL = 'https://mortenhouring.github.io/repo/currentroster.json';

  let roster = [];
  let currentQuestionIndex = parseInt(localStorage.getItem('currentQuestionIndex'), 10) || 0;
  let score = parseInt(localStorage.getItem('score'), 10) || 0;
  let currentAnswer = '';
  let currentPlayer = null;

  // Elements
  const questionEl = document.getElementById('question');
  const answerDisplay = document.getElementById('answer-display');
  const numberButtons = document.querySelectorAll('.num');
  const goButton = document.getElementById('go-button');
  const scoreDisplay = document.getElementById('score-display');
  const remainingDisplay = document.getElementById('remaining-display');
  const feedbackEl = document.getElementById('feedback');
  const nextButton = document.getElementById('next-button');
  const playerImage = document.getElementById('player-image');
  const playerInfo = document.getElementById('player-info');
  const playerTrivia = document.getElementById('player-trivia');
  const finalScoreEl = document.getElementById('final-score');
  const personalBestEl = document.getElementById('personal-best');

  async function loadRoster() {
    try {
      const res = await fetch(rosterURL);
      roster = await res.json();

      if (questionEl) { // quiz1 page
        if (currentQuestionIndex >= roster.length) {
          localStorage.setItem('score', score);
          window.location.href = 'quizEnd.html';
          return;
        }
        currentPlayer = roster[currentQuestionIndex];
        showQuestion();
      }

      if (feedbackEl) { // quiz2 page
        currentPlayer = roster[currentQuestionIndex - 1];
        showFeedback();
      }

      if (finalScoreEl) { // quizEnd page
        showFinalScore();
      }

    } catch (err) {
      console.error(err);
      if (questionEl) questionEl.textContent = 'Failed to load questions.';
      if (feedbackEl) feedbackEl.textContent = 'Failed to load feedback.';
    }
  }

  // Quiz1
  function showQuestion() {
    const phrases = [
      `What jersey number does ${currentPlayer.player_name} wear?`,
      `Guess the number for ${currentPlayer.player_name}`,
      `Which number is ${currentPlayer.player_name}'s jersey?`,
      `Enter ${currentPlayer.player_name}'s jersey number`,
      `${currentPlayer.player_name}'s number is?`
    ];
    questionEl.textContent = phrases[Math.floor(Math.random() * phrases.length)];
    currentAnswer = '';
    answerDisplay.textContent = '--';
  }

  numberButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'go-button') return;
      if (currentAnswer.length < 2) {
        currentAnswer += btn.textContent;
        answerDisplay.textContent = currentAnswer;
      }
    });
  });

  if (goButton) {
    goButton.addEventListener('click', () => {
      if (currentAnswer === '') return;
      const answer = parseInt(currentAnswer, 10);
      if (answer === currentPlayer.number) score++;
      currentQuestionIndex++;
      localStorage.setItem('score', score);
      localStorage.setItem('currentQuestionIndex', currentQuestionIndex);
      localStorage.setItem('lastAnswer', answer);
      window.location.href = 'quiz2.html';
    });
  }

  // Quiz2
  function showFeedback() {
    const correctResponses = ['That\'s right!', 'Correct!', 'Well done!', 'Nice job!', 'Exactly!', 'You got it!', 'Bulls-eye!', 'Perfect!', 'Good one!', 'Right on!'];
    const incorrectResponses = ['Incorrect', 'Nope', 'Try again next time', 'Not quite', 'Wrong', 'Better luck next', 'Oops', 'Missed it', 'Not this time', 'Wrong answer'];

    const lastAnswer = parseInt(localStorage.getItem('lastAnswer'), 10);
    const isCorrect = lastAnswer === currentPlayer.number;
    feedbackEl.textContent = isCorrect ? correctResponses[Math.floor(Math.random()*correctResponses.length)]
                                        : incorrectResponses[Math.floor(Math.random()*incorrectResponses.length)];

    scoreDisplay.textContent = `Score: ${score}/${roster.length}`;
    remainingDisplay.textContent = `Remaining: ${roster.length - currentQuestionIndex}/${roster.length}`;
    playerImage.src = currentPlayer.player_image;
    playerInfo.textContent = `${currentPlayer.player_name}, ${currentPlayer.position}`;
    playerTrivia.textContent = currentPlayer.trivia;

    if (nextButton) {
      nextButton.addEventListener('click', () => {
        if (currentQuestionIndex >= roster.length) {
          window.location.href = 'quizEnd.html';
        } else {
          window.location.href = 'quiz1.html';
        }
      });
    }
  }

  function showFinalScore() {
    finalScoreEl.textContent = `${score}/${roster.length}`;
    if (score === roster.length) personalBestEl.textContent = 'Who are you? Mike Tomlin!?';
  }

  loadRoster();
});