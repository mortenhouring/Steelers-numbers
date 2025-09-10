document.addEventListener("DOMContentLoaded", async () => {
    const headerPlaceholder = document.getElementById("header-placeholder");
    try {
        const response = await fetch("header.html");
        if (!response.ok) throw new Error("Failed to load header");
        const headerContent = await response.text();
        headerPlaceholder.innerHTML = headerContent;

        // Attach event listeners after loading the header
        const hamburgerButton = document.getElementById('hamburgerButton');
        const dropdownMenu = document.getElementById('dropdownMenu');
        const dropdownOverlay = document.getElementById('dropdownOverlay');

        function toggleDropdown() {
            const isOpen = dropdownMenu.classList.contains('show');
            
            if (isOpen) {
                dropdownMenu.classList.remove('show');
                dropdownOverlay.classList.remove('show');
            } else {
                dropdownMenu.classList.add('show');
                dropdownOverlay.classList.add('show');
            }
        }

        function closeDropdown() {
            dropdownMenu.classList.remove('show');
            dropdownOverlay.classList.remove('show');
        }

        // Add event listeners
        hamburgerButton.addEventListener('click', toggleDropdown);
        dropdownOverlay.addEventListener('click', closeDropdown);
    } catch (error) {
        console.error("Error loading header:", error);
    }
});