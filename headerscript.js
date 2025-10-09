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

        // Adjust padding below the header
// === Header height → CSS variable (vh) + px fallback ===
// Sets --header-height on :root in vh units so CSS can use var(--header-height).
// Also keeps a px fallback on body.paddingTop for compatibility with existing pages.

const header = document.querySelector('.mobile-header');

if (header) {
  const applyHeaderHeight = (px) => {
    // Convert px to vh: 1vh == window.innerHeight / 100 px
    const vhUnitPx = window.innerHeight / 100;
    const headerVh = px / vhUnitPx;
    // Set CSS custom property in vh units (use in CSS: margin-top: var(--header-height);)
    document.documentElement.style.setProperty('--header-height', `${headerVh}vh`);
    // Set px padding on body as a safe fallback for code/CSS still relying on px
    document.body.style.paddingTop = `${px}px`;
  };

  const setHeaderHeight = () => {
    const px = header.offsetHeight || Math.round(header.getBoundingClientRect().height);
    if (!px) {
      // If header height not ready (images/fonts), retry on next frame
      requestAnimationFrame(setHeaderHeight);
      return;
    }
    applyHeaderHeight(px);
  };

  // Initialize and update on viewport changes
  setHeaderHeight();
  window.addEventListener('resize', setHeaderHeight, { passive: true });
  window.addEventListener('orientationchange', setHeaderHeight, { passive: true });
}
    } catch (error) {
        console.error("Error loading header:", error);
    }
});