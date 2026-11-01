const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const dbPath = path.join(__dirname, 'books.db');

const initialBooks = [
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

async function setupDatabase() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  console.log('Connected to SQLite database at:', dbPath);

  await db.exec(`
    DROP TABLE IF EXISTS book;
    CREATE TABLE book (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      price INTEGER NOT NULL,
      pages INTEGER NOT NULL
    );
  `);

  console.log('Created table "book".');

  for (const book of initialBooks) {
    await db.run(
      `INSERT INTO book (id, title, author, price, pages) VALUES (?, ?, ?, ?, ?);`,
      [book.id, book.title, book.author, book.price, book.pages]
    );
  }

  const rows = await db.all('SELECT * FROM book;');
  console.log(`Successfully seeded ${rows.length} books into the database:`);
  console.table(rows);

  await db.close();
  console.log('Database setup complete.');
}

setupDatabase().catch((err) => {
  console.error('Error setting up database:', err);
  process.exit(1);
});

