const express = require("express");
const path = require("path");
const fs = require("fs");

let sqlite3 = null;
let sqlite = null;
try {
  sqlite3 = require("sqlite3");
  sqlite = require("sqlite");
} catch (e) {
  console.warn("SQLite native bindings not available, using in-memory store");
}

const app = express();
app.use(express.json());

// Determine database path (/tmp is writable on serverless platforms like Vercel)
const isVercel = !!process.env.VERCEL;
let dbPath = path.join(__dirname, "goodreads.db");
if (isVercel) {
  const tmpDbPath = path.join("/tmp", "goodreads.db");
  try {
    if (!fs.existsSync(tmpDbPath) && fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, tmpDbPath);
    }
    dbPath = tmpDbPath;
  } catch (err) {
    console.warn("Could not copy database to /tmp:", err.message);
  }
}

let db = null;
let dbInitPromise = null;

// Initial 10 books seed (used for seeding SQLite and as serverless fallback)
let inMemoryBooks = [
  { id: 1, title: "Harry Potter", author: "J.K. Rowling", price: 500, pages: 350 },
  { id: 2, title: "The Hobbit", author: "J.R.R. Tolkien", price: 400, pages: 310 },
  { id: 3, title: "Wings of Fire", author: "A.P.J. Abdul Kalam", price: 250, pages: 180 },
  { id: 4, title: "The Alchemist", author: "Paulo Coelho", price: 300, pages: 200 },
  { id: 5, title: "Atomic Habits", author: "James Clear", price: 450, pages: 320 },
  { id: 6, title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", price: 350, pages: 240 },
  { id: 7, title: "Think and Grow Rich", author: "Napoleon Hill", price: 280, pages: 260 },
  { id: 8, title: "Ikigai", author: "Hector Garcia", price: 320, pages: 190 },
  { id: 9, title: "Deep Work", author: "Cal Newport", price: 400, pages: 280 },
  { id: 10, title: "The Power of Habit", author: "Charles Duhigg", price: 380, pages: 290 }
];

// ---------- Helpers ----------

const ALLOWED_ORDER_BY = ["id", "title", "author", "price", "pages"];
const ALLOWED_ORDER = ["ASC", "DESC"];

const isBlank = (value) => typeof value !== "string" || value.trim() === "";

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

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Safe database accessor that handles async initialization on serverless
const getDB = async () => {
  if (db) return db;
  if (!sqlite || !sqlite3) return null;

  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        const openedDb = await sqlite.open({
          filename: dbPath,
          driver: sqlite3.Database,
        });

        await openedDb.exec(`
          CREATE TABLE IF NOT EXISTS book (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            author TEXT,
            price INTEGER,
            pages INTEGER
          );
        `);

        const books = await openedDb.all("SELECT * FROM book;");
        if (books.length === 0) {
          for (const book of inMemoryBooks) {
            await openedDb.run(
              "INSERT INTO book (id, title, author, price, pages) VALUES (?, ?, ?, ?, ?);",
              [book.id, book.title, book.author, book.price, book.pages]
            );
          }
        }
        db = openedDb;
        return db;
      } catch (err) {
        console.warn("Database initialization warning:", err.message);
        return null;
      }
    })();
  }
  return dbInitPromise;
};

// Start local server if not running serverless on Vercel
const port = process.env.PORT || 3000;
if (!isVercel) {
  getDB().then(() => {
    app.listen(port, (error) => {
      if (error) {
        console.error("Server failed to start:", error.message);
        process.exit(1);
      }
      console.log("Database initialized successfully!");
      console.log(`Server running on port ${port}`);
    });
  }).catch((err) => {
    console.error("Startup error:", err.message);
  });
}

// ---------- Routes ----------

// Root welcome route
app.get("/", (request, response) => {
  response.status(200).json({
    message: "Welcome to the Books REST API (Lab 3)",
    student: {
      name: "Ayyappa Sonti",
      regNo: "252U1R3091",
      section: "S-21, CSE DS 2B",
      faculty: "Yugandar Sir"
    },
    endpoints: {
      books: "/books/",
      search: "/books/?search_q=the",
      sort: "/books/?order_by=price&order=DESC&limit=5",
      filter: "/books/?min_price=300&max_price=450"
    }
  });
});

// GET all books: search, filter, sort, paginate
app.get(["/books", "/books/"], async (request, response) => {
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

    const database = await getDB();
    if (database) {
      const query = `
        SELECT * FROM book
        WHERE title LIKE ?
          AND price BETWEEN ? AND ?
        ORDER BY ${orderBy} ${orderDir}
        LIMIT ? OFFSET ?;
      `;
      const books = await database.all(query, [
        `%${String(search_q)}%`,
        minPrice,
        maxPrice,
        limitNum,
        offsetNum,
      ]);
      return response.status(200).json(books);
    }

    // Serverless in-memory fallback
    const searchTerm = String(search_q).toLowerCase();
    const filtered = inMemoryBooks.filter((book) => {
      const titleMatch = book.title.toLowerCase().includes(searchTerm);
      const priceMatch = book.price >= minPrice && book.price <= maxPrice;
      return titleMatch && priceMatch;
    });

    filtered.sort((a, b) => {
      const valA = a[orderBy];
      const valB = b[orderBy];
      if (typeof valA === "string") {
        return orderDir === "ASC"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return orderDir === "ASC" ? valA - valB : valB - valA;
    });

    const paginated = filtered.slice(offsetNum, offsetNum + limitNum);
    response.status(200).json(paginated);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// GET one book by id
app.get(["/books/:bookId", "/books/:bookId/"], async (request, response) => {
  try {
    const bookId = parseId(request.params.bookId);
    if (bookId === null) {
      return response
        .status(400)
        .json({ message: "bookId must be a positive whole number" });
    }

    const database = await getDB();
    if (database) {
      const book = await database.get("SELECT * FROM book WHERE id = ?;", [bookId]);
      if (!book) {
        return response.status(404).json({ message: "Book not found" });
      }
      return response.status(200).json(book);
    }

    const book = inMemoryBooks.find((b) => b.id === bookId);
    if (!book) {
      return response.status(404).json({ message: "Book not found" });
    }
    response.status(200).json(book);
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// POST: add a new book
app.post(["/books", "/books/"], async (request, response) => {
  try {
    const errorMessage = validateBook(request.body);
    if (errorMessage) {
      return response.status(400).json({ message: errorMessage });
    }

    const { title, author, price, pages = null } = request.body;

    const database = await getDB();
    if (database) {
      const result = await database.run(
        "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?);",
        [title.trim(), author.trim(), price, pages]
      );
      return response.status(201).json({
        message: "Book added successfully",
        bookId: result.lastID,
      });
    }

    const nextId = inMemoryBooks.length > 0
      ? Math.max(...inMemoryBooks.map((b) => b.id)) + 1
      : 1;
    const newBook = { id: nextId, title: title.trim(), author: author.trim(), price, pages };
    inMemoryBooks.push(newBook);

    response.status(201).json({
      message: "Book added successfully",
      bookId: nextId,
    });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// PUT: update a book by id
app.put(["/books/:bookId", "/books/:bookId/"], async (request, response) => {
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

    const database = await getDB();
    if (database) {
      const result = await database.run(
        `UPDATE book
         SET title = ?, author = ?, price = ?, pages = ?
         WHERE id = ?;`,
        [title.trim(), author.trim(), price, pages, bookId]
      );

      if (result.changes === 0) {
        return response.status(404).json({ message: "Book not found" });
      }
      return response.status(200).json({ message: "Book updated successfully" });
    }

    const index = inMemoryBooks.findIndex((b) => b.id === bookId);
    if (index === -1) {
      return response.status(404).json({ message: "Book not found" });
    }

    inMemoryBooks[index] = {
      ...inMemoryBooks[index],
      title: title.trim(),
      author: author.trim(),
      price,
      pages,
    };

    response.status(200).json({ message: "Book updated successfully" });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// DELETE: remove a book by id
app.delete(["/books/:bookId", "/books/:bookId/"], async (request, response) => {
  try {
    const bookId = parseId(request.params.bookId);
    if (bookId === null) {
      return response
        .status(400)
        .json({ message: "bookId must be a positive whole number" });
    }

    const database = await getDB();
    if (database) {
      const result = await database.run("DELETE FROM book WHERE id = ?;", [bookId]);
      if (result.changes === 0) {
        return response.status(404).json({ message: "Book not found" });
      }
      return response.status(200).json({ message: "Book deleted successfully" });
    }

    const index = inMemoryBooks.findIndex((b) => b.id === bookId);
    if (index === -1) {
      return response.status(404).json({ message: "Book not found" });
    }

    inMemoryBooks.splice(index, 1);
    response.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    response.status(500).json({ message: error.message });
  }
});

// ---------- Fallbacks (must stay AFTER all routes) ----------

app.use((request, response) => {
  response.status(404).json({ message: "Route not found" });
});

app.use((error, request, response, next) => {
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ message: "Invalid JSON in request body" });
  }
  response.status(500).json({ message: error.message });
});

module.exports = app;
