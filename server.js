const express = require("express");
const path = require("path");
const app = express();

const PORT = process.env.PORT || 3000;
const DEBUG = true; // set to false in production

// Memory store
let users = {};

// Helper to get client IP
function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.connection?.remoteAddress ||
    req.ip ||
    null
  );
}

// Home page (get key)
app.get("/", (req, res) => {
  const ip = getClientIp(req);

  if (!ip) {
    return res.send("<h3 style='color:red'>Error: Could not detect IP</h3>");
  }

  const user = users[ip];
  let message = "";

  if (!user) {
    // brand new
    users[ip] = { completed: false, startTime: Date.now(), expireTime: null };
    if (DEBUG) message = "<p style='color:green'>New user detected 01</p>";
  } else {
    // check if expired
    if (user.expireTime && Date.now() > user.expireTime) {
      delete users[ip];
      users[ip] = { completed: false, startTime: Date.now(), expireTime: null };
      if (DEBUG) message = "<p style='color:green'>Session expired, new user reset</p>";
    }
  }

  const current = users[ip];

  // glitch prevention: if they come back <45s after start
  if (!current.completed && Date.now() - current.startTime < 45 * 1000) {
    delete users[ip];
    users[ip] = { completed: false, startTime: Date.now(), expireTime: null };
    return res.send(
      `<h3>Get Key Page</h3>
       <p style="color:red">Loot lab not complete, try again</p>`
    );
  }

  // if completed + still valid
  if (current.completed) {
    const key = "YOUR_SECRET_KEY";
    // clear their data once key is given
    delete users[ip];
    return res.send(`<h3>Your Key: ${key}</h3>${message}`);
  }

  // not yet completed
  res.send(
    `<h3>Get Key Page</h3>
     <a href="https://loot-link.com/s?BYbSlUsE&puid=${ip}" target="_blank">Do LootLab</a>
     ${message}`
  );
});

// Callback from LootLabs
app.get("/api/lootlabs", (req, res) => {
  const ip = getClientIp(req);

  if (!ip) {
    return res.send("Missing IP (could not resolve client IP)");
  }

  const user = users[ip];
  if (!user) {
    return res.send("Unknown user (no record for this IP)");
  }

  // mark as completed
  user.completed = true;
  user.expireTime = Date.now() + 3 * 60 * 1000;

  res.redirect("/");
});

// Static for testing
app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
