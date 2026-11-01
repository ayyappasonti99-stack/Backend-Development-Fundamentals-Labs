# Lab 2: SQLite database and CRUD routes

**Student Name:** Sonti Ayyappa Vigna Kumar · **Registration Number:** 252U1R3091 · **Section:** CSE-DS-2B(307)  
**Course:** Backend Development Fundamentals (Year II Term II) · **Faculty:** Yugandhar Sir · **Institution:** Aurora Deemed to be University  
**GitHub Repository:** [https://github.com/ayyappasonti99-stack/Backend-Development-Fundamentals-Labs](https://github.com/ayyappasonti99-stack/Backend-Development-Fundamentals-Labs)  
**Live Link:** [https://backend-development-fundamentals-labs.vercel.app](https://backend-development-fundamentals-labs.vercel.app) *(or Not applicable / pending deployment)*

---

## Table of Contents
1. [Objective](#objective)
2. [Database Schema and Initial Seed](#database-schema-and-initial-seed)
3. [How to Run](#how-to-run)
4. [Endpoints and HTTP Methods](#endpoints-and-http-methods)
5. [Screenshots of Working Endpoints](#screenshots-of-working-endpoints)
6. [Notes: Problems Faced & Solutions](#notes-problems-faced--solutions)
7. [Viva Questions & Answers](#viva-questions--answers)

---

## Objective
Connect an Express.js web server to an SQLite database (`books.db`) using the `sqlite` and `sqlite3` packages and expose full CRUD (Create, Read, Update, Delete) operations over HTTP using parameterized queries to prevent SQL injection.

---

## Database Schema and Initial Seed
The database table `book` is defined as:
```sql
CREATE TABLE book (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  price INTEGER NOT NULL,
  pages INTEGER NOT NULL
);
```

The database is seeded with 10 initial book records covering computer science classics and software engineering reference books:
1. *Clean Code* by Robert C. Martin
2. *The Pragmatic Programmer* by Andrew Hunt
3. *Introduction to Algorithms* by Thomas H. Cormen
4. *JavaScript: The Good Parts* by Douglas Crockford
5. *Design Patterns* by Erich Gamma
6. *You Don't Know JS Yet* by Kyle Simpson
7. *Refactoring* by Martin Fowler
8. *Cracking the Coding Interview* by Gayle Laakmann McDowell
9. *Head First Design Patterns* by Eric Freeman
10. *Database System Concepts* by Abraham Silberschatz

---

## How to Run

### 1. Prerequisites
- **Node.js** (v18.x or later installed)
- **npm** (v9.x or later installed)
- **SQLite3** (optional, for CLI inspection)

### 2. Installation
Clone the repository and install all dependencies:
```bash
# Clone the course repository
git clone https://github.com/ayyappasonti99-stack/Backend-Development-Fundamentals-Labs.git

# Navigate into the lab-02 folder
cd Backend-Development-Fundamentals-Labs/lab-02

# Install required dependencies
npm install
```

### 3. Environment Variables
Create a `.env` file in the `lab-02/` directory (optional; default fallbacks are configured in code, with no real sensitive values committed):
```env
PORT=3000
STUDENT_NAME=Sonti Ayyappa Vigna Kumar
STUDENT_REG_NO=252U1R3091
STUDENT_SECTION=CSE-DS-2B(307)
```

### 4. Database Initialization (Seed / Reset)
To initialize or reset `books.db` with the initial 10 book records:
```bash
node init-db.js
```

### 5. Starting the Server
- **Development Mode (with auto-reload using `nodemon`):**
  ```bash
  npm run dev
  # Server starts on http://localhost:3000/
  ```

- **Production Mode:**
  ```bash
  npm start
  ```

---

## Endpoints and HTTP Methods

| HTTP Method | Route Path | Description | Expected Status Code | Request Body / Params |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Root API welcome message | `200 OK` | None |
| `GET` | `/books/` | Retrieves all books ordered by ID | `200 OK` | None |
| `GET` | `/books/:bookId/` | Retrieves a single book by primary key ID | `200 OK` / `404 Not Found` | `bookId` (route param) |
| `POST` | `/books/` | Inserts a new book into the database | `201 Created` / `400 Bad Request` | JSON: `{ title, author, price, pages }` |
| `PUT` | `/books/:bookId/` | Updates an existing book's details by ID | `200 OK` / `404 Not Found` | `bookId` + JSON update fields |
| `DELETE` | `/books/:bookId/` | Deletes a book from the database by ID | `200 OK` / `404 Not Found` | `bookId` (route param) |

---

## Screenshots of Working Endpoints

### 1. GET `/books/` - Fetch All Books
![GET All Books](screenshots/01_get_all_books.png)

### 2. GET `/books/:bookId/` - Fetch Single Book by ID
![GET Single Book](screenshots/02_get_single_book.png)

### 3. POST `/books/` - Add New Book (Returns 201 Created)
![POST Add Book](screenshots/03_post_add_book.png)

### 4. PUT `/books/:bookId/` - Update Existing Book
![PUT Update Book](screenshots/04_put_update_book.png)

### 5. DELETE `/books/:bookId/` - Delete Book by ID
![DELETE Book](screenshots/05_delete_book.png)

### 6. Error Handling: GET `/books/999/` (404 Not Found)
![GET 404 Route](screenshots/06_get_404_not_found.png)

### 7. Thunder Client API Client View (`GET /books/`)
![Thunder Client API View](screenshots/07_sqlite_cli_view.png)

---

## Notes: Problems Faced & Solutions

1. **Race Condition Between Database Connection and Server Start:**
   - *Problem:* Calling `app.listen()` before the SQLite connection has resolved leads to incoming HTTP requests querying an uninitialized `db = null` reference, causing server crashes.
   - *Solution:* Implemented the `initializeDBAndServer()` async function that uses `await open(...)` to guarantee the database connection is fully established before invoking `app.listen(PORT)`.

2. **Preventing SQL Injection with Parameterized Queries:**
   - *Problem:* Concatenating user inputs directly into SQL strings (e.g., `WHERE id = ${bookId}`) exposes the database to severe SQL injection vulnerabilities.
   - *Solution:* Used `?` placeholders in every query (`SELECT * FROM book WHERE id = ?;`), passing inputs as parameter arrays (`[bookId]`) so the SQLite engine treats inputs strictly as literal values.

3. **Handling Missing JSON Request Body:**
   - *Problem:* In POST and PUT requests, `request.body` would be `undefined` without the Express JSON body-parser middleware.
   - *Solution:* Added `app.use(express.json());` at the top of the middleware stack to parse incoming JSON payloads into JavaScript objects.

---

## Viva Questions & Answers

### 1. Why do we use parameterized queries instead of string concatenation?
- **Parameterized queries** separate SQL code from user-supplied data using placeholders (`?`). The database engine compiles the SQL query structure first and then binds the parameters strictly as literal values. This completely prevents **SQL Injection (SQLi)** attacks where malicious actors attempt to inject executable SQL commands.

### 2. What is the difference between `db.get()` and `db.all()` in the `sqlite` package?
- **`db.get(query, params)`**: Executes the query and returns only the **first matching row** as an object, or `undefined` if no row matches (ideal for `SELECT ... WHERE id = ?`).
- **`db.all(query, params)`**: Executes the query and returns **all matching rows** as an array of objects, or an empty array `[]` if no rows match (ideal for `SELECT * FROM book`).

### 3. What do HTTP status codes `200`, `201`, `400`, `404`, and `500` signify?
- **`200 OK`**: The request succeeded (e.g., reading or updating a record).
- **`201 Created`**: The request succeeded and led to the creation of a new resource (standard response for successful `POST`).
- **`400 Bad Request`**: The client sent invalid syntax or missing required fields in the request body.
- **`404 Not Found`**: The requested endpoint or resource ID does not exist.
- **`500 Internal Server Error`**: An unexpected server-side error occurred (e.g., database connection failure).
