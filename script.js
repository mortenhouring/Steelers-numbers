let roster = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let score = 0;

// Detect which quiz page we are on
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('quiz1')) {
        fetchRoster(initQuiz1);
    } else if (document.body.classList.contains('quiz2')) {
        fetchRoster(initQuiz2);
    }
});

function fetchRoster(callback) {
    fetch('currentroster.json')
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch JSON: ' + response.statusText);
            return response.json();
        })
        .then(data => {
            roster = data;
            callback();
        })
        .catch(error => {
            console.error(error);
            const questionEl = document.getElementById('question');
            if (questionEl) questionEl.textContent = 'Error loading questions.';
        });
}

/* ------------------- QUIZ 1 ------------------- */
function initQuiz1() {
    if (!roster.length) return;

    const questionEl = document.getElementById('question');
    const displayEl = document.getElementById('answer-display');
    const goButton = document.getElementById('go-button');
    const numButtons = document.querySelectorAll('.num');

    // Show first question
    currentQuestionIndex = 0;
    questionEl.textContent = `What is the jersey number of ${roster[currentQuestionIndex].player_name}?`;
    displayEl.textContent = '';

    // Numeric buttons
    numButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.textContent === 'Go') return;
            displayEl.textContent += btn.textContent;
        });
    });

    // Go button
    goButton.addEventListener('click', () => {
        const answer = displayEl.textContent.trim();
        if (!answer) return; // ignore empty
        // Save to localStorage for quiz2
        localStorage.setItem('quiz1_answer', answer);
        localStorage.setItem('quiz1_index', currentQuestionIndex);
        window.location.href = 'quiz2.html';
    });
}

/* ------------------- QUIZ 2 ------------------- */
function initQuiz2() {
    if (!roster.length) return;

    const index = parseInt(localStorage.getItem('quiz1_index'), 10) || 0;
    const answer = localStorage.getItem('quiz1_answer') || '';
    const questionData = roster[index];

    // Elements
    const feedbackEl = document.getElementById('feedback');
    const scoreEl = document.getElementById('score');
    const remainingEl = document.getElementById('remaining');
    const playerImageEl = document.getElementById('player-image');
    const playerInfoEl = document.getElementById('player-info');
    const playerTriviaEl = document.getElementById('player-trivia');
    const nextButton = document.getElementById('next-button');

    // Show player info
    playerImageEl.src = questionData.player_image;
    playerInfoEl.textContent = `${questionData.player_name} - ${questionData.position}`;
    playerTriviaEl.textContent = questionData.trivia;

    // Check answer
    if (answer == questionData.number) {
        feedbackEl.textContent = 'Correct!';
        score = 1;
    } else {
        feedbackEl.textContent = `Incorrect. The correct number is ${questionData.number}.`;
        score = 0;
    }

    scoreEl.textContent = `Score: ${score}`;
    remainingEl.textContent = `Remaining questions: ${roster.length - index - 1}`;

    // Next button
    nextButton.addEventListener('click', () => {
        // For now, only one question implemented. Expand as needed.
        alert('No more questions implemented yet.');
    });
}