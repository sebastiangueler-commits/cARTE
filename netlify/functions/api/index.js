const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-manager-secret-key-2024';

// Inicializar Express
const app = express();

// Middleware - CORS configurado para acceso mundial
app.use(cors({
  origin: true, // Permitir cualquier origen en producción
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Error verificando token:', err);
      return res.status(403).json({ error: 'Token inválido' });
    }
    console.log('Usuario autenticado:', user);
    req.user = user;
    next();
  });
};

// Middleware para verificar si el usuario es administrador
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    console.log('🔐 Verificando permisos de admin para userId:', userId);
    
    // Verificar si el usuario es admin
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT username FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    console.log('🔐 Usuario encontrado:', user);

    if (!user || user.username !== 'admin') {
      console.log('❌ Acceso denegado - Usuario no es admin');
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden realizar esta acción.' });
    }

    console.log('✅ Usuario es admin - Acceso permitido');
    next();
  } catch (error) {
    console.error('Error verificando permisos de admin:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Configurar base de datos SQLite en memoria para Netlify
let db;

// Inicializar base de datos
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        console.error('Error abriendo base de datos:', err);
        reject(err);
      } else {
        console.log('✅ Base de datos SQLite inicializada');
        createTables().then(resolve).catch(reject);
      }
    });
  });
};

// Crear tablas
const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabla de usuarios
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )`);

      // Tabla de configuraciones de usuario
      db.run(`CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        update_interval INTEGER DEFAULT 300000,
        price_alerts BOOLEAN DEFAULT 0,
        email_notifications BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Tabla de portfolios
      db.run(`CREATE TABLE IF NOT EXISTS portfolios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Tabla de activos
      db.run(`CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        name TEXT,
        quantity REAL NOT NULL,
        purchase_price REAL NOT NULL,
        current_price REAL DEFAULT 0,
        portfolio_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (portfolio_id) REFERENCES portfolios (id)
      )`);

      // Tabla de historial de precios
      db.run(`CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,
        price REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets (id)
      )`);

      // Crear usuario por defecto
      setTimeout(() => {
        db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
          if (!row) {
            const defaultPassword = 'admin123';
            bcrypt.hash(defaultPassword, 10, (err, hash) => {
              if (!err) {
                db.run('INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)', 
                  ['admin', 'admin@portfolio.com', hash, 'Administrador'], (err) => {
                  if (!err) {
                    console.log('✅ Usuario por defecto creado: admin / admin123');
                  }
                });
              }
            });
          }
        });
      }, 1000);

      resolve();
    });
  });
};

// Cache de precios
const priceCache = new Map();
const CACHE_DURATION = 60000; // 1 minuto

// Función para obtener precio de Yahoo Finance
async function getYahooPrice(symbol) {
  const cacheKey = symbol;
  const cached = priceCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }

  try {
    const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data.chart && response.data.chart.result) {
      const result = response.data.chart.result[0];
      const price = result.meta.regularMarketPrice;
      
      priceCache.set(cacheKey, { price, timestamp: Date.now() });
      return price;
    }
  } catch (error) {
    console.error(`Error obteniendo precio para ${symbol}:`, error.message);
  }
  
  return null;
}

// Rutas de autenticación
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ 
      token, 
      user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    user: req.user,
    message: 'Token válido' 
  });
});

// Ruta para listar usuarios (solo para administradores)
app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔐 Admin solicitando lista de usuarios');
    
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT id, username, email, full_name, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('✅ Usuarios encontrados:', users.length);
    res.json(users);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta de registro (solo para administradores)
app.post('/api/auth/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    
    console.log('🔐 Admin creando nueva cuenta:', { username, email, fullName });
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Verificar si el usuario ya existe
    const existingUser = await new Promise((resolve) => {
      db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
        resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const userId = await new Promise((resolve, reject) => {
      db.run('INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)', 
        [username, email, passwordHash, fullName], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
    });

    // Crear configuración por defecto
    db.run('INSERT INTO user_settings (user_id) VALUES (?)', [userId]);

    console.log('✅ Nueva cuenta creada por admin:', username);

    res.json({ 
      success: true,
      user: { id: userId, username, email, fullName },
      message: 'Usuario creado exitosamente por administrador' 
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para obtener portfolios
app.get('/api/portfolios', authenticateToken, async (req, res) => {
  try {
    const portfolios = await new Promise((resolve, reject) => {
      db.all(`
        SELECT p.*, 
               COUNT(a.id) as asset_count,
               COALESCE(SUM(a.quantity * a.current_price), 0) as total_value,
               COALESCE(SUM(a.quantity * (a.current_price - a.purchase_price)), 0) as total_profit
        FROM portfolios p
        LEFT JOIN assets a ON p.id = a.portfolio_id
        WHERE p.user_id = ?
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, [req.user.userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json(portfolios);
  } catch (error) {
    console.error('Error obteniendo portfolios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para crear nueva cartera
app.post('/api/portfolios', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    console.log('🚀 INICIO: Creando portfolio - req.user:', req.user);
    console.log('🔍 Creando portfolio:', { name, description, userId: req.user.userId });
    
    if (!name) {
      return res.status(400).json({ error: 'El nombre de la cartera es requerido' });
    }

    if (!req.user.userId) {
      console.error('❌ userId no encontrado en req.user:', req.user);
      return res.status(400).json({ error: 'Usuario no identificado correctamente' });
    }

    const portfolioId = await new Promise((resolve, reject) => {
      const values = [name, description || '', req.user.userId];
      console.log('🔍 Valores para INSERT:', values);
      
      db.run('INSERT INTO portfolios (name, description, user_id) VALUES (?, ?, ?)', 
        values, function(err) {
          if (err) {
            console.error('Error creando portfolio:', err);
            reject(err);
          } else {
            console.log('✅ Portfolio creado con ID:', this.lastID);
            resolve(this.lastID);
          }
        });
    });

    res.json({ 
      id: portfolioId,
      name,
      description: description || '',
      message: 'Cartera creada exitosamente' 
    });
  } catch (error) {
    console.error('Error creando cartera:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para eliminar portfolio
app.delete('/api/portfolios/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el portfolio pertenece al usuario
    const portfolio = await new Promise((resolve) => {
      db.get('SELECT id FROM portfolios WHERE id = ? AND user_id = ?', 
        [id, req.user.userId], (err, row) => {
          resolve(row);
        });
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    // Eliminar activos primero
    db.run('DELETE FROM assets WHERE portfolio_id = ?', [id]);
    
    // Eliminar portfolio
    db.run('DELETE FROM portfolios WHERE id = ?', [id]);

    res.json({ message: 'Portfolio eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando portfolio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para obtener activos de un portfolio
app.get('/api/portfolios/:id/assets', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el portfolio pertenece al usuario
    const portfolio = await new Promise((resolve) => {
      db.get('SELECT id FROM portfolios WHERE id = ? AND user_id = ?', 
        [id, req.user.userId], (err, row) => {
          resolve(row);
        });
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    const assets = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM assets WHERE portfolio_id = ? ORDER BY created_at DESC', 
        [id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
    });

    res.json(assets);
  } catch (error) {
    console.error('Error obteniendo activos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para obtener estadísticas del dashboard
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(DISTINCT p.id) as total_portfolios,
          COUNT(a.id) as total_assets,
          COALESCE(SUM(a.quantity * a.current_price), 0) as total_value,
          COALESCE(SUM(a.quantity * (a.current_price - a.purchase_price)), 0) as total_profit
        FROM portfolios p
        LEFT JOIN assets a ON p.id = a.portfolio_id
        WHERE p.user_id = ?
      `, [req.user.userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para subir imagen OCR (simplificada para Netlify)
app.post('/api/upload', authenticateToken, async (req, res) => {
  try {
    const { portfolio_id } = req.body;
    
    console.log('📁 Procesando imagen OCR para portfolio:', portfolio_id);
    console.log('📁 Usuario:', req.user.userId);

    if (!portfolio_id) {
      return res.status(400).json({ error: 'ID de portfolio requerido' });
    }

    // Verificar que el portfolio pertenece al usuario
    const portfolio = await new Promise((resolve) => {
      db.get('SELECT id FROM portfolios WHERE id = ? AND user_id = ?', 
        [portfolio_id, req.user.userId], (err, row) => {
          resolve(row);
        });
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    // Para Netlify, simulamos algunos activos por defecto ya que no podemos procesar imágenes
    const extractedAssets = [
      { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, purchase_price: 150.00 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 5, purchase_price: 2500.00 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, purchase_price: 300.00 },
      { symbol: 'TSLA', name: 'Tesla Inc.', quantity: 3, purchase_price: 800.00 },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', quantity: 2, purchase_price: 3200.00 }
    ];

    console.log('📊 Usando activos por defecto para demo');

    // Insertar activos en el portfolio existente
    const stmt = db.prepare("INSERT INTO assets (symbol, name, quantity, purchase_price, portfolio_id) VALUES (?, ?, ?, ?, ?)");
    
    for (let asset of extractedAssets) {
      stmt.run([
        asset.symbol,
        asset.name || `${asset.symbol} Inc.`,
        asset.quantity || 0,
        asset.purchase_price || 0,
        portfolio_id
      ]);
    }
    
    stmt.finalize();

    res.json({
      success: true,
      portfolio: { id: portfolio_id },
      assets: extractedAssets,
      extractedFromImage: false,
      message: `Se agregaron ${extractedAssets.length} activos de demostración al portfolio`
    });

  } catch (error) {
    console.error('Error en OCR:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función principal de Netlify
exports.handler = async (event, context) => {
  // Inicializar base de datos si no está inicializada
  if (!db) {
    await initDatabase();
  }

  // Configurar Express para manejar la request
  return new Promise((resolve) => {
    app(event, context, (err, result) => {
      if (err) {
        console.error('Error en handler:', err);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ error: 'Error interno del servidor' })
        });
      } else {
        resolve(result);
      }
    });
  });
};