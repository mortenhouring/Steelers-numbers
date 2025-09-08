// Globals
let roster = [];
let currentQuestion = {};
let userAnswer = "";

// Fetch JSON
fetch('currentroster.json')
  .then(response => response.json())
  .then(data => {
    roster = data;
    loadQuestion();
  })
  .catch(err => {
    console.error("Error loading roster:", err);
    document.getElementById("question").textContent = "Failed to load questions.";
  });

// Load a random question
function loadQuestion() {
  if (roster.length === 0) return;
  const randomIndex = Math.floor(Math.random() * roster.length);
  currentQuestion = roster[randomIndex];
  document.getElementById("question").textContent =
    `What is ${currentQuestion.player_name}'s jersey number?`;
  userAnswer = "";
  updateDisplay();
}

// Update the display field
function updateDisplay() {
  document.getElementById("answer-display").textContent = userAnswer;
}

// Numeric buttons
document.querySelectorAll(".num").forEach(button => {
  button.addEventListener("click", () => {
    if (userAnswer.length < 2) { // Limit to 2 digits
      userAnswer += button.textContent;
      updateDisplay();
    }
  });
});

// Go button
document.getElementById("go-button").addEventListener("click", () => {
  if (userAnswer.length === 0) return;
  sessionStorage.setItem("quiz1Answer", userAnswer);
  sessionStorage.setItem("quiz1PlayerName", currentQuestion.player_name);
  window.location.href = "quiz2.html";
});