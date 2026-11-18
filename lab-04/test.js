const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("./app");

const PORT = 3099;
const JWT_SECRET = "AURORA_BACKEND_LABS_SECRET_KEY_2026";

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  const server = app.listen(PORT, async () => {
    console.log(`\n===================================================`);
    console.log(`🧪 Running Comprehensive Lab 4 Verification Suite`);
    console.log(`===================================================\n`);

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
      if (condition) {
        console.log(`✅ PASS: ${message}`);
        passed++;
      } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
      }
    }

    try {
      // 1. Welcome route
      const resRoot = await request({ method: "GET", path: "/" });
      assert(resRoot.status === 200 && resRoot.body.lab, "GET / returns welcome and lab details");

      // 2. Register valid user
      const registerRes = await request(
        { method: "POST", path: "/register/" },
        {
          username: "ayyappa",
          name: "Ayyappa Sonti",
          password: "ayyappa@secure2026",
          gender: "Male",
          location: "Hyderabad",
        }
      );
      assert(
        registerRes.status === 200 && registerRes.body.message === "User created successfully",
        "POST /register/ successfully creates user with 200 OK"
      );

      // 3. Register duplicate user
      const dupRes = await request(
        { method: "POST", path: "/register/" },
        {
          username: "ayyappa",
          name: "Ayyappa Sonti",
          password: "anotherpassword",
        }
      );
      assert(
        dupRes.status === 400 && dupRes.body.message === "User already exists",
        "POST /register/ rejects duplicate username with 400 'User already exists'"
      );

      // 4. Register password too short
      const shortPassRes = await request(
        { method: "POST", path: "/register/" },
        {
          username: "testshort",
          name: "Short Pass",
          password: "123",
        }
      );
      assert(
        shortPassRes.status === 400 && shortPassRes.body.message === "Password is too short",
        "POST /register/ rejects short password (<5 chars) with 400 'Password is too short'"
      );

      // 5. Login unknown user
      const unknownUserRes = await request(
        { method: "POST", path: "/login/" },
        {
          username: "nonexistent_user",
          password: "somepassword",
        }
      );
      assert(
        unknownUserRes.status === 400 && unknownUserRes.body.message === "Invalid user",
        "POST /login/ rejects unknown username with 400 'Invalid user'"
      );

      // 6. Login wrong password
      const wrongPassRes = await request(
        { method: "POST", path: "/login/" },
        {
          username: "ayyappa",
          password: "incorrect_password",
        }
      );
      assert(
        wrongPassRes.status === 400 && wrongPassRes.body.message === "Invalid password",
        "POST /login/ rejects wrong password with 400 'Invalid password'"
      );

      // 7. Login valid credentials
      const loginSuccessRes = await request(
        { method: "POST", path: "/login/" },
        {
          username: "ayyappa",
          password: "ayyappa@secure2026",
        }
      );
      assert(
        loginSuccessRes.status === 200 && typeof loginSuccessRes.body.jwt_token === "string",
        "POST /login/ succeeds with 200 OK and returns { jwt_token }"
      );

      const token = loginSuccessRes.body.jwt_token;

      // 8. Verify JWT token payload
      const decoded = jwt.verify(token, JWT_SECRET);
      assert(
        decoded.username === "ayyappa" && decoded.password === undefined,
        "JWT payload contains username and strictly NO password"
      );

      // 9. Inspect Database to ensure passwords are stored as hashes
      const usersRes = await request({ method: "GET", path: "/users/" });
      const storedAyyappa = usersRes.body.users.find((u) => u.username === "ayyappa");
      const isHash = storedAyyappa && storedAyyappa.password.startsWith("$2");
      assert(
        isHash,
        `Database stores hashed password only (stored hash: ${storedAyyappa ? storedAyyappa.password.substring(0, 20) + "..." : "none"})`
      );

      // 10. Access protected route with Bearer token
      const profileRes = await request({
        method: "GET",
        path: "/profile/",
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(
        profileRes.status === 200 && profileRes.body.profile.username === "ayyappa",
        "GET /profile/ allows access with valid JWT Bearer token"
      );

      // 11. Access protected route without token
      const noTokenRes = await request({ method: "GET", path: "/profile/" });
      assert(
        noTokenRes.status === 401 && noTokenRes.body.message === "Invalid JWT Token",
        "GET /profile/ denies access with 401 when no token is provided"
      );

      console.log(`\n---------------------------------------------------`);
      console.log(`Summary: ${passed} passed, ${failed} failed`);
      console.log(`---------------------------------------------------\n`);
    } catch (err) {
      console.error("Test error:", err);
    } finally {
      server.close();
      process.exit(failed === 0 ? 0 : 1);
    }
  });
}

runTests();
