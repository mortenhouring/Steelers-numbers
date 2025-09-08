document.addEventListener('DOMContentLoaded', () => {
  let roster = [];
  let currentQuestionIndex = parseInt(localStorage.getItem('currentQuestionIndex'), 10) || 0;
  let score = parseInt(localStorage.getItem('score'), 10) || 0;
  let currentAnswer = '';
  let currentPlayer = null;

  const questionEl = document.getElementById('question');
  const answerDisplay = document.getElementById('answer-display');
  const numberButtons = document.querySelectorAll('.num');
  const goButton = document.getElementById('go-button');

  async function loadRoster() {
    try {
      const res = await fetch('currentroster.json');
      roster = await res.json();

      if (!roster.length || currentQuestionIndex >= roster.length) {
        localStorage.setItem('score', score);
        window.location.href = 'quizEnd.html';
        return;
      }

      currentPlayer = roster[currentQuestionIndex];
      showQuestion();
    } catch (err) {
      questionEl.textContent = 'Failed to load questions.';
      console.error(err);
    }
  }

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

  // Numeric buttons
  numberButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'go-button') return; // skip Go here
      if (currentAnswer.length < 2) {
        currentAnswer += btn.textContent;
        answerDisplay.textContent = currentAnswer;
      }
    });
  });

  // Go button
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

  loadRoster();
});