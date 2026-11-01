const express = require('express');
const path = require('path');

let sqlite = null;
let sqlite3 = null;
try {
  sqlite = require('sqlite');
  sqlite3 = require('sqlite3');
} catch (e) {
  // Serverless fallback if native C++ bindings cannot load
}

const app = express();
app.use(express.json());

// Request and status code logger middleware
app.use((request, response, next) => {
  response.on('finish', () => {
    console.log(`[${request.method}] ${request.originalUrl} -> Status: ${response.statusCode}`);
  });
  next();
});

const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'books.db');

let db = null;

// Initial book seed for in-memory fallback (used if native sqlite3 binary is restricted on serverless platforms)
let inMemoryBooks = [
  { id: 1, title: 'Clean Code', author: 'Robert C. Martin', price: 650, pages: 464 },
  { id: 2, title: 'The Pragmatic Programmer', author: 'Andrew Hunt', price: 720, pages: 352 },
  { id: 3, title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', price: 1200, pages: 1312 },
  { id: 4, title: 'JavaScript: The Good Parts', author: 'Douglas Crockford', price: 450, pages: 176 },
  { id: 5, title: 'Design Patterns', author: 'Erich Gamma', price: 850, pages: 395 },
  { id: 6, title: "You Don't Know JS Yet", author: 'Kyle Simpson', price: 500, pages: 142 },
  { id: 7, title: 'Refactoring', author: 'Martin Fowler', price: 780, pages: 448 },
  { id: 8, title: 'Cracking the Coding Interview', author: 'Gayle Laakmann McDowell', price: 900, pages: 687 },
  { id: 9, title: 'Head First Design Patterns', author: 'Eric Freeman', price: 699, pages: 694 },
  { id: 10, title: 'Database System Concepts', author: 'Abraham Silberschatz', price: 1100, pages: 1376 }
];

// Task 3: Initialize SQLite DB and Start Server
const initializeDBAndServer = async () => {
  try {
    if (sqlite && sqlite3) {
      db = await sqlite.open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      console.log('Connected to SQLite database successfully');
    }
    app.listen(PORT, () => {
      console.log(`Server Running at http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
};

initializeDBAndServer();

// Root route
app.get('/', (request, response) => {
  response.send('Welcome to the Books SQLite API (Lab 2)');
});

// Task 4 & 5: GET /books/ - Get all books
app.get(['/books', '/books/'], async (request, response) => {
  if (db) {
    const getBooksQuery = `
      SELECT
        *
      FROM
        book
      ORDER BY
        id;
    `;
    const booksArray = await db.all(getBooksQuery);
    return response.send(booksArray);
  }
  response.send(inMemoryBooks);
});

// Task 4 & 5: GET /books/:bookId/ - Get single book by ID
app.get(['/books/:bookId', '/books/:bookId/'], async (request, response) => {
  const { bookId } = request.params;
  if (db) {
    const getBookQuery = `
      SELECT
        *
      FROM
        book
      WHERE
        id = ?;
    `;
    const book = await db.get(getBookQuery, [bookId]);
    if (book === undefined) {
      return response.status(404).send('Book Not Found');
    }
    return response.send(book);
  }

  const book = inMemoryBooks.find((b) => b.id === parseInt(bookId));
  if (!book) {
    return response.status(404).send('Book Not Found');
  }
  response.send(book);
});

// Task 4 & 5: POST /books/ - Add a new book
app.post(['/books', '/books/'], async (request, response) => {
  const bookDetails = request.body;
  const { title, author, price, pages } = bookDetails;

  if (db) {
    const addBookQuery = `
      INSERT INTO
        book (title, author, price, pages)
      VALUES
        (?, ?, ?, ?);
    `;
    const dbResponse = await db.run(addBookQuery, [title, author, price, pages]);
    const bookId = dbResponse.lastID;
    return response.status(201).send({ bookId: bookId, message: 'Book Successfully Added' });
  }

  const newId = inMemoryBooks.length > 0 ? Math.max(...inMemoryBooks.map((b) => b.id)) + 1 : 1;
  const newBook = { id: newId, title, author, price: parseInt(price), pages: parseInt(pages) };
  inMemoryBooks.push(newBook);
  response.status(201).send({ bookId: newId, message: 'Book Successfully Added' });
});

// Task 4 & 5: PUT /books/:bookId/ - Update an existing book
app.put(['/books/:bookId', '/books/:bookId/'], async (request, response) => {
  const { bookId } = request.params;
  const bookDetails = request.body;
  const { title, author, price, pages } = bookDetails;

  if (db) {
    const updateBookQuery = `
      UPDATE
        book
      SET
        title = ?,
        author = ?,
        price = ?,
        pages = ?
      WHERE
        id = ?;
    `;
    await db.run(updateBookQuery, [title, author, price, pages, bookId]);
    return response.send('Book Updated Successfully');
  }

  const index = inMemoryBooks.findIndex((b) => b.id === parseInt(bookId));
  if (index !== -1) {
    inMemoryBooks[index] = {
      ...inMemoryBooks[index],
      title: title || inMemoryBooks[index].title,
      author: author || inMemoryBooks[index].author,
      price: price ? parseInt(price) : inMemoryBooks[index].price,
      pages: pages ? parseInt(pages) : inMemoryBooks[index].pages
    };
    return response.send('Book Updated Successfully');
  }
  response.status(404).send('Book Not Found');
});

// Task 4 & 5: DELETE /books/:bookId/ - Remove a book
app.delete(['/books/:bookId', '/books/:bookId/'], async (request, response) => {
  const { bookId } = request.params;

  if (db) {
    const deleteBookQuery = `
      DELETE FROM
        book
      WHERE
        id = ?;
    `;
    await db.run(deleteBookQuery, [bookId]);
    return response.send('Book Deleted Successfully');
  }

  inMemoryBooks = inMemoryBooks.filter((b) => b.id !== parseInt(bookId));
  response.send('Book Deleted Successfully');
});

module.exports = app;
