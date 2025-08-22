const express = require("express");
const crypto = require("crypto");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Store valid tokens
const validTokens = new Set();

// Load daily key
function getDailyKey() {
  const data = fs.readFileSync("./dailykey.json", "utf8");
  return JSON.parse(data).key;
}

// Generate secure random token
function generateToken() {
  const token = crypto.randomBytes(16).toString("hex");
  validTokens.add(token);
  // Auto-expire after 10 seconds
  setTimeout(() => validTokens.delete(token), 10000);
  return token;
}

// ==================== ROUTES ==================== //

// Home page
app.get("/", (req, res) => {
  res.send(`
  <html>
    <head>
      <style>
        body { font-family: Arial; background:#1e1e1e; color:#e0e0e0; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
        .card { background:#2a2a2a; padding:30px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.4); text-align:center; }
        a { color:#4dabf7; text-decoration:none; font-weight:bold; }
        a:hover { text-decoration:underline; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🔑 Key Server</h1>
        <p>Complete a Lootlabs offer to get your key!</p>
      </div>
    </body>
  </html>
  `);
});

// Lootlabs GET postback
app.get("/lootlab-complete", (req, res) => {

   const { puid } = req.query;

  if (!puid) {
    return res.status(400).send("Missing user ID (puid)");
  }

  // Generate one-time token
  const token = generateToken();

  // Send token page to user
  res.send(`
    <html>
      <head>
        <style>
          body { font-family: Arial; background:#1e1e1e; color:#e0e0e0; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
          .card { background:#2a2a2a; padding:30px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.4); text-align:center; }
          a { color:#4dabf7; font-size:18px; text-decoration:none; }
          a:hover { text-decoration:underline; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✅ Lootlabs Completed</h2>
          <p><a href="/getKey?token=${token}">Reveal Your Daily Key</a></p>
        </div>
      </body>
    </html>
  `);
});

// Key page
app.get("/getKey", (req, res) => {
  const { token } = req.query;

  if (!token || !validTokens.has(token)) {
    return res.status(403).send(`
      <html>
        <head>
          <style>
            body { background:#1e1e1e; color:#ff6b6b; font-family:Arial; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
          </style>
        </head>
        <body>
          <h1>❌ Invalid or Expired Access</h1>
        </body>
      </html>
    `);
  }

  validTokens.delete(token);
  const dailyKey = getDailyKey();

  res.send(`
    <html>
      <head>
        <style>
          body { font-family: Arial; background:#1e1e1e; color:#e0e0e0; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
          .card { background:#2a2a2a; padding:30px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.4); text-align:center; }
          .key { font-size:28px; font-weight:bold; color:#4dabf7; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Your Daily Key</h1>
          <p class="key">${dailyKey}</p>
        </div>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
