const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();

app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Debug flag
const debugMode = true;

// Store users by IP
const users = {};

// Utility: get client IP
function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection.remoteAddress ||
    req.ip
  );
}

// Utility: generate fake key (replace with your system)
function getDailyKey() {
  return "KEY-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Main page (Get Key / Show Key)
app.get("/", (req, res) => {
  const ip = getIp(req);
  const user = users[ip];

  let debugMsg = "";

  if (debugMode) {
    if (!user) {
      debugMsg = `<p style="color:green;">New user detected 01</p>`;
    } else if (!user.completed && Date.now() - user.startTime < 45000) {
      debugMsg = `<p style="color:red;">Loot lab not complete, try again</p>`;
    }
  }

  // If user has completed and not expired
  if (user && user.completed && Date.now() < user.expireTime) {
    const key = getDailyKey();

    // Clear IP so they must do it again next time
    delete users[ip];

    res.send(`
      <h1>Your Key</h1>
      <p>${key}</p>
      ${debugMsg}
    `);
  } else {
    res.send(`
      <h1>Get Key</h1>
      <form action="/get-key" method="post">
        <button type="submit">Get Key</button>
      </form>
      ${debugMsg}
    `);
  }
});

// Handle "Get Key" button click → redirect to LootLabs
app.post("/get-key", (req, res) => {
  const ip = getIp(req);

  // Reset old data if exists
  users[ip] = {
    startTime: Date.now(),
    completed: false,
    expireTime: null,
  };

  // Redirect to LootLabs with IP tracking
  res.redirect(
    `https://loot-link.com/s?BYbSlUsE&puid=${ip}`
  );
});

// Callback from LootLabs
app.get("/api/lootlabs", (req, res) => {
  const ip = req.query.ip;
  if (!ip) {
    return res.send("Missing IP");
  }

  const user = users[ip];
  if (!user) {
    return res.send("Unknown user (no record)");
  }

  // Mark as completed and set 3 min expiry
  user.completed = true;
  user.expireTime = Date.now() + 3 * 60 * 1000;

  res.redirect("/");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
