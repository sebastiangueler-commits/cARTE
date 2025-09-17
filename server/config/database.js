// Use SQLite for development, PostgreSQL for production
const { db, initializeDatabase } = require('./sqlite-schema');

// Create a pool-like interface for SQLite
const pool = {
  query: (text, params = []) => {
    return new Promise((resolve, reject) => {
      if (text.trim().toLowerCase().startsWith('select')) {
        db.all(text, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      } else {
        db.run(text, params, function(err) {
          if (err) reject(err);
          else resolve({ rows: [{ id: this.lastID }] });
        });
      }
    });
  }
};

module.exports = pool;