// scripts/fetch-steelers.js
import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

const ROSTER_URL = "https://www.espn.com/nfl/team/roster/_/name/pit/pittsburgh-steelers";

async function fetchRoster() {
  const res = await fetch(ROSTER_URL);
  const html = await res.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const players = [];
  const rows = doc.querySelectorAll("table tbody tr");

  rows.forEach(row => {
    const nameCell = row.querySelector("a.AnchorLink");
    const posCell = row.querySelector('td:nth-child(2)');
    const numCell = row.querySelector('td:nth-child(1)');

    if (!nameCell) return;

    const href = nameCell.getAttribute("href"); // like /nfl/player/_/id/4040715/kenny-pickett
    const match = href.match(/id\/(\d+)\//);
    const playerId = match ? match[1] : null;

    players.push({
      player_name: nameCell.textContent.trim(),
      number: numCell ? numCell.textContent.trim() : "",
      position: posCell ? posCell.textContent.trim() : "",
      player_id: playerId,
      player_image: playerId
        ? `https://a.espncdn.com/i/headshots/nfl/players/full/${playerId}.png`
        : ""
    });
  });

  fs.writeFileSync("steelers_roster.json", JSON.stringify(players, null, 2));
  console.log("✅ Roster saved to steelers_roster.json");
}

fetchRoster().catch(err => {
  console.error("Error fetching roster:", err);
  process.exit(1);
});
