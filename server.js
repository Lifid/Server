const express = require("express");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Load daily key =====
function getDailyKey() {
  const data = fs.readFileSync(path.join(__dirname, "dailykey.json"), "utf8");
  return JSON.parse(data).key;
}

// ===== In-memory store for puid completions =====
const completions = new Map();

// ===== Home / Key page =====
app.get("/key", (req, res) => {
  const puid = uuidv4();
  completions.set(puid, false); // mark as not completed yet

  res.send(`
    <html>
      <head>
        <title>Get Key</title>
        <style>
          body { background:#1e1e1e; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; color:#e0e0e0; }
          .card { background:#2a2a2a; padding:40px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.5); text-align:center; }
          h1 { color:#4dabf7; }
          button { padding:15px 30px; font-size:18px; border:none; border-radius:8px; background:#4dabf7; color:white; cursor:pointer; transition:0.3s; }
          button:hover { background:#339af0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🔑 Get Daily Key</h1>
          <p>Click the button below to complete LootLabs:</p>
          <form action="/redirect-to-lootlabs" method="get">
            <input type="hidden" name="puid" value="${puid}">
            <button type="submit">Go to LootLabs</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// ===== Redirect to LootLabs =====
app.get("/redirect-to-lootlabs", (req, res) => {
  const { puid } = req.query;
  if (!puid || !completions.has(puid)) return res.status(400).send("Invalid puid");

  const lootlabsLink = `https://lootdest.org/s?K3VfEVAX&puid=${puid}`;
  res.redirect(lootlabsLink);
});

// ===== LootLabs Postback =====
app.get("/api/lootlabs", (req, res) => {
  const { click_id, ip } = req.query;
  if (!click_id) return res.status(400).send("Missing click_id");

  if (completions.has(click_id)) {
    completions.set(click_id, true);
    console.log(`✅ LootLabs completed: ${click_id} (IP: ${ip || "unknown"})`);
    res.send("OK");
  } else {
    console.log(`⚠️ Unknown click_id: ${click_id}`);
    res.status(404).send("Unknown click_id");
  }
});

// ===== Redeem key =====
app.get("/redeem", (req, res) => {
  const { puid } = req.query;
  if (!puid || !completions.has(puid)) return res.status(400).send("Invalid puid");

  if (completions.get(puid)) {
    const dailyKey = getDailyKey();

    res.send(`
      <html>
        <head>
          <title>Your Key</title>
          <style>
            body { background:#1e1e1e; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; color:#e0e0e0; }
            .card { background:#2a2a2a; padding:40px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.5); text-align:center; }
            h1 { color:#4dabf7; }
            .key { font-size:28px; color:#0f0; margin-top:20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🔑 Your Daily Key</h1>
            <p class="key">${dailyKey}</p>
          </div>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <head>
          <title>Not Completed</title>
          <style>
            body { background:#1e1e1e; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; color:#ff6b6b; }
            .card { background:#2a2a2a; padding:40px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.5); text-align:center; }
            h1 { color:#ff6b6b; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>⚠️ Complete LootLabs First!</h1>
          </div>
        </body>
      </html>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
