// ------------------------------
// header.js Mobile Header + Dynamic Quiz Offset 
// ------------------------------

document.addEventListener("DOMContentLoaded", () => {
  const header = document.querySelector(".mobile-header");
  const headerPlaceholder = document.getElementById("header-placeholder");
  const root = document.documentElement; // for CSS variable

  if (!header) return;

  // Set CSS variable for quiz offset
  function updateHeaderHeight() {
    const height = header.offsetHeight; // actual header height in px
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

    // Convert px to vh as percentage of viewport height
    const heightVh = (height / vh) * 100;
    root.style.setProperty("--header-height", `${heightVh}vh`);

    // Optional: placeholder to avoid content jumping
    headerPlaceholder.style.height = `${height}px`;
  }

  // Initial calculation
  updateHeaderHeight();

  // Recalculate on resize
  window.addEventListener("resize", updateHeaderHeight);
});