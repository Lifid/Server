// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ==== CONFIG ====
const DEBUG = true;                // show subtle debug messages on the page
const MIN_WAIT_MS = 45_000;        // must wait 45s before key can show (glitch prevention)
const SESSION_LIFETIME_MS = 180_000; // 3 minutes total from when user clicks "Get Key"

// In-memory sessions indexed by IP: { createdAt, expiresAt, completed }
const sessions = new Map();

// ---- Helpers ----
function getDailyKey() {
  try {
    const data = fs.readFileSync(path.join(__dirname, "dailykey.json"), "utf8");
    return JSON.parse(data).key;
  } catch (e) {
    return "(dailykey.json missing)";
  }
}

function getClientIp(req) {
  // Prefer x-forwarded-for (Render/Heroku), fallback to socket
  const xf = req.headers["x-forwarded-for"];
  let ip = (xf && xf.split(",")[0].trim()) || req.socket?.remoteAddress || req.ip || "";
  // Normalize IPv6-mapped IPv4 (::ffff:1.2.3.4)
  if (ip.startsWith("::ffff:")) ip = ip.substring(7);
  return ip;
}

function renderPage(res, { title, bodyHtml }) {
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root{
      --bg:#1e1e1e; --card:#2a2a2a; --text:#e0e0e0; --primary:#4dabf7; --primaryHover:#339af0; --ok:#00d084; --warn:#ff6b6b;
    }
    *{box-sizing:border-box}
    body{
      margin:0; height:100vh; display:flex; align-items:center; justify-content:center;
      background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;
    }
    .card{
      width:min(560px, 92vw); background:var(--card); padding:36px; border-radius:16px;
      box-shadow:0 8px 30px rgba(0,0,0,0.5); text-align:center;
    }
    h1{ margin:0 0 10px; color:var(--primary); font-weight:700; letter-spacing:.2px; }
    p{ margin:8px 0; line-height:1.5; opacity:.92; }
    .actions{ margin-top:22px; }
    button{
      appearance:none; border:0; background:var(--primary); color:#fff; font-weight:600;
      padding:14px 22px; border-radius:10px; cursor:pointer; font-size:16px; transition:.2s transform,.2s background;
      box-shadow:0 6px 18px rgba(77,171,247,.2);
    }
    button:hover{ background:var(--primaryHover); transform:translateY(-1px); }
    .key{
      font-size:28px; margin-top:16px; color:#00ff95; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      word-break:break-all;
    }
    .debug{ margin-top:12px; font-size:13px; opacity:.95; }
    .debug.ok{ color:var(--ok); }
    .debug.warn{ color:var(--warn); }
    .muted{ opacity:.7; font-size:14px; margin-top:8px; }
  </style>
</head>
<body>
  <div class="card">
    ${bodyHtml}
  </div>
</body>
</html>`);
}

// ---- Routes ----

// Single-page flow: show Get Key or the Key depending on server state
app.get("/", (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const sess = sessions.get(ip);

  let debugHtml = "";
  let bodyHtml = "";

  // No session: show Get Key + "New user detected 01"
  if (!sess) {
    if (DEBUG) debugHtml = `<div class="debug ok">New user detected 01</div>`;
    bodyHtml = `
      <h1>🔑 Get Daily Key</h1>
      <p class="muted">Complete the LootLabs step to reveal today's key.</p>
      <div class="actions">
        <form action="/key" method="get">
          <button type="submit">Go to LootLabs</button>
        </form>
      </div>
      ${debugHtml}
    `;
    return renderPage(res, { title: "Get Key", bodyHtml });
  }

  // Session present: check expiry
  if (now > sess.expiresAt) {
    sessions.delete(ip);
    if (DEBUG) debugHtml = `<div class="debug ok">Session expired • reset</div>`;
    bodyHtml = `
      <h1>🔑 Get Daily Key</h1>
      <p class="muted">Your previous attempt expired. Start again.</p>
      <div class="actions">
        <form action="/key" method="get">
          <button type="submit">Go to LootLabs</button>
        </form>
      </div>
      ${debugHtml}
    `;
    return renderPage(res, { title: "Get Key", bodyHtml });
  }

  // If not completed yet:
  if (!sess.completed) {
    // If they came back too early (<45s since starting), wipe and show Get Key with warning
    if (now - sess.createdAt < MIN_WAIT_MS) {
      sessions.delete(ip);
      if (DEBUG) debugHtml = `<div class="debug warn">Loot lab not complete, try again</div>`;
    } else {
      // Wait time passed but they still didn't complete—let them try again without warning
      if (DEBUG) debugHtml = `<div class="debug ok">You can retry LootLabs</div>`;
      sessions.delete(ip); // clear old attempt so "Get Key" restarts timer cleanly
    }

    bodyHtml = `
      <h1>🔑 Get Daily Key</h1>
      <p class="muted">Click below to begin. You have 3 minutes to complete.</p>
      <div class="actions">
        <form action="/key" method="get">
          <button type="submit">Go to LootLabs</button>
        </form>
      </div>
      ${debugHtml}
    `;
    return renderPage(res, { title: "Get Key", bodyHtml });
  }

  // Completed: enforce minimum wait (glitch prevention)
  if (now - sess.createdAt < MIN_WAIT_MS) {
    sessions.delete(ip);
    if (DEBUG) debugHtml = `<div class="debug warn">Loot lab not complete, try again</div>`;
    bodyHtml = `
      <h1>🔑 Get Daily Key</h1>
      <p class="muted">Please try again.</p>
      <div class="actions">
        <form action="/key" method="get">
          <button type="submit">Go to LootLabs</button>
        </form>
      </div>
      ${debugHtml}
    `;
    return renderPage(res, { title: "Get Key", bodyHtml });
  }

  // Completed AND waited at least 45s AND not expired -> show key and clear record
  const key = getDailyKey();
  sessions.delete(ip); // clear IP after giving the key (your request)

  bodyHtml = `
    <h1>🎉 Key Unlocked</h1>
    <p class="muted">Here is today's key:</p>
    <div class="key">${key}</div>
  `;
  return renderPage(res, { title: "Your Key", bodyHtml });
});

// Start a session and redirect to LootLabs
app.get("/key", (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();
  sessions.set(ip, {
    createdAt: now,
    expiresAt: now + SESSION_LIFETIME_MS,
    completed: false,
  });

  // Your LootLabs link; keep the puid if LootLabs prefers it, but our logic uses IP on return
  const lootlabsUrl = `https://loot-link.com/s?BYbSlUsE&puid=${encodeURIComponent(ip)}`;
  return res.redirect(lootlabsUrl);
});

// LootLabs destination URL -> mark completed for that IP and return home
app.get("/api/lootlabs", (req, res) => {
  const ip = getClientIp(req);
  const sess = sessions.get(ip);
  const now = Date.now();

  if (DEBUG) {
    console.log("[/api/lootlabs] ip:", ip, "hasSession:", !!sess, "time:", now);
  }

  // Only mark complete if there was a session started in the last 3 minutes
  if (!sess || now > sess.expiresAt) {
    // Either no session or expired -> back to start
    sessions.delete(ip);
    return res.redirect("/");
  }

  // Mark as completed (we still enforce 45s wait back on "/")
  sess.completed = true;
  sessions.set(ip, sess);

  return res.redirect("/"); // URL stays '/'
});

// Optional housekeeping: periodically remove stale sessions (in case users vanish)
setInterval(() => {
  const now = Date.now();
  for (const [ip, sess] of sessions.entries()) {
    if (now > sess.expiresAt) sessions.delete(ip);
  }
}, 60_000);

// ---- Start server ----
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
