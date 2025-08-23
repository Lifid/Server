const express = require("express");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cookieParser());

// In-memory store for completed PUIDs with expiration timestamp
const completedUsers = new Map();

// Load daily key
function getDailyKey() {
  const data = fs.readFileSync(path.join(__dirname, "dailykey.json"), "utf8");
  return JSON.parse(data).key;
}

// ===== Landing / Get Key page =====
app.get("/", (req, res) => {
  const puid = req.cookies.puid;
  const expiry = completedUsers.get(puid);

  // If PUID exists but is expired or missing, remove cookie
  if (puid && (!expiry || expiry < Date.now())) {
    res.clearCookie("puid");
  }

  // Show key if user has a valid session
  if (puid && expiry && expiry > Date.now()) {
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

  // Otherwise, show Get Key button
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
  const existingPuid = req.cookies.puid;
  const existingExpiry = completedUsers.get(existingPuid);

  // If user already has a PUID and it's been less than 30 seconds, expire old one
  if (existingPuid && existingExpiry && existingExpiry - Date.now() > 150000) {
    completedUsers.delete(existingPuid);
    res.clearCookie("puid");
  }

  // Create new PUID and 3 minute expiration
  const puid = uuidv4();
  const expiry = Date.now() + 180000; // 3 minutes
  completedUsers.set(puid, expiry);

  // Set cookie
  res.cookie("puid", puid, { httpOnly: true, maxAge: 180000 });

  // Redirect to LootLabs
  const lootlabsUrl = `https://loot-link.com/s?BYbSlUsE&puid=${puid}`;
  res.redirect(lootlabsUrl);
});

// ===== Handle return from LootLabs =====
app.get("/api/lootlabs", (req, res) => {
  const puid = req.cookies.puid;

  if (!puid || !completedUsers.has(puid)) {
    return res.redirect("/"); // redirect to Get Key page if missing/expired
  }

  // Reset expiration to 3 minutes from now (in case user delayed)
  completedUsers.set(puid, Date.now() + 180000);

  // Stay on same page, show key dynamically
  res.redirect("/");
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
