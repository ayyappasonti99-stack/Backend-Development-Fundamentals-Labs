const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// Route 1: Home (Welcome message)
app.get('/', (request, response) => {
  response.send('Welcome to the Lab 1 Express Web Server!');
});

// Route 2: Student details (JSON response)
app.get('/about', (request, response) => {
  response.json({
    name: 'Manikanta',
    regNo: '252U1R3087',
    section: 'CSE-DS-2D(307)',
    course: 'Backend Development Fundamentals',
    lab: 'Lab 1: Node.js and Express server'
  });
});

// Route 3: Today's date (NxtWave slide format)
app.get('/date', (request, response) => {
  let date = new Date();
  response.send(`Today's date is ${date}`);
});

// Route 4: Current date and time
app.get('/time', (request, response) => {
  const now = new Date();
  response.json({
    iso: now.toISOString(),
    utc: now.toUTCString(),
    local: now.toString()
  });
});

// Route 5: Basic 404 handler for unknown paths
app.use((request, response) => {
  response.status(404).json({
    error: 'Not Found',
    message: `The requested path '${request.originalUrl}' does not exist on this server.`,
    statusCode: 404
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
