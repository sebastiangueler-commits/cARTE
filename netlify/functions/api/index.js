const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-manager-secret-key-2024';

// Base de datos global
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

// Middleware de autenticación
const authenticateToken = (event) => {
  const authHeader = event.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { error: 'Token de acceso requerido', statusCode: 401 };
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    return { user };
  } catch (err) {
    return { error: 'Token inválido', statusCode: 403 };
  }
};

// Middleware para verificar admin
const requireAdmin = async (user) => {
  return new Promise((resolve) => {
    db.get('SELECT username FROM users WHERE id = ?', [user.userId], (err, row) => {
      if (err || !row || row.username !== 'admin') {
        resolve({ error: 'Acceso denegado. Solo administradores.', statusCode: 403 });
      } else {
        resolve({ success: true });
      }
    });
  });
};

// Función principal de Netlify
exports.handler = async (event, context) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Inicializar base de datos si no está inicializada
  if (!db) {
    await initDatabase();
  }

  try {
    const path = event.path;
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    console.log(`Request: ${method} ${path}`);

    // Ruta de login
    if (path === '/api/auth/login' && method === 'POST') {
      const { username, password } = body;
      
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user || !await bcrypt.compare(password, user.password_hash)) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Credenciales inválidas' })
        };
      }

      // Actualizar último login
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      // Generar token
      const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          token,
          user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name },
          message: 'Login exitoso'
        })
      };
    }

    // Ruta de verificación de token
    if (path === '/api/auth/verify' && method === 'GET') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          user: authResult.user,
          message: 'Token válido'
        })
      };
    }

    // Ruta de portfolios
    if (path === '/api/portfolios' && method === 'GET') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      const portfolios = await new Promise((resolve, reject) => {
        db.all(`
          SELECT p.*, 
                 COUNT(a.id) as asset_count,
                 COALESCE(SUM(a.quantity * COALESCE(a.current_price, 0)), 0) as total_value,
                 COALESCE(SUM(a.quantity * COALESCE(a.purchase_price, 0)), 0) as total_cost
          FROM portfolios p
          LEFT JOIN assets a ON p.id = a.portfolio_id
          WHERE p.user_id = ?
          GROUP BY p.id
          ORDER BY p.created_at DESC
        `, [authResult.user.userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // Obtener activos detallados para cada portfolio
      for (let portfolio of portfolios) {
        const assets = await new Promise((resolve) => {
          db.all(`
            SELECT a.*, 
                   COALESCE(a.current_price, 0) as current_price,
                   (a.quantity * COALESCE(a.current_price, 0)) as current_value,
                   (a.quantity * COALESCE(a.purchase_price, 0)) as purchase_value,
                   ((a.quantity * COALESCE(a.current_price, 0)) - (a.quantity * COALESCE(a.purchase_price, 0))) as gain_loss,
                   CASE 
                     WHEN COALESCE(a.purchase_price, 0) > 0 
                     THEN (((a.quantity * COALESCE(a.current_price, 0)) - (a.quantity * COALESCE(a.purchase_price, 0))) / (a.quantity * COALESCE(a.purchase_price, 0))) * 100
                     ELSE 0 
                   END as gain_loss_percent
            FROM assets a 
            WHERE a.portfolio_id = ?
            ORDER BY a.symbol
          `, [portfolio.id], (err, rows) => {
            resolve(rows || []);
          });
        });

        // Actualizar precios actuales para cada activo
        for (let asset of assets) {
          if (asset.symbol) {
            const priceData = await getYahooPrice(asset.symbol);
            if (priceData) {
              asset.current_price = priceData;
              asset.current_value = asset.quantity * priceData;
              asset.gain_loss = asset.current_value - asset.purchase_value;
              asset.gain_loss_percent = asset.purchase_value > 0 
                ? ((asset.current_value - asset.purchase_value) / asset.purchase_value) * 100 
                : 0;
              
              // Actualizar precio en la base de datos
              db.run("UPDATE assets SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", 
                [priceData, asset.id]);
            }
          }
        }

        portfolio.assets = assets;
        
        // Recalcular totales con precios actualizados
        portfolio.total_value = assets.reduce((sum, a) => sum + (a.current_value || 0), 0);
        portfolio.total_cost = assets.reduce((sum, a) => sum + (a.purchase_value || 0), 0);
        portfolio.total_gain_loss = portfolio.total_value - portfolio.total_cost;
        portfolio.total_gain_loss_percent = portfolio.total_cost > 0 
          ? ((portfolio.total_value - portfolio.total_cost) / portfolio.total_cost) * 100 
          : 0;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(portfolios)
      };
    }

    // Ruta para crear portfolio
    if (path === '/api/portfolios' && method === 'POST') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      const { name, description } = body;
      
      if (!name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'El nombre de la cartera es requerido' })
        };
      }

      const portfolioId = await new Promise((resolve, reject) => {
        db.run('INSERT INTO portfolios (name, description, user_id) VALUES (?, ?, ?)', 
          [name, description || '', authResult.user.userId], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          });
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: portfolioId,
          name,
          description: description || '',
          message: 'Cartera creada exitosamente'
        })
      };
    }

    // Ruta para eliminar portfolio
    if (path.startsWith('/api/portfolios/') && method === 'DELETE') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      const portfolioId = path.split('/')[3];
      
      // Verificar que el portfolio pertenece al usuario
      const portfolio = await new Promise((resolve) => {
        db.get('SELECT id FROM portfolios WHERE id = ? AND user_id = ?', 
          [portfolioId, authResult.user.userId], (err, row) => {
            resolve(row);
          });
      });

      if (!portfolio) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Portfolio no encontrado' })
        };
      }

      // Eliminar activos primero
      db.run('DELETE FROM assets WHERE portfolio_id = ?', [portfolioId]);
      
      // Eliminar portfolio
      db.run('DELETE FROM portfolios WHERE id = ?', [portfolioId]);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Portfolio eliminado exitosamente' })
      };
    }

    // Ruta para activos de portfolio
    if (path.startsWith('/api/portfolios/') && path.endsWith('/assets') && method === 'GET') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      const portfolioId = path.split('/')[3];
      
      // Verificar que el portfolio pertenece al usuario
      const portfolio = await new Promise((resolve) => {
        db.get('SELECT id FROM portfolios WHERE id = ? AND user_id = ?', 
          [portfolioId, authResult.user.userId], (err, row) => {
            resolve(row);
          });
      });

      if (!portfolio) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Portfolio no encontrado' })
        };
      }

      const assets = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM assets WHERE portfolio_id = ? ORDER BY created_at DESC', 
          [portfolioId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(assets)
      };
    }

    // Ruta para subir imagen OCR
    if (path === '/api/upload' && method === 'POST') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      const { portfolio_id } = body;
      
      if (!portfolio_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID de portfolio requerido' })
        };
      }

      // Verificar que el portfolio pertenece al usuario
      const portfolio = await new Promise((resolve) => {
        db.get('SELECT id FROM portfolios WHERE id = ? AND user_id = ?', 
          [portfolio_id, authResult.user.userId], (err, row) => {
            resolve(row);
          });
      });

      if (!portfolio) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Portfolio no encontrado' })
        };
      }

      // Para Netlify, simulamos algunos activos por defecto ya que no podemos procesar imágenes
      const extractedAssets = [
        { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, purchase_price: 150.00 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 5, purchase_price: 2500.00 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, purchase_price: 300.00 },
        { symbol: 'TSLA', name: 'Tesla Inc.', quantity: 3, purchase_price: 800.00 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', quantity: 2, purchase_price: 3200.00 }
      ];

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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          portfolio: { id: portfolio_id },
          assets: extractedAssets,
          extractedFromImage: false,
          message: `Se agregaron ${extractedAssets.length} activos de demostración al portfolio`
        })
      };
    }

    // Ruta para usuarios (solo admin)
    if (path === '/api/users' && method === 'GET') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      const adminCheck = await requireAdmin(authResult.user);
      if (adminCheck.error) {
        return {
          statusCode: adminCheck.statusCode,
          headers,
          body: JSON.stringify({ error: adminCheck.error })
        };
      }

      const users = await new Promise((resolve, reject) => {
        db.all('SELECT id, username, email, full_name, created_at FROM users ORDER BY created_at DESC', (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(users)
      };
    }

    // Ruta para crear usuario
    if (path === '/api/auth/register' && method === 'POST') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      const adminCheck = await requireAdmin(authResult.user);
      if (adminCheck.error) {
        return {
          statusCode: adminCheck.statusCode,
          headers,
          body: JSON.stringify({ error: adminCheck.error })
        };
      }

      const { username, email, password, fullName } = body;
      
      if (!username || !email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Todos los campos son requeridos' })
        };
      }

      // Verificar si el usuario ya existe
      const existingUser = await new Promise((resolve) => {
        db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
          resolve(row);
        });
      });

      if (existingUser) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'El usuario o email ya existe' })
        };
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

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          user: { id: userId, username, email, fullName },
          message: 'Usuario creado exitosamente'
        })
      };
    }

    // Ruta para estadísticas del dashboard
    if (path === '/api/dashboard/stats' && method === 'GET') {
      const authResult = authenticateToken(event);
      if (authResult.error) {
        return {
          statusCode: authResult.statusCode,
          headers,
          body: JSON.stringify({ error: authResult.error })
        };
      }

      const stats = await new Promise((resolve, reject) => {
        db.get(`
          SELECT 
            COUNT(DISTINCT p.id) as total_portfolios,
            COUNT(a.id) as total_assets,
            COALESCE(SUM(a.quantity * COALESCE(a.current_price, 0)), 0) as total_value,
            COALESCE(SUM(a.quantity * COALESCE(a.purchase_price, 0)), 0) as total_cost
          FROM portfolios p
          LEFT JOIN assets a ON p.id = a.portfolio_id
          WHERE p.user_id = ?
        `, [authResult.user.userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const totalGainLoss = stats.total_value - stats.total_cost;
      const totalGainLossPercent = stats.total_cost > 0 
        ? (totalGainLoss / stats.total_cost) * 100 
        : 0;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...stats,
          total_gain_loss: totalGainLoss,
          total_gain_loss_percent: totalGainLossPercent
        })
      };
    }

    // Ruta no encontrada
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Ruta no encontrada' })
    };

  } catch (error) {
    console.error('Error en función:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error interno del servidor' })
    };
  }
};