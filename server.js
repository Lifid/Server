const express = require("express");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cookieParser());

// In-memory store for completed PUIDs with timestamp
const completedUsers = new Map();

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
  const expiry = Date.now() + 60000; // 1 minute in milliseconds

  // Store the PUID with expiry timestamp
  completedUsers.set(puid, expiry);

  // Set cookie for client
  res.cookie("puid", puid, { httpOnly: true, maxAge: 60000 });

  // LootLabs link with puid
  const lootlabsUrl = `https://loot-link.com/s?BYbSlUsE&puid=${puid}`;
  res.redirect(lootlabsUrl);
});

// ===== Handle return from LootLabs =====
app.get("/api/lootlabs", (req, res) => {
  const puid = req.cookies.puid;

  if (!puid || !completedUsers.has(puid)) {
    return res.redirect("/"); // Redirect to get-key page if missing/expired
  }

  // Extend expiration to ensure user has short window to claim key
  completedUsers.set(puid, Date.now() + 60000);

  // Redirect to success page
  res.redirect("/success");
});

// ===== Success page showing key =====
app.get("/success", (req, res) => {
  const puid = req.cookies.puid;
  const expiry = completedUsers.get(puid);

  // Check if PUID exists and is not expired
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

  // Remove expired/invalid PUID
  if (puid) completedUsers.delete(puid);

  // Redirect automatically to Get Key page
  res.redirect("/");
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
