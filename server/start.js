const { initializeDatabase } = require('./config/sqlite-schema');

// Initialize database on startup
const startServer = async () => {
  try {
    console.log('Initializing SQLite database...');
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    // Start the server
    require('./index');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();