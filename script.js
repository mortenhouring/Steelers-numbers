// Use relative path to JSON (same folder as HTML)
const rosterUrl = "currentroster.json";

// Keep track of game state
let players = [];
let currentPlayer = null;
let currentAnswer = "";

// Detect which page we’re on
const page = document.body.classList.contains("quiz1")
  ? "quiz1"
  : document.body.classList.contains("quiz2")
  ? "quiz2"
  : document.body.classList.contains("quizEnd")
  ? "quizEnd"
  : "index";

// ------------------ QUIZ 1 ------------------
if (page === "quiz1") {
  fetch(rosterUrl)
    .then(res => res.json())
    .then(data => {
      players = data;
      loadQuestion();
    })
    .catch(err => {
      document.getElementById("question").textContent = "Error loading roster.";
      console.error(err);
    });

  // Setup numeric keypad
  document.querySelectorAll(".num").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.textContent.trim();
      currentAnswer += val;
      document.getElementById("answer-display").textContent = currentAnswer;
    });
  });

  // Setup Go button
  document.getElementById("go-button").addEventListener("click", () => {
    if (currentPlayer && currentAnswer.length > 0) {
      localStorage.setItem("lastAnswer", currentAnswer);
      localStorage.setItem("currentPlayer", JSON.stringify(currentPlayer));
      window.location.href = "quiz2.html";
    }
  });
}

// Randomized question phrasing
function getQuestionPhrase(player) {
  const phrases = [
    `What number does ${player.player_name} wear?`,
    `Do you remember ${player.player_name}'s jersey number?`,
    `Which jersey is worn by ${player.player_name}?`,
    `${player.player_name} plays ${player.position}. What’s his number?`,
    `Can you guess ${player.player_name}'s number?`,
    `Which number is ${player.player_name} wearing this season?`,
    `Identify the jersey number of ${player.player_name}.`
  ];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// Load a new question
function loadQuestion() {
  currentPlayer = players[Math.floor(Math.random() * players.length)];
  document.getElementById("question").textContent = getQuestionPhrase(currentPlayer);
  currentAnswer = "";
  document.getElementById("answer-display").textContent = "";
}