const express = require("express");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Debug toggle
const DEBUG = true;

// In-memory stores
// puid -> { createdAt, expiresAt, completed, ip }
const sessions = new Map();
// ip -> puid (for fallback in private browsers)
const ipIndex = new Map();

function getDailyKey() {
  const data = fs.readFileSync(path.join(__dirname, "dailykey.json"), "utf8");
  return JSON.parse(data).key;
}

// Helper: client IP
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress
  );
}

// ===== Landing / Get Key page =====
app.get("/", (req, res) => {
  const puid = req.cookies.puid;
  const ip = getClientIp(req);
  const now = Date.now();
  let session = puid ? sessions.get(puid) : null;
  let debugMessage = "";

  if (!session && ipIndex.has(ip)) {
    session = sessions.get(ipIndex.get(ip));
  }

  if (session) {
    if (now > session.expiresAt) {
      sessions.delete(session.puid);
      ipIndex.delete(session.ip);
      res.clearCookie("puid");
      session = null;
    }
  }

  if (!session) {
    if (DEBUG) debugMessage = "New user detected 01";
    return renderGetKeyPage(res, debugMessage);
  }

  if (!session.completed) {
    if (DEBUG) debugMessage = "Loot lab not complete, try again";
    return renderGetKeyPage(res, debugMessage);
  }

  // Completed but too early
  if (now - session.createdAt < 45000) {
    if (DEBUG) debugMessage = "Glitch prevention: wait 45s";
    sessions.delete(session.puid);
    ipIndex.delete(session.ip);
    res.clearCookie("puid");
    return renderGetKeyPage(res, debugMessage);
  }

  // Success: show key, clear IP
  ipIndex.delete(session.ip);
  return renderKeyPage(res);
});

// ===== Generate PUID and redirect to LootLabs =====
app.get("/key", (req, res) => {
  const puid = uuidv4();
  const createdAt = Date.now();
  const expiresAt = createdAt + 180000; // 3 minutes
  const ip = getClientIp(req);

  sessions.set(puid, { puid, createdAt, expiresAt, completed: false, ip });
  ipIndex.set(ip, puid);

  res.cookie("puid", puid, { httpOnly: true, maxAge: 180000 });

  const lootlabsUrl = `https://loot-link.com/s?BYbSlUsE&puid=${puid}`;
  res.redirect(lootlabsUrl);
});

// ===== Handle return from LootLabs =====
app.get("/api/lootlabs", (req, res) => {
  const puid = req.cookies.puid;
  const ip = getClientIp(req);

  let session = puid ? sessions.get(puid) : null;
  if (!session && ipIndex.has(ip)) {
    session = sessions.get(ipIndex.get(ip));
  }

  if (!session) return res.redirect("/");

  session.completed = true;
  sessions.set(session.puid, session);

  res.redirect("/");
});

// ===== Render pages =====
function renderGetKeyPage(res, debugMessage = "") {
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
          .debug { margin-top:15px; color:#0f0; font-size:14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🔑 Get Daily Key</h1>
          <p>Click below to complete LootLabs:</p>
          <form action="/key" method="get">
            <button type="submit">Go to LootLabs</button>
          </form>
          ${DEBUG && debugMessage ? `<div class="debug">${debugMessage}</div>` : ""}
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
