const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "goodreads.db");
let db = null;

// ---------- Helpers ----------

// ORDER BY column and direction cannot use "?" placeholders,
// so we only allow values from these safe lists.
const ALLOWED_ORDER_BY = ["id", "title", "author", "price", "pages"];
const ALLOWED_ORDER = ["ASC", "DESC"];

const isBlank = (value) => typeof value !== "string" || value.trim() === "";

// Returns an error message if the body is invalid, otherwise null
const validateBook = (body) => {
  const { title, author, price, pages } = body || {};

  if (isBlank(title)) {
    return "title is required and must be a non-empty string";
  }
  if (isBlank(author)) {
    return "author is required and must be a non-empty string";
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    return "price is required and must be a non-negative number";
  }
  if (pages !== undefined && (!Number.isInteger(pages) || pages <= 0)) {
    return "pages, if provided, must be a positive whole number";
  }
  return null;
};

// Returns the id as a number, or null if it is not a positive whole number
const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// ---------- Initialize database and start server ----------

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        author TEXT,
        price INTEGER,
        pages INTEGER
      );
    `);

    const books = await db.all("SELECT * FROM book;");

    if (books.length === 0) {
      await db.run(`
        INSERT INTO book (title, author, price, pages)
        VALUES
          ('Harry Potter', 'J.K. Rowling', 500, 350),
          ('The Hobbit', 'J.R.R. Tolkien', 400, 310),
          ('Wings of Fire', 'A.P.J. Abdul Kalam', 250, 180),
          ('The Alchemist', 'Paulo Coelho', 300, 200),
          ('Atomic Habits', 'James Clear', 450, 320),
          ('Rich Dad Poor Dad', 'Robert Kiyosaki', 350, 240),
          ('Think and Grow Rich', 'Napoleon Hill', 280, 260),
          ('Ikigai', 'Hector Garcia', 320, 190),
          ('Deep Work', 'Cal Newport', 400, 280),
          ('The Power of Habit', 'Charles Duhigg', 380, 290);
      `);
    }

    const port = process.env.PORT || 3000;

    // Express 5 passes startup errors (like EADDRINUSE) to this callback
    app.listen(port, (error) => {
      if (error) {
        console.error("Server failed to start:", error.message);
        process.exit(1);
      }
      console.log("Database initialized successfully!");
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Database or Server Error:", error.message);
    process.exit(1);
  }
};

// ---------- Routes ----------

// GET all books: search, filter, sort, paginate
// Example: /books/?search_q=the&min_price=300&max_price=450&order_by=price&order=DESC&limit=5&offset=0
app.get("/books/", async (request, response) => {
  try {
    const {
      search_q = "",
      order_by = "id",
      order = "ASC",
      limit = "10",
      offset = "0",
      min_price = "0",
      max_price,
    } = request.query;

    const orderBy = String(order_by);
    const orderDir = String(order).toUpperCase();
    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    const minPrice = Number(min_price);
    const maxPrice =
      max_price === undefined ? Number.MAX_SAFE_INTEGER : Number(max_price);

    if (!ALLOWED_ORDER_BY.includes(orderBy)) {
      return response.status(400).json({
        message: `order_by must be one of: ${ALLOWED_ORDER_BY.join(", ")}`,
      });
    }
    if (!ALLOWED_ORDER.includes(orderDir)) {
      return response.status(400).json({ message: "order must be ASC or DESC" });
    }
    if (!Number.isInteger(limitNum) || limitNum < 1) {
      return response
        .status(400)
        .json({ message: "limit must be a positive whole number" });
    }
    if (!Number.isInteger(offsetNum) || offsetNum < 0) {
      return response
        .status(400)
        .json({ message: "offset must be a whole number, 0 or more" });
    }
    if (Number.isNaN(minPrice) || Number.isNaN(maxPrice)) {
      return response
        .status(400)
        .json({ message: "min_price and max_price must be numbers" });
    }
    if (minPrice > maxPrice) {
      return response
        .status(400)
        .json({ message: "min_price cannot be greater than max_price" });
    }

    // orderBy and orderDir are safe because they passed the allow-lists above.
    // Everything else goes through "?" placeholders.
    const query = `
      SELECT * FROM book
      WHERE title LIKE ?
        AND price BETWEEN ? AND ?
      ORDER BY ${orderBy} ${orderDir}
      LIMIT ? OFFSET ?;
    `;

    const books = await db.all(query, [
      `%${String(search_q)}%`,
      minPrice,
      maxPrice,
      limitNum,
      offsetNum,
    ]);

    response.status(200).json(books);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// GET one book by id
app.get("/books/:bookId/", async (request, response) => {
  try {
    const bookId = parseId(request.params.bookId);
    if (bookId === null) {
      return response
        .status(400)
        .json({ message: "bookId must be a positive whole number" });
    }

    const book = await db.get("SELECT * FROM book WHERE id = ?;", [bookId]);

    if (!book) {
      return response.status(404).json({ message: "Book not found" });
    }

    response.status(200).json(book);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// POST: add a new book
app.post("/books/", async (request, response) => {
  try {
    const errorMessage = validateBook(request.body);
    if (errorMessage) {
      return response.status(400).json({ message: errorMessage });
    }

    const { title, author, price, pages = null } = request.body;

    const result = await db.run(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?);",
      [title.trim(), author.trim(), price, pages]
    );

    response.status(201).json({
      message: "Book added successfully",
      bookId: result.lastID,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// PUT: update a book by id
app.put("/books/:bookId/", async (request, response) => {
  try {
    const bookId = parseId(request.params.bookId);
    if (bookId === null) {
      return response
        .status(400)
        .json({ message: "bookId must be a positive whole number" });
    }

    const errorMessage = validateBook(request.body);
    if (errorMessage) {
      return response.status(400).json({ message: errorMessage });
    }

    const { title, author, price, pages = null } = request.body;

    const result = await db.run(
      `UPDATE book
       SET title = ?, author = ?, price = ?, pages = ?
       WHERE id = ?;`,
      [title.trim(), author.trim(), price, pages, bookId]
    );

    if (result.changes === 0) {
      return response.status(404).json({ message: "Book not found" });
    }

    response.status(200).json({ message: "Book updated successfully" });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// DELETE: remove a book by id
app.delete("/books/:bookId/", async (request, response) => {
  try {
    const bookId = parseId(request.params.bookId);
    if (bookId === null) {
      return response
        .status(400)
        .json({ message: "bookId must be a positive whole number" });
    }

    const result = await db.run("DELETE FROM book WHERE id = ?;", [bookId]);

    if (result.changes === 0) {
      return response.status(404).json({ message: "Book not found" });
    }

    response.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// ---------- Fallbacks (must stay AFTER all routes) ----------

// Unknown URL
app.use((request, response) => {
  response.status(404).json({ message: "Route not found" });
});

// Error-handling middleware (4 parameters): catches bad JSON bodies etc.
app.use((error, request, response, next) => {
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ message: "Invalid JSON in request body" });
  }
  response.status(500).json({ message: error.message });
});

// ---------- Start ----------
initializeDBAndServer();