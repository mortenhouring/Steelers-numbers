// Updated logic for quiz button
function updateQuizButtonLogic() {
    const button = document.getElementById('quiz-button');
    if (!button) {
        console.error('Quiz button not found!');
        return;
    }
    button.addEventListener('click', () => {
        try {
            // Improved logic for handling quiz start
            startQuiz();
        } catch (error) {
            console.error('Error starting the quiz:', error);
        }
    });
}

// Call the function to update the button logic
updateQuizButtonLogic();
