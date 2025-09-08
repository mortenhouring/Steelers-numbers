// ==== Embedded question and feedback phrases ====
const questionPhrases = [
    "What number does",
    "Guess the jersey number for",
    "Enter the number for",
    "Which number wears",
    "Identify the number of"
];

const correctResponses = [
    "Nice job!", "That's right!", "You got it!", "Exactly!", "Correct!"
];

const incorrectResponses = [
    "Oops, try again.", "Not quite.", "Wrong number.", "Almost, keep going.", "Incorrect!"
];

// ==== State ====
let roster = [];
let remainingPlayers = [];
let currentPlayer = null;
let score = 0;

// ==== DOM Elements ====
const playerNameEl = document.getElementById('player-name');
const answerDisplay = document.getElementById('answer-display');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const remainingEl = document.getElementById('remaining');
const goButton = document.getElementById('go-button');
const nextButton = document.getElementById('next-button');
const playerImageEl = document.getElementById('player-image');
const playerInfoEl = document.getElementById('player-info');
const playerTriviaEl = document.getElementById('player-trivia');

// ==== Load local JSON ====
async function loadRoster() {
    try {
        const response = await fetch('currentroster.json');
        roster = await response.json();
        resetQuiz();
    } catch (error) {
        console.error("Error loading roster:", error);
        playerNameEl.textContent = "Failed to load roster.";
    }
}

// ==== Quiz Setup ====
function resetQuiz() {
    score = 0;
    remainingPlayers = [...roster];
    updateScoreDisplay();
    showNextQuestion();
}

// ==== Utility Functions ====
function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function updateScoreDisplay() {
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (remainingEl) remainingEl.textContent = `Remaining: ${remainingPlayers.length}`;
}

// ==== Quiz1 Functions ====
function showNextQuestion() {
    if (remainingPlayers.length === 0) {
        playerNameEl.textContent = "Quiz complete!";
        return;
    }
    currentPlayer = remainingPlayers.splice(Math.floor(Math.random() * remainingPlayers.length), 1)[0];
    const phrase = randomItem(questionPhrases);
    playerNameEl.textContent = `${phrase} ${currentPlayer.player_name}?`;
    answerDisplay.value = "";
    feedbackEl.textContent = "";
    updateScoreDisplay();
}

// ==== Numeric Keypad ====
document.querySelectorAll('.num').forEach(btn => {
    btn.addEventListener('click', () => {
        answerDisplay.value += btn.textContent;
    });
});

// ==== Go Button ====
if (goButton) {
    goButton.addEventListener('click', () => {
        if (answerDisplay.value === currentPlayer.number.toString()) {
            score++;
            feedbackEl.textContent = randomItem(correctResponses);
        } else {
            feedbackEl.textContent = randomItem(incorrectResponses);
        }
        updateScoreDisplay();
        localStorage.setItem('lastAnswer', answerDisplay.value);
        localStorage.setItem('lastPlayer', JSON.stringify(currentPlayer));
        localStorage.setItem('lastScore', score);
        window.location.href = 'quiz2.html';
    });
}

// ==== Quiz2 Setup ====
if (document.body.classList.contains('quiz2')) {
    const lastPlayer = JSON.parse(localStorage.getItem('lastPlayer'));
    if (lastPlayer) {
        playerImageEl.src = lastPlayer.player_image;
        playerInfoEl.textContent = `${lastPlayer.player_name} - ${lastPlayer.position}`;
        playerTriviaEl.textContent = lastPlayer.trivia;
    }

    if (nextButton) {
        nextButton.addEventListener('click', () => {
            window.location.href = 'quiz1.html';
        });
    }
}

// ==== Init ====
if (document.body.classList.contains('quiz1')) {
    loadRoster();
}
