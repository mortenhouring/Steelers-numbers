let quiz = [];
let unusedQuestions = [];
let currentQuestion;
let correctCount = 0;
let totalAnswered = 0;

// fetch JSON from same folder
fetch("Penalties.json")
  .then(response => response.json())
  .then(data => {
    quiz = data;
    unusedQuestions = [...quiz];
    displayQuestion(); // start quiz after loading
  })
  .catch(err => console.error("Failed to load questions:", err));

// pick random unused question
function getRandomQuestion() {
  if (unusedQuestions.length === 0) {
    unusedQuestions = [...quiz]; // reset when all used
  }
  let index = Math.floor(Math.random() * unusedQuestions.length);
  let q = unusedQuestions[index];
  unusedQuestions.splice(index, 1);
  return q;
}

// display question
function displayQuestion() {
  currentQuestion = getRandomQuestion();

  document.getElementById("question").textContent = currentQuestion.question;

  let optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = "";
  document.getElementById("result").textContent = "";
  document.getElementById("next-btn").style.display = "none";

  currentQuestion.options.forEach(option => {
    let btn = document.createElement("button");
    btn.textContent = option;
    btn.onclick = () => checkAnswer(option);
    optionsDiv.appendChild(btn);
  });

  updateScore();
}

// check answer
function checkAnswer(selected) {
  let resultDiv = document.getElementById("result");
  totalAnswered++;

  if (selected === currentQuestion.options[currentQuestion.answer]) {
    correctCount++;
    resultDiv.textContent = "Correct! " + currentQuestion.info;
  } else {
    resultDiv.textContent = "Wrong. Correct answer: " +
      currentQuestion.options[currentQuestion.answer] + ". " + currentQuestion.info;
  }

  document.getElementById("next-btn").style.display = "inline-block";
  updateScore();
}

// update score display
function updateScore() {
  document.getElementById("score").textContent =
    `Score: ${correctCount}/${totalAnswered}`;
}

// next question button
document.getElementById("next-btn").onclick = displayQuestion;
