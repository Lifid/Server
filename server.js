const express = require("express");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cookieParser());

// In-memory store for completed PUIDs
const completedUsers = new Set();

// Load daily key
function getDailyKey() {
  const data = fs.readFileSync(path.join(__dirname, "dailykey.json"), "utf8");
  return JSON.parse(data).key;
}

// ===== Landing page =====
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Get Key</title>
        <style>
          body { background:#1e1e1e; color:#e0e0e0; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;}
          .card { background:#2a2a2a; padding:40px; border-radius:12px; text-align:center; box-shadow:0 4px 15px rgba(0,0,0,0.5);}
          h1 { color:#4dabf7; }
          button { padding:15px 30px; font-size:18px; border:none; border-radius:8px; background:#4dabf7; color:white; cursor:pointer; transition:0.3s; }
          button:hover { background:#339af0; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🔑 Get Daily Key</h1>
          <p>Click below to complete LootLabs:</p>
          <form action="/key" method="get">
            <button type="submit">Go to LootLabs</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// ===== Generate PUID and redirect to LootLabs =====
app.get("/key", (req, res) => {
  const puid = uuidv4();
  res.cookie("puid", puid, { httpOnly: true });

  // LootLabs link with puid
  const lootlabsUrl = `https://loot-link.com/s?BYbSlUsE&puid=${puid}`;
  res.redirect(lootlabsUrl);
});

// ===== Handle return from LootLabs =====
app.get("/api/lootlabs", (req, res) => {
  const puid = req.cookies.puid;

  if (!puid) {
    return res.status(400).send("⚠️ No session found. Please go through the Get Key button first.");
  }

  // Mark user as completed
  completedUsers.add(puid);

  // Redirect to success page
  res.redirect("/success");
});

// ===== Success page showing key =====
app.get("/success", (req, res) => {
  const puid = req.cookies.puid;

  if (puid && completedUsers.has(puid)) {
    const dailyKey = getDailyKey();
    return res.send(`
      <html>
        <head>
          <title>Your Key</title>
          <style>
            body { background:#1e1e1e; color:#e0e0e0; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;}
            .card { background:#2a2a2a; padding:40px; border-radius:12px; text-align:center; box-shadow:0 4px 15px rgba(0,0,0,0.5);}
            h1 { color:#4dabf7; }
            .key { font-size:28px; color:#0f0; margin-top:20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🎉 Congrats!</h1>
            <p>Your daily key is:</p>
            <p class="key">${dailyKey}</p>
          </div>
        </body>
      </html>
    `);
  }

  res.send("⚠️ Could not verify completion. Please go through the Get Key button again.");
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
