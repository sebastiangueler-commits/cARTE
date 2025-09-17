const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create SQLite database connection
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Test database connection
db.on('open', () => {
  console.log('Connected to SQLite database');
});

db.on('error', (err) => {
  console.error('Database connection error:', err);
});

module.exports = db;