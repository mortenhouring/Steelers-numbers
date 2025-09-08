// script.js

// Global variables
let roster = [];
let currentPlayerIndex = 0;

// ----------------- Quiz1 -----------------
function setupQuiz1() {
  const questionEl = document.getElementById("question");
  const answerDisplay = document.getElementById("answer-display");
  const numButtons = document.querySelectorAll(".num");
  const goButton = document.getElementById("go-button");

  // Fetch the roster JSON
  fetch("currentroster.json")
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load roster JSON");
      return response.json();
    })
    .then((data) => {
      roster = data;
      // pick a random player for quiz1
      currentPlayerIndex = Math.floor(Math.random() * roster.length);
      const player = roster[currentPlayerIndex];
      questionEl.textContent = `What is ${player.player_name}'s number?`;
    })
    .catch((err) => {
      console.error(err);
      questionEl.textContent = "Error loading player data.";
    });

  // Numeric buttons
  numButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (answerDisplay.textContent.length < 2) {
        answerDisplay.textContent += btn.textContent;
      }
    });
  });

  // Go button
  goButton.addEventListener("click", () => {
    const answer = answerDisplay.textContent;
    if (answer === "") return;
    // store selected answer and player index
    localStorage.setItem("quiz1Answer", answer);
    localStorage.setItem("quiz1PlayerIndex", currentPlayerIndex);
    // redirect to quiz2
    window.location.href = "quiz2.html";
  });
}

// ----------------- Quiz2 -----------------
function setupQuiz2() {
  const answerDisplay = document.getElementById("answer-display");
  const playerNameEl = document.getElementById("player-name");
  const correctNumberEl = document.getElementById("correct-number");
  const playerImageEl = document.getElementById("player-image");
  const triviaEl = document.getElementById("player-trivia");
  const feedbackEl = document.getElementById("feedback");
  const nextButton = document.getElementById("next-button");

  const selectedAnswer = localStorage.getItem("quiz1Answer");
  const playerIndex = parseInt(localStorage.getItem("quiz1PlayerIndex"), 10);

  fetch("currentroster.json")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to load roster JSON");
      return res.json();
    })
    .then((data) => {
      roster = data;
      const player = roster[playerIndex];

      playerNameEl.textContent = player.player_name;
      correctNumberEl.textContent = player.number;
      playerImageEl.src = player.player_image;
      triviaEl.textContent = player.trivia;

      if (selectedAnswer === player.number.toString()) {
        feedbackEl.textContent = "Correct!";
        feedbackEl.style.color = "green";
      } else {
        feedbackEl.textContent = "Incorrect.";
        feedbackEl.style.color = "red";
      }
    })
    .catch((err) => {
      console.error(err);
      feedbackEl.textContent = "Error loading quiz data.";
    });

  nextButton.addEventListener("click", () => {
    // for now, just reload quiz1 for another question
    window.location.href = "quiz1.html";
  });
}

// ----------------- Initialize -----------------
document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("quiz1")) {
    setupQuiz1();
  } else if (document.body.classList.contains("quiz2")) {
    setupQuiz2();
  }
});