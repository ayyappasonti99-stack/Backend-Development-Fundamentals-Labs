# Lab 3: REST API, query parameters, validation, debugging

**Subject:** Backend Development Fundamentals  
**Year/Term:** Year II, Term II  
**University:** Aurora Deemed to be University  
**Faculty:** Yugandar Sir  
**Repository:** [https://github.com/ayyappasonti99-stack/Backend-Development-Fundamentals-Labs](https://github.com/ayyappasonti99-stack/Backend-Development-Fundamentals-Labs)

| Student detail | Value |
| --- | --- |
| Name | Ayyappa Sonti (Sonti Ayyappa Vigna Kumar) |
| Registration number | 252U1R3091 |
| Section | S-21, CSE DS 2B |
| Faculty | Yugandar Sir |

## Live Link

**[https://backend-development-fundamentals-labs.vercel.app](https://backend-development-fundamentals-labs.vercel.app)** *(or pending deployment)*

> Replace this with the real URL shown in your deployment dashboard after deployment.
> If the project cannot be deployed, write the reason here instead and rely on the Postman / REST Client screenshots below.

## Project Overview

This lab turns the Lab 2 book routes into a clean REST API built with Node.js, Express.js and SQLite. Endpoint names are nouns (`/books`) and the HTTP method shows the action. The `GET /books/` route supports search, sorting, price-range filtering and pagination through query parameters. The create and update routes validate the request body, and every response uses the correct HTTP status code and a consistent JSON format.

## Technologies Used

- Node.js
- Express.js
- SQLite (`sqlite3` and `sqlite` packages)
- Nodemon (development only)
- VS Code REST Client and Postman (testing)

## Project Structure

```text
lab-03/
├── .gitignore
├── README.md
├── app.http
├── app.js
├── goodreads.db
├── package.json
├── package-lock.json
└── screenshots/
```

`node_modules/` is created by `npm install` and is excluded from Git.

## How to Run

**Prerequisites:** Node.js and npm installed.

1. Open a terminal in the `lab-03` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   For development with auto-restart, use `npm run dev`.

The server runs at `http://localhost:3000`.

**Environment variables:**

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Port to listen on. Defaults to `3000`. Hosting platforms like Render set it automatically. |

No other environment variables, secrets or `.env` file are needed.

On first start, the app creates the `book` table in `goodreads.db` and inserts 10 sample books if the table is empty.

## Database Schema

| Column | Type | Description |
| --- | --- | --- |
| `id` | INTEGER | Auto-incrementing primary key |
| `title` | TEXT | Book title |
| `author` | TEXT | Book author |
| `price` | INTEGER | Book price |
| `pages` | INTEGER | Number of pages (optional) |

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/books/` | List books with search, filter, sort and pagination |
| GET | `/books/:bookId/` | Get one book by id |
| POST | `/books/` | Add a new book (validated) |
| PUT | `/books/:bookId/` | Update an existing book (validated) |
| DELETE | `/books/:bookId/` | Delete a book |

### Query parameters for `GET /books/`

| Parameter | Default | Description |
| --- | --- | --- |
| `search_q` | empty (matches all) | Partial title match using `LIKE` |
| `order_by` | `id` | Column to sort by: `id`, `title`, `author`, `price` or `pages` |
| `order` | `ASC` | Sort direction: `ASC` or `DESC` |
| `limit` | `10` | Maximum number of books returned |
| `offset` | `0` | Number of books to skip (pagination) |
| `min_price` | `0` | Minimum price (inclusive) |
| `max_price` | no upper limit | Maximum price (inclusive) |

Example:

```
GET /books/?search_q=the&min_price=300&max_price=450&order_by=price&order=DESC&limit=5&offset=0
```

### Request body for `POST /books/` and `PUT /books/:bookId/`

```json
{
  "title": "Python Basics",
  "author": "John",
  "price": 350,
  "pages": 250
}
```

Validation rules:

- `title` and `author` are required, non-empty strings.
- `price` is required and must be a non-negative number.
- `pages` is optional, but if provided it must be a positive whole number.

## Status Codes and Response Format

| Situation | Status code |
| --- | --- |
| Successful GET, PUT or DELETE | `200 OK` |
| Successful POST | `201 Created` |
| Invalid input (bad body, bad query parameter, bad id) | `400 Bad Request` |
| Book id or route does not exist | `404 Not Found` |
| Unexpected server or database error | `500 Internal Server Error` |

All messages and errors use the same JSON shape:

```json
{ "message": "Book not found" }
```

## Security Notes

- All SQL values use parameterized queries (`?` placeholders). User input is never joined into the SQL string.
- `order_by` and `order` cannot use placeholders, so they are checked against allow-lists (`id`, `title`, `author`, `price`, `pages` and `ASC`, `DESC`) before being used.
- A test with `search_q=';DROP TABLE book;--` returns an empty list and the table is unaffected.

## Test List (Postman / REST Client)

All requests are also saved in [`app.http`](./app.http).

| # | Request | Expected result |
| --- | --- | --- |
| 1 | `GET /books/` | 200, 10 books |
| 2 | `GET /books/?search_q=the` | 200, titles containing "the" |
| 3 | `GET /books/?order_by=price&order=DESC&limit=3` | 200, 3 most expensive books |
| 4 | `GET /books/?min_price=300&max_price=400` | 200, prices between 300 and 400 |
| 5 | `GET /books/?limit=2&offset=2` | 200, 2 books (ids 3 and 4) |
| 6 | `GET /books/4/` | 200, one book |
| 7 | `POST /books/` with a valid body | 201, success message and `bookId` |
| 8 | `PUT /books/11/` with a valid body | 200, "Book updated successfully" |
| 9 | `DELETE /books/11/` | 200, "Book deleted successfully" |
| 10 | `GET /books/999/` | 404, "Book not found" |
| 11 | `GET /books/abc/` | 400, invalid id message |
| 12 | `GET /books/?order_by=password` | 400, allowed columns listed |
| 13 | `GET /books/?limit=abc` | 400, limit message |
| 14 | `GET /books/?min_price=500&max_price=100` | 400, price range message |
| 15 | `POST /books/` without `title` | 400, title message |
| 16 | `POST /books/` with `"price": "abc"` | 400, price message |
| 17 | `POST /books/` with broken JSON | 400, "Invalid JSON in request body" |
| 18 | `PUT /books/999/` with a valid body | 404, "Book not found" |
| 19 | `DELETE /books/999/` | 404, "Book not found" |
| 20 | `GET /nothing` | 404, "Route not found" |
| 21 | `GET /books/?search_q=';DROP TABLE book;--` | 200, `[]` and the table is safe |

## Screenshots

### Get all books
![GET all books returning 200](./Screenshots/Screenshot%202026-11-03%20155003.png)

### Search by title
![Search by title](./Screenshots/Screenshot%202026-11-03%20155336.png)

### Sort by price
![Sort by price](./Screenshots/Screenshot%202026-11-03%20155346.png)

### Price range filter
![Price range filter with min_price and max_price](./Screenshots/Screenshot%202026-11-03%20155355.png)

### Pagination
![Pagination with limit and offset](./Screenshots/Screenshot%202026-11-03%20155404.png)

### Get one book
![GET one book by id](./Screenshots/Screenshot%202026-11-03%20155413.png)

### Add a book (201)
![POST a valid book returns 201](./Screenshots/Screenshot%202026-11-03%20155459.png)

### Update a book (200)
![PUT updates a book and returns 200](./Screenshots/Screenshot%202026-11-03%20155510.png)

### Delete a book (200)
![DELETE removes a book and returns 200](./Screenshots/Screenshot%202026-11-03%20155540.png)

### Book not found (404)
![Missing book returns 404](./Screenshots/Screenshot%202026-11-03%20155550.png)

### Invalid id (400)
![Invalid id returns 400](./Screenshots/Screenshot%202026-11-03%20155606.png)

### Invalid sort column (400)
![Invalid order_by returns 400](./Screenshots/Screenshot%202026-11-03%20155628.png)

### Invalid limit (400)
![Invalid limit returns 400](./Screenshots/Screenshot%202026-11-03%20155641.png)

### Invalid price range (400)
![Invalid price range returns 400](./Screenshots/Screenshot%202026-11-03%20155651.png)

### Missing title (400)
![POST without title returns 400](./Screenshots/Screenshot%202026-11-03%20155658.png)

### Non-numeric price (400)
![POST with non-numeric price returns 400](./Screenshots/Screenshot%202026-11-03%20155711.png)

### Invalid JSON (400)
![POST with broken JSON returns 400](./Screenshots/Screenshot%202026-11-03%20155737.png)

### Book not found on update (404)
![PUT for a missing book returns 404](./Screenshots/Screenshot%202026-11-03%20155754.png)

### Book not found on delete (404)
![DELETE for a missing book returns 404](./Screenshots/Screenshot%202026-11-03%20155811.png)

### Route not found (404)
![Missing route returns 404](./Screenshots/Screenshot%202026-11-03%20155817.png)

### SQL injection attempt
![SQL injection attempt returns no results](./Screenshots/Screenshot%202026-11-03%20155828.png)

## Debugging Exercise

| Problem | Error message | Cause | Solution |
| --- | --- | --- | --- |
| Port conflict | `listen EADDRINUSE: address already in use :::3000` | Another server (the Lab 2 app) was already running on port 3000 | Stopped the old server with Ctrl + C (or ended the process with `taskkill /PID <pid> /F`), then restarted. Port can also be changed with the `PORT` variable. |
| Wrong import path | `Cannot find module '...'` | The `require` path pointed to the wrong file or folder | Corrected the relative path (`./` for the same folder, `../` for the parent) and the file name. |
| Table name typo | `SQLITE_ERROR: no such table: ...` | The SQL query used a table name different from the one in `CREATE TABLE` | Changed the query to use the exact table name `book`. |
| Missing `await` | Empty or wrong response, `Promise { <pending> }` | `db.all()` and `db.run()` return Promises and were not awaited | Added `await` and made the function `async`. |

## Notes: Problems Faced and How I Solved Them

- **Port already in use:** The server failed to start because the Lab 2 server was still running. I added an error callback to `app.listen` so the message is clear, then stopped the old process.
- **Testing in the terminal:** I typed a URL into PowerShell by mistake. URLs go in the browser or REST Client, while the terminal is for commands.
- **Sorting safely:** Column names cannot be passed as `?` parameters, so I used allow-lists for `order_by` and `order` to prevent SQL injection.
- **Consistent errors:** Express returns an HTML page for broken JSON by default. I added an error-handling middleware so even that returns `{ "message": "..." }`.
- **Deployment:** The database file is stored on Render's temporary disk on the free plan, so added books may reset after a restart. The sample data is re-created automatically on startup.

## Learning Outcomes

- Designed REST endpoints using nouns and HTTP methods.
- Used query parameters for search, sorting, filtering and pagination.
- Validated request data and returned correct status codes (200, 201, 400, 404, 500).
- Used parameterized queries and allow-lists to prevent SQL injection.
- Identified and fixed common errors: `EADDRINUSE`, wrong import path, `no such table` and missing `await`.
- Tested success and failure cases with REST Client and Postman.
