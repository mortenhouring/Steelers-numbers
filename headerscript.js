document.addEventListener("DOMContentLoaded", async () => {
    const headerPlaceholder = document.getElementById("header-placeholder");
    try {
        const response = await fetch("header.html");
        if (!response.ok) throw new Error("Failed to load header");
        const headerContent = await response.text();
        headerPlaceholder.innerHTML = headerContent;
    } catch (error) {
        console.error("Error loading header:", error);
    }
});