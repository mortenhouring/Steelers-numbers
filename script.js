// Embedded currentroster JSON
const roster = [
  {
    "player_name": "Will Howard",
    "number": 18,
    "position": "QB",
    "trivia": "Will Howard was a highly-touted high school quarterback, but he was also a standout basketball player who received scholarship offers to play college basketball.",
    "player_id": "12511",
    "player_image": "https://static.clubs.nfl.com/image/upload/t_person_squared_mobile_2x/f_png/v1749650074/steelers/vgsqx5el0iinquytagme.png"
  },
  {
    "player_name": "Aaron Rodgers",
    "number": 8,
    "position": "QB",
    "trivia": "Aaron Rodgers holds the NFL record for the highest touchdown-to-interception ratio in league history. He also famously tapes potato chips to the bottom of his heels during footwork drills to force himself to stay on his toes.",
    "player_id": "96",
    "player_image": "https://static.clubs.nfl.com/image/upload/t_person_squared_mobile_2x/f_png/v1749151513/steelers/wykfnzrjfjkfcqolskcv.png"
  },
  {
    "player_name": "Mason Rudolph",
    "number": 2,
    "position": "QB",
    "trivia": "Mason Rudolph was a record-setting quarterback at Oklahoma State, where he won the Johnny Unitas Golden Arm Award as a senior.",
    "player_id": "4972",
    "player_image": "https://static.clubs.nfl.com/image/private/t_person_squared_mobile_2x/f_auto/v1576338620/steelers/jftsqh3unbxwp7l8r9gc.jpg"
  }
  // Add the rest of your players here as needed
];

// Quiz state
let currentPlayerIndex = Math.floor(Math.random() * roster.length);
let currentAnswer = '';

// References to DOM
const questionEl = document.getElementById('question');
const answerDisplay = document.getElementById('answer-display');
const numButtons = document.querySelectorAll('.num');
const goButton = document.querySelector('.go-button');

// Set question
function loadQuestion() {
  const player = roster[currentPlayerIndex];
  questionEl.textContent = `What number does ${player.player_name} wear?`;
  answerDisplay.textContent = '';
  currentAnswer = '';
}

// Handle numeric button click
numButtons.forEach(button => {
  button.addEventListener('click', () => {
    if (currentAnswer.length < 2) { // max 2 digits
      currentAnswer += button.textContent;
      answerDisplay.textContent = currentAnswer;
    }
  });
});

// Handle Go button
goButton.addEventListener('click', () => {
  if (currentAnswer === '') return;
  // Store the answer (can use localStorage or query string)
  localStorage.setItem('quiz1Answer', currentAnswer);
  localStorage.setItem('quiz1PlayerIndex', currentPlayerIndex);
  // Move to next quiz page
  window.location.href = 'quiz2.html';
});

// Initial load
loadQuestion();