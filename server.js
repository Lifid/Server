const express = require("express");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cookieParser());

// In-memory store: puid -> { createdAt, expiresAt, completed }
const sessions = new Map();

// Load daily key
function getDailyKey() {
  const data = fs.readFileSync(path.join(__dirname, "dailykey.json"), "utf8");
  return JSON.parse(data).key;
}

// ===== Landing / Get Key page =====
app.get("/", (req, res) => {
  const puid = req.cookies.puid;
  const session = puid ? sessions.get(puid) : null;
  const now = Date.now();

  if (session) {
    // Already expired
    if (now > session.expiresAt) {
      sessions.delete(puid);
      res.clearCookie("puid");
      return renderGetKeyPage(res);
    }

    // If LootLabs not completed yet, show get key
    if (!session.completed) {
      return renderGetKeyPage(res);
    }

    // If completed but <60s wait -> block/glitch prevention
    if (now - session.createdAt < 60000) {
      sessions.delete(puid);
      res.clearCookie("puid");
      return renderGetKeyPage(res);
    }

    // If completed AND waited long enough -> show key
    return renderKeyPage(res);
  }

  // Default: show Get Key
  renderGetKeyPage(res);
});

// ===== Generate PUID and redirect to LootLabs =====
app.get("/key", (req, res) => {
  const puid = uuidv4();
  const createdAt = Date.now();
  const expiresAt = createdAt + 180000; // 3 minutes
  sessions.set(puid, { createdAt, expiresAt, completed: false });

  res.cookie("puid", puid, { httpOnly: true, maxAge: 180000 });

  const lootlabsUrl = `https://loot-link.com/s?BYbSlUsE&puid=${puid}`;
  res.redirect(lootlabsUrl);
});

// ===== Handle return from LootLabs =====
app.get("/api/lootlabs", (req, res) => {
  const puid = req.cookies.puid;
  const session = puid ? sessions.get(puid) : null;

  if (!session) {
    return res.redirect("/");
  }

  // Mark session as completed
  session.completed = true;

  // Keep same expiry (3 min total from creation)
  sessions.set(puid, session);

  res.redirect("/");
});

// ===== Helpers =====
function renderGetKeyPage(res) {
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
}

function renderKeyPage(res) {
  const dailyKey = getDailyKey();
  res.send(`
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

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
