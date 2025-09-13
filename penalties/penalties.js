let quiz = [];
let unusedQuestions = [];
let currentQuestion;
let correctCount = 0;
let totalAnswered = 0;

// Fetch questions from penalties.json (same folder)
fetch("penalties.json")
  .then(response => response.json())
  .then(data => {
    quiz = data;
    unusedQuestions = [...quiz];
    displayQuestion(); // start quiz after loading
  })
  .catch(err => console.error("Failed to load questions:", err));

// Pick a random unused question
function getRandomQuestion() {
  if (unusedQuestions.length === 0) {
    unusedQuestions = [...quiz]; // reset when all used
  }
  let index = Math.floor(Math.random() * unusedQuestions.length);
  let q = unusedQuestions[index];
  unusedQuestions.splice(index, 1); // remove from pool
  return q;
}

// Display a question
function displayQuestion() {
  currentQuestion = getRandomQuestion();

  document.getElementById("question").textContent = currentQuestion.question;

  let optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = "";
  document.getElementById("feedback").textContent = "";
  document.getElementById("next-btn").style.display = "none";

  // Add frontpage-btn class to all multiple-choice buttons
  currentQuestion.options.forEach(option => {
    let btn = document.createElement("button");
    btn.textContent = option;
    btn.classList.add("frontpage-btn"); // ✅ apply CSS
    btn.onclick = () => checkAnswer(option);
    optionsDiv.appendChild(btn);
  });

  updateScore();
}

// Check the answer
function checkAnswer(selected) {
  let feedbackDiv = document.getElementById("feedback");
  totalAnswered++;

  if (selected === currentQuestion.options[currentQuestion.answer]) {
    correctCount++;
    feedbackDiv.textContent = "Correct! " + currentQuestion.info;
  } else {
    feedbackDiv.textContent = "Wrong. Correct answer: " +
      currentQuestion.options[currentQuestion.answer] + ". " + currentQuestion.info;
  }

  document.getElementById("next-btn").style.display = "inline-block";
  updateScore();
}

// Update score display
function updateScore() {
  document.getElementById("score").textContent =
    `Score: ${correctCount}/${totalAnswered}`;
}

// Next question button
document.getElementById("next-btn").onclick = displayQuestion;