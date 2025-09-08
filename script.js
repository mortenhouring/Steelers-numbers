// ===========================
// Embedded roster JSON
// ===========================
const roster = [
  {"player_name":"Will Howard","number":18,"position":"QB","trivia":"Will Howard was a highly-touted high school quarterback, but he was also a standout basketball player who received scholarship offers to play college basketball.","player_id":"12511","player_image":"https://static.clubs.nfl.com/image/upload/t_person_squared_mobile_2x/f_png/v1749650074/steelers/vgsqx5el0iinquytagme.png"},
  {"player_name":"Aaron Rodgers","number":8,"position":"QB","trivia":"Aaron Rodgers holds the NFL record for the highest touchdown-to-interception ratio in league history. He also famously tapes potato chips to the bottom of his heels during footwork drills to force himself to stay on his toes.","player_id":"96","player_image":"https://static.clubs.nfl.com/image/upload/t_person_squared_mobile_2x/f_png/v1749151513/steelers/wykfnzrjfjkfcqolskcv.png"},
  {"player_name":"Mason Rudolph","number":2,"position":"QB","trivia":"Mason Rudolph was a record-setting quarterback at Oklahoma State, where he won the Johnny Unitas Golden Arm Award as a senior.","player_id":"4972","player_image":"https://static.clubs.nfl.com/image/private/t_person_squared_mobile_2x/f_auto/v1576338620/steelers/jftsqh3unbxwp7l8r9gc.jpg"},
  {"player_name":"Skylar Thompson","number":17,"position":"QB","trivia":"Skylar Thompson was a three-sport athlete in high school, excelling in football, basketball, and baseball. He also earned a black belt in taekwondo at a young age.","player_id":"8206","player_image":"https://static.clubs.nfl.com/image/upload/t_person_squared_mobile_2x/f_png/v1755541814/steelers/ptsxmzcbrnafw3pm25od.png"},
  // ... rest of the JSON players (copy all from your currentroster.json) ...
];

// ===========================
// DOM elements
// ===========================
const questionEl = document.getElementById("question");
const answerDisplayEl = document.getElementById("answer-display");
const numButtons = document.querySelectorAll(".num");
const goButton = document.getElementById("go-button");

// ===========================
// Quiz state
// ===========================
let currentPlayer = null;

// ===========================
// Helper: pick random player
// ===========================
function pickRandomPlayer() {
  const randomIndex = Math.floor(Math.random() * roster.length);
  return roster[randomIndex];
}

// ===========================
// Initialize quiz
// ===========================
function initQuiz() {
  currentPlayer = pickRandomPlayer();
  questionEl.textContent = `What number does ${currentPlayer.player_name} wear?`;
  answerDisplayEl.value = "";
}

// ===========================
// Numeric keypad events
// ===========================
numButtons.forEach(button => {
  button.addEventListener("click", () => {
    answerDisplayEl.value += button.textContent;
  });
});

// ===========================
// Go button: store answer & redirect
// ===========================
goButton.addEventListener("click", () => {
  const userAnswer = answerDisplayEl.value;
  if (!userAnswer) return alert("Please enter a number!");

  // Store selected answer and player in localStorage for quiz2
  localStorage.setItem("quiz1_answer", userAnswer);
  localStorage.setItem("quiz1_player", JSON.stringify(currentPlayer));

  // Redirect to quiz2
  window.location.href = "quiz2.html";
});

// ===========================
// Initialize on page load
// ===========================
window.addEventListener("DOMContentLoaded", initQuiz);