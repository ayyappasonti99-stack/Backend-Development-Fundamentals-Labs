const express = require("express");
const path = require("path");
const fs = require("fs");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");

// Safe loader for bcrypt (supports native bcrypt with pure-JS bcryptjs fallback)
let bcrypt;
try {
  bcrypt = require("bcrypt");
} catch (err) {
  bcrypt = require("bcryptjs");
}

const app = express();
app.use(express.json());

// Secret key constant for signing JWT tokens (per Lab 4 instruction; to be moved to .env in Lab 8)
const JWT_SECRET = "AURORA_BACKEND_LABS_SECRET_KEY_2026";
const SALT_ROUNDS = 10;

const isVercel = process.env.VERCEL === "1" || !!process.env.VERCEL;

// Locate userData.db across execution environments
const findOriginalDb = () => {
  const candidatePaths = [
    path.join(__dirname, "userData.db"),
    path.join(process.cwd(), "lab-04", "userData.db"),
    path.join(process.cwd(), "userData.db"),
  ];
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, "userData.db");
};

const originalDbPath = findOriginalDb();
const dbPath = isVercel ? path.join("/tmp", "userData.db") : originalDbPath;

let db = null;
let dbPromise = null;

// ---------- Database Initializer ----------
const getDB = async () => {
  if (!dbPromise) {
    dbPromise = (async () => {
      // In Vercel serverless environments, copy database to writable /tmp
      if (isVercel && fs.existsSync(originalDbPath) && !fs.existsSync(dbPath)) {
        try {
          fs.copyFileSync(originalDbPath, dbPath);
        } catch (copyErr) {
          console.error("Warning: could not copy db to /tmp:", copyErr.message);
        }
      }

      const database = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });

      // Task 2: Create a user table with unique username, name, and hashed password column
      await database.exec(`
        CREATE TABLE IF NOT EXISTS user (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          password TEXT NOT NULL,
          gender TEXT,
          location TEXT
        );
      `);

      // Seed a default test user if the table is empty
      const existingUsers = await database.all("SELECT * FROM user;");
      if (existingUsers.length === 0) {
        const defaultPasswordHash = await bcrypt.hash("rahul@2026", SALT_ROUNDS);
        await database.run(
          `INSERT INTO user (username, name, password, gender, location)
           VALUES (?, ?, ?, ?, ?);`,
          ["rahul", "Rahul Sharma", defaultPasswordHash, "Male", "Hyderabad"]
        );
        console.log("Seeded initial user: rahul (password: rahul@2026)");
      }

      db = database;
      return database;
    })();
  }
  return dbPromise;
};

// Middleware: ensure database is ready
app.use(async (request, response, next) => {
  try {
    await getDB();
    next();
  } catch (error) {
    response.status(500).json({
      message: "Database initialization failed: " + error.message,
    });
  }
});

// Authentication Middleware for Protected Routes
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    return response.status(401).json({ message: "Invalid JWT Token" });
  }

  jwt.verify(jwtToken, JWT_SECRET, (error, payload) => {
    if (error) {
      return response.status(401).json({ message: "Invalid JWT Token" });
    }
    request.username = payload.username;
    next();
  });
};

// ---------- Endpoints ----------

// GET /: Welcome and endpoint overview
app.get("/", (request, response) => {
  response.status(200).json({
    lab: "Lab 4: Registration, login and JWT",
    course: "Backend Development Fundamentals - Year II Term II",
    faculty: "Yugandar Sir",
    student: {
      name: "Ayyappa Sonti",
      registrationNumber: "252U1R3091",
      section: "S-21, CSE DS 2B",
    },
    endpoints: {
      register: {
        method: "POST",
        path: "/register/",
        description: "Registers a new user with bcrypt-hashed password.",
      },
      login: {
        method: "POST",
        path: "/login/",
        description: "Authenticates user and returns a signed JWT token.",
      },
      users: {
        method: "GET",
        path: "/users/",
        description: "Lists all registered users and verifies passwords are stored as hashes.",
      },
      profile: {
        method: "GET",
        path: "/profile/",
        description: "Protected route demonstrating JWT verification with Bearer token header.",
      },
    },
  });
});

// POST /register/: Task 3 - User Registration
app.post(["/register", "/register/"], async (request, response) => {
  try {
    const { username, name, password, gender, location } = request.body || {};

    // Validate presence of username and password
    if (!username || typeof username !== "string" || username.trim() === "") {
      return response.status(400).json({ message: "Username is required" });
    }
    if (!password || typeof password !== "string") {
      return response.status(400).json({ message: "Password is required" });
    }

    // Password length validation
    if (password.length < 5) {
      return response.status(400).json({ message: "Password is too short" });
    }

    const trimmedUsername = username.trim();

    // Check if user already exists
    const selectUserQuery = `SELECT * FROM user WHERE username = ?;`;
    const existingUser = await db.get(selectUserQuery, [trimmedUsername]);

    if (existingUser !== undefined) {
      return response.status(400).json({ message: "User already exists" });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Save new user in database
    const createUserQuery = `
      INSERT INTO user (username, name, password, gender, location)
      VALUES (?, ?, ?, ?, ?);
    `;
    await db.run(createUserQuery, [
      trimmedUsername,
      name && typeof name === "string" ? name.trim() : trimmedUsername,
      hashedPassword,
      gender || null,
      location || null,
    ]);

    return response.status(200).json({ message: "User created successfully" });
  } catch (error) {
    return response.status(500).json({ message: error.message });
  }
});

// POST /login/: Task 4 - User Login & JWT Generation
app.post(["/login", "/login/"], async (request, response) => {
  try {
    const { username, password } = request.body || {};

    if (!username || !password) {
      return response.status(400).json({ message: "Username and password are required" });
    }

    const trimmedUsername = String(username).trim();

    // Query user by username
    const selectUserQuery = `SELECT * FROM user WHERE username = ?;`;
    const dbUser = await db.get(selectUserQuery, [trimmedUsername]);

    // Reject unknown user with 400
    if (dbUser === undefined) {
      return response.status(400).json({ message: "Invalid user" });
    }

    // Compare supplied password with stored bcrypt hash
    const isPasswordMatched = await bcrypt.compare(String(password), dbUser.password);

    if (isPasswordMatched) {
      // Put ONLY username in JWT payload (never the password)
      const payload = { username: dbUser.username };
      const jwtToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });

      return response.status(200).json({ jwt_token: jwtToken });
    } else {
      // Reject incorrect password with 400
      return response.status(400).json({ message: "Invalid password" });
    }
  } catch (error) {
    return response.status(500).json({ message: error.message });
  }
});

// GET /users/: View all users in database (verifies passwords are saved as hashes)
app.get(["/users", "/users/"], async (request, response) => {
  try {
    const users = await db.all("SELECT id, username, name, password, gender, location FROM user;");
    response.status(200).json({
      totalUsers: users.length,
      users: users,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// GET /profile/: Protected route verifying JWT authorization header
app.get(["/profile", "/profile/"], authenticateToken, async (request, response) => {
  try {
    const selectUserQuery = `SELECT id, username, name, gender, location FROM user WHERE username = ?;`;
    const userProfile = await db.get(selectUserQuery, [request.username]);

    if (!userProfile) {
      return response.status(404).json({ message: "User profile not found" });
    }

    response.status(200).json({
      message: "Protected profile accessed successfully using JWT",
      profile: userProfile,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// ---------- Fallback 404 & Error Handlers ----------
app.use((request, response) => {
  response.status(404).json({ message: "Route not found" });
});

app.use((error, request, response, next) => {
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ message: "Invalid JSON in request body" });
  }
  response.status(500).json({ message: error.message });
});

// ---------- Server Initialization ----------
if (!isVercel) {
  const port = process.env.PORT || 3000;
  getDB()
    .then(() => {
      app.listen(port, () => {
        console.log(`Database connected successfully at ${dbPath}`);
        console.log(`Lab 4 Server running on port ${port}`);
      });
    })
    .catch((error) => {
      console.error("Database or Server startup failed:", error.message);
      process.exit(1);
    });
}

module.exports = app;
