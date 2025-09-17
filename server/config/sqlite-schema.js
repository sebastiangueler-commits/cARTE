const db = require('./sqlite');

// Create tables if they don't exist
const createTables = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Portfolios table
      db.run(`
        CREATE TABLE IF NOT EXISTS portfolios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Assets table
      db.run(`
        CREATE TABLE IF NOT EXISTS assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
          symbol TEXT NOT NULL,
          isin TEXT,
          name TEXT NOT NULL,
          quantity REAL NOT NULL,
          purchase_price REAL NOT NULL,
          current_price REAL,
          purchase_date DATE NOT NULL,
          notes TEXT,
          image_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Asset prices history table
      db.run(`
        CREATE TABLE IF NOT EXISTS asset_prices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
          symbol TEXT NOT NULL,
          price REAL NOT NULL,
          date DATE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Portfolio performance history table
      db.run(`
        CREATE TABLE IF NOT EXISTS portfolio_performance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
          total_value REAL NOT NULL,
          date DATE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // User activity log table
      db.run(`
        CREATE TABLE IF NOT EXISTS user_activity (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          action TEXT NOT NULL,
          details TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes for better performance
      db.run(`CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_assets_portfolio_id ON assets(portfolio_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_assets_symbol ON assets(symbol)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_asset_prices_symbol_date ON asset_prices(symbol, date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_portfolio_performance_portfolio_date ON portfolio_performance(portfolio_id, date)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id)`);

      console.log('SQLite database tables created successfully');
      resolve();
    });
  });
};

// Initialize database
const initializeDatabase = async () => {
  try {
    await createTables();
    
    // Create default admin user if it doesn't exist
    db.get('SELECT id FROM users WHERE email = ?', ['admin@portfolio.com'], (err, row) => {
      if (err) {
        console.error('Error checking admin user:', err);
        return;
      }
      
      if (!row) {
        const bcrypt = require('bcryptjs');
        bcrypt.hash('admin123', 12, (err, hashedPassword) => {
          if (err) {
            console.error('Error hashing password:', err);
            return;
          }
          
          db.run(`
            INSERT INTO users (email, password_hash, first_name, last_name, role)
            VALUES (?, ?, ?, ?, ?)
          `, ['admin@portfolio.com', hashedPassword, 'Admin', 'User', 'admin'], (err) => {
            if (err) {
              console.error('Error creating admin user:', err);
            } else {
              console.log('Default admin user created: admin@portfolio.com / admin123');
            }
          });
        });
      }
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

module.exports = { db, initializeDatabase };