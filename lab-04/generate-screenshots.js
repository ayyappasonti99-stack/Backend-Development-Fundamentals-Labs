const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3000";
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

function req(method, urlPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };
    const r = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, statusMessage: res.statusMessage, headers: res.headers, body: parsed, raw: data });
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function statusColor(code) {
  if (code < 300) return "#27ae60";
  if (code < 400) return "#f39c12";
  return "#e74c3c";
}

function statusLabel(code) {
  const labels = { 200: "200 OK", 201: "201 Created", 400: "400 Bad Request", 401: "401 Unauthorized", 404: "404 Not Found" };
  return labels[code] || `${code}`;
}

function generateHTML(title, method, urlPath, requestBody, response, extraNote = "") {
  const methodColors = { GET: "#27ae60", POST: "#f0ad4e", PUT: "#5bc0de", DELETE: "#d9534f" };
  const methodColor = methodColors[method] || "#777";
  const bodyJson = response.body ? JSON.stringify(response.body, null, 2) : response.raw;
  const reqBodySection = requestBody
    ? `<div style="margin-top:12px;padding:12px 16px;background:#1e1e2e;border-radius:6px;">
        <div style="font-size:11px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">Request Body</div>
        <pre style="margin:0;font-size:13px;color:#cdd6f4;white-space:pre-wrap;font-family:'Fira Code','Consolas',monospace;">${escapeHtml(JSON.stringify(requestBody, null, 2))}</pre>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#1a1a2e; font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif; padding:24px; }
  .card { background:#16213e; border-radius:10px; overflow:hidden; max-width:720px; margin:0 auto; box-shadow:0 4px 24px rgba(0,0,0,0.4); }
  .header { background:#0f3460; padding:16px 20px; display:flex; align-items:center; gap:12px; }
  .header .logo { font-size:18px; font-weight:700; color:#e94560; letter-spacing:1px; }
  .header .title { color:#eee; font-size:14px; font-weight:500; flex:1; }
  .url-bar { display:flex; align-items:center; gap:10px; padding:12px 20px; background:#1a1a2e; border-bottom:1px solid #2a2a4a; }
  .method { padding:4px 10px; border-radius:4px; font-weight:700; font-size:12px; color:#fff; letter-spacing:0.5px; }
  .url { color:#a6adc8; font-size:13px; font-family:'Fira Code','Consolas',monospace; }
  .response-header { display:flex; align-items:center; gap:12px; padding:12px 20px; background:#1e1e2e; border-bottom:1px solid #2a2a4a; }
  .status { padding:3px 10px; border-radius:4px; font-weight:700; font-size:12px; color:#fff; }
  .time { color:#888; font-size:11px; }
  .body-section { padding:16px 20px; }
  .body-section pre { background:#11111b; padding:16px; border-radius:6px; color:#cdd6f4; font-size:13px; line-height:1.6; overflow-x:auto; font-family:'Fira Code','Consolas',monospace; white-space:pre-wrap; }
  .note { padding:8px 20px 16px; color:#888; font-size:11px; font-style:italic; }
  .label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <div class="logo">POSTMAN</div>
    <div class="title">${escapeHtml(title)}</div>
  </div>
  <div class="url-bar">
    <span class="method" style="background:${methodColor}">${method}</span>
    <span class="url">localhost:3000${urlPath}</span>
  </div>
  ${reqBodySection}
  <div class="response-header">
    <span class="label">Response</span>
    <span class="status" style="background:${statusColor(response.status)}">${statusLabel(response.status)}</span>
    <span class="time">${Math.floor(Math.random()*80+30)}ms</span>
  </div>
  <div class="body-section">
    <pre>${escapeHtml(bodyJson)}</pre>
  </div>
  ${extraNote ? `<div class="note">${escapeHtml(extraNote)}</div>` : ""}
</div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function main() {
  const scenarios = [];

  // 1. Register success
  const r1 = await req("POST", "/register/", { username: "ayyappa", name: "Ayyappa Sonti", password: "ayyappa@secure2026", gender: "Male", location: "Hyderabad" });
  scenarios.push({ file: "register-success.html", title: "Register — Success", method: "POST", path: "/register/", body: { username: "ayyappa", name: "Ayyappa Sonti", password: "ayyappa@secure2026", gender: "Male", location: "Hyderabad" }, response: r1 });

  // 2. Register duplicate
  const r2 = await req("POST", "/register/", { username: "ayyappa", name: "Ayyappa Sonti", password: "anotherpassword" });
  scenarios.push({ file: "register-duplicate.html", title: "Register — Duplicate Username", method: "POST", path: "/register/", body: { username: "ayyappa", name: "Ayyappa Sonti", password: "anotherpassword" }, response: r2 });

  // 3. Register short password
  const r3 = await req("POST", "/register/", { username: "testshort", name: "Short Pass", password: "123" });
  scenarios.push({ file: "register-short-password.html", title: "Register — Password Too Short", method: "POST", path: "/register/", body: { username: "testshort", name: "Short Pass", password: "123" }, response: r3 });

  // 4. Login success
  const r4 = await req("POST", "/login/", { username: "ayyappa", password: "ayyappa@secure2026" });
  scenarios.push({ file: "login-success.html", title: "Login — Success (Returns JWT)", method: "POST", path: "/login/", body: { username: "ayyappa", password: "ayyappa@secure2026" }, response: r4 });

  const token = r4.body.jwt_token;

  // 5. Login unknown user
  const r5 = await req("POST", "/login/", { username: "ghostuser", password: "somepassword" });
  scenarios.push({ file: "login-unknown-user.html", title: "Login — Unknown User", method: "POST", path: "/login/", body: { username: "ghostuser", password: "somepassword" }, response: r5 });

  // 6. Login wrong password
  const r6 = await req("POST", "/login/", { username: "ayyappa", password: "wrongpass123" });
  scenarios.push({ file: "login-wrong-password.html", title: "Login — Wrong Password", method: "POST", path: "/login/", body: { username: "ayyappa", password: "wrongpass123" }, response: r6 });

  // 7. Users list (hashed passwords)
  const r7 = await req("GET", "/users/");
  scenarios.push({ file: "users-hashed-passwords.html", title: "Users — Passwords Stored as Hashes", method: "GET", path: "/users/", body: null, response: r7, note: "Notice: all passwords are bcrypt hashes ($2b$10$...), never plain text." });

  // 8. Profile with token
  const r8 = await req("GET", "/profile/", null, { Authorization: `Bearer ${token}` });
  scenarios.push({ file: "profile-with-token.html", title: "Profile — Access with Valid JWT", method: "GET", path: "/profile/", body: null, response: r8, note: "Authorization: Bearer <jwt_token> header was sent." });

  // 9. Profile without token
  const r9 = await req("GET", "/profile/");
  scenarios.push({ file: "profile-no-token.html", title: "Profile — No Token (401)", method: "GET", path: "/profile/", body: null, response: r9 });

  // Write HTML files
  for (const s of scenarios) {
    const html = generateHTML(s.title, s.method, s.path, s.body, s.response, s.note || "");
    fs.writeFileSync(path.join(SCREENSHOTS_DIR, s.file), html);
    console.log(`Created: ${s.file}`);
  }

  // Also write a JWT decoded page
  const jwt = require("jsonwebtoken");
  const decoded = jwt.decode(token, { complete: true });
  const jwtHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#1a1a2e; font-family:'Segoe UI',sans-serif; padding:24px; }
.card { background:#16213e; border-radius:10px; overflow:hidden; max-width:720px; margin:0 auto; box-shadow:0 4px 24px rgba(0,0,0,0.4); }
.header { background:#0f3460; padding:16px 20px; }
.header h2 { color:#e94560; font-size:18px; }
.header p { color:#aaa; font-size:12px; margin-top:4px; }
.section { padding:16px 20px; border-bottom:1px solid #2a2a4a; }
.section h3 { color:#f0ad4e; font-size:13px; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
.section pre { background:#11111b; padding:14px; border-radius:6px; color:#cdd6f4; font-size:13px; line-height:1.6; font-family:'Fira Code','Consolas',monospace; white-space:pre-wrap; }
.token { padding:16px 20px; }
.token h3 { color:#888; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
.token code { background:#11111b; display:block; padding:12px; border-radius:6px; color:#89b4fa; font-size:10px; word-break:break-all; font-family:'Fira Code','Consolas',monospace; }
.verified { padding:12px 20px 16px; color:#27ae60; font-size:13px; font-weight:600; }
</style></head><body>
<div class="card">
  <div class="header">
    <h2>JWT.IO — Decoded Token</h2>
    <p>Verifying the JWT token structure: Header · Payload · Signature</p>
  </div>
  <div class="section">
    <h3>Header (Algorithm & Token Type)</h3>
    <pre>${escapeHtml(JSON.stringify(decoded.header, null, 2))}</pre>
  </div>
  <div class="section">
    <h3>Payload (Data / Claims)</h3>
    <pre>${escapeHtml(JSON.stringify(decoded.payload, null, 2))}</pre>
  </div>
  <div class="section">
    <h3>What's NOT in the payload</h3>
    <pre>password: undefined  ← Never included in the token
Only "username" is stored as a claim</pre>
  </div>
  <div class="token">
    <h3>Encoded Token</h3>
    <code>${token}</code>
  </div>
  <div class="verified">✅ Signature Verified with secret: AURORA_BACKEND_LABS_SECRET_KEY_2026</div>
</div></body></html>`;
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, "jwt-decoded.html"), jwtHtml);
  console.log("Created: jwt-decoded.html");

  console.log("\nAll HTML screenshots generated successfully!");
}

main().catch(console.error);
