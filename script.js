// ===== Quiz 1 Script =====

// Embedded roster JSON
const players = [
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
  },
  {
    "player_name": "Skylar Thompson",
    "number": 17,
    "position": "QB",
    "trivia": "Skylar Thompson was a three-sport athlete in high school, excelling in football, basketball, and baseball. He also earned a black belt in taekwondo at a young age.",
    "player_id": "8206",
    "player_image": "https://static.clubs.nfl.com/image/upload/t_person_squared_mobile_2x/f_png/v1755541814/steelers/ptsxmzcbrnafw3pm25od.png"
  },
  {
    "player_name": "Kenneth Gainwell",
    "number": 14,
    "position": "RB",
    "trivia": "Kenneth Gainwell and his new Steelers teammate, wide receiver Calvin Austin III, were college teammates at Memphis.",
    "player_id": "7567",
    "player_image": "https://static.clubs.nfl.com/image/upload/t_person_squared_mobile_2x/f_png/steelers/v0lsvegrovkir7jwa5lw.png"
  },
  // ... include all remaining players from your JSON here
  {
    "player_name": "Christian Kuntz",
    "number": 46,
    "position": "LS",
    "trivia": "Christian Kuntz was a dominant college linebacker at Duquesne, where he set a school record with 30.5 sacks. He later transitioned to long snapper in order to have a better chance at making an NFL roster.",
    "player_id": "4848",
    "player_image": "https://static.clubs.nfl.com/image/private/t_person_squared_mobile_2x/f_auto/v1710776150/steelers/epj1nxcu2zrkgybjmnav.jpg"
  }
];

// ===== DOM Elements =====
const questionDisplay = document.getElementById("question");
const answerDisplay = document.getElementById("answer-display");
const numButtons = document.querySelectorAll(".num");
const goButton = document.querySelector(".go-button");

// Initialize current input
let currentInput = "";

// ===== Functions =====
function getRandomPlayer() {
  return players[Math.floor(Math.random() * players.length)];
}

function loadQuestion() {
  const player = getRandomPlayer();
  questionDisplay.textContent = `What number does ${player.player_name} wear?`;
  questionDisplay.dataset.correct = player.number; // store correct number
  currentInput = "";
  answerDisplay.textContent = "";
}

// Update display when numeric button is clicked
numButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (currentInput.length < 2) {
      currentInput += btn.textContent;
      answerDisplay.textContent = currentInput;
    }
  });
});

// Go button click
goButton.addEventListener("click", () => {
  const correctNumber = questionDisplay.dataset.correct;
  if (currentInput === "") return; // do nothing if empty

  // Store answer in sessionStorage to access in quiz2.html
  sessionStorage.setItem("quiz1Answer", currentInput);
  sessionStorage.setItem("quiz1Correct", correctNumber);

  // Move to quiz2
  window.location.href = "quiz2.html";
});

// Load first question immediately
loadQuestion();