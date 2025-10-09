// headerscript.js
// Load header.html into #header-placeholder, attach menu listeners, set --header-height (vh) + px placeholder

document.addEventListener('DOMContentLoaded', () => {
  const placeholder = document.getElementById('header-placeholder');
  if (!placeholder) {
    console.warn('header-placeholder not found');
    return;
  }

  (async function loadHeader() {
    try {
      const resp = await fetch('header.html', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Failed to load header.html (${resp.status})`);
      const html = await resp.text();

      // Insert header HTML inside the placeholder
      placeholder.innerHTML = html;

      // Find header inside placeholder
      const header = placeholder.querySelector('.mobile-header');
      if (!header) {
        console.warn('Inserted header but .mobile-header not found inside header.html');
        return;
      }

      // Wire up hamburger, dropdown and overlay (header.html markup uses these IDs)
      const hamburgerButton = placeholder.querySelector('#hamburgerButton');
      const dropdownMenu = placeholder.querySelector('#dropdownMenu');
      const dropdownOverlay = placeholder.querySelector('#dropdownOverlay');

      function toggleDropdown() {
        if (!dropdownMenu || !dropdownOverlay) return;
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
        if (!dropdownMenu || !dropdownOverlay) return;
        dropdownMenu.classList.remove('show');
        dropdownOverlay.classList.remove('show');
      }

      if (hamburgerButton) hamburgerButton.addEventListener('click', toggleDropdown);
      if (dropdownOverlay) dropdownOverlay.addEventListener('click', closeDropdown);
      placeholder.querySelectorAll('.dropdown-item').forEach(item => item.addEventListener('click', closeDropdown));
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDropdown(); });

      // Measure header and set CSS variable --header-height in vh (and set px placeholder height)
      const root = document.documentElement;

      function updateHeaderHeight() {
        const rect = header.getBoundingClientRect();
        const heightPx = Math.round(rect.height || header.offsetHeight || 0);
        const vh = (heightPx / (window.innerHeight || document.documentElement.clientHeight)) * 100;
        // set CSS var in vh units (use in CSS: margin-top: var(--header-height);)
        root.style.setProperty('--header-height', `${vh}vh`);
        // set placeholder height in px so document flow pushes content below the fixed header
        placeholder.style.height = `${heightPx}px`;
      }

      // Wait for header images to load before final measurement (if any)
      const imgs = header.querySelectorAll('img');
      let imgsToLoad = 0;
      imgs.forEach(img => { if (!img.complete) imgsToLoad++; });
      if (imgsToLoad === 0) {
        updateHeaderHeight();
      } else {
        imgs.forEach(img => {
          if (!img.complete) {
            img.addEventListener('load', () => {
              imgsToLoad--;
              if (imgsToLoad === 0) updateHeaderHeight();
            }, { once: true });
            img.addEventListener('error', () => {
              imgsToLoad--;
              if (imgsToLoad === 0) updateHeaderHeight();
            }, { once: true });
          }
        });
        // fallback (in case load events don't fire)
        setTimeout(updateHeaderHeight, 300);
      }

      // Keep it up to date on resize / orientation change
      window.addEventListener('resize', updateHeaderHeight, { passive: true });
      window.addEventListener('orientationchange', updateHeaderHeight, { passive: true });

    } catch (err) {
      console.error('Error loading header:', err);
    }
  })();
});