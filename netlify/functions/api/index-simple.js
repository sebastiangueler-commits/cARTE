const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-manager-secret-key-2024';

// Inicializar Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Base de datos en memoria (simplificada para Netlify)
let users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@portfolio.com',
    password_hash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // admin123
    full_name: 'Administrador'
  }
];

let portfolios = [];
let assets = [];

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Middleware para verificar si el usuario es administrador
const requireAdmin = (req, res, next) => {
  const user = users.find(u => u.id === req.user.userId);
  if (!user || user.username !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden realizar esta acción.' });
  }
  next();
};

// Función para obtener precio de Yahoo Finance (simplificada)
async function getYahooPrice(symbol) {
  try {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
    const data = await response.json();
    
    if (data && data.chart && data.chart.result) {
      return data.chart.result[0].meta.regularMarketPrice;
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
    
    const user = users.find(u => u.username === username);
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
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userList = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      full_name: u.full_name,
      created_at: new Date().toISOString()
    }));
    
    res.json(userList);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta de registro (solo para administradores)
app.post('/api/auth/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Verificar si el usuario ya existe
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'El usuario o email ya existe' });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const newUser = {
      id: users.length + 1,
      username,
      email,
      password_hash: passwordHash,
      full_name: fullName
    };
    
    users.push(newUser);

    res.json({ 
      success: true,
      user: { id: newUser.id, username, email, fullName },
      message: 'Usuario creado exitosamente por administrador' 
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para obtener portfolios
app.get('/api/portfolios', authenticateToken, (req, res) => {
  try {
    const userPortfolios = portfolios
      .filter(p => p.user_id === req.user.userId)
      .map(portfolio => {
        const portfolioAssets = assets.filter(a => a.portfolio_id === portfolio.id);
        const totalValue = portfolioAssets.reduce((sum, asset) => sum + (asset.quantity * asset.current_price), 0);
        const totalProfit = portfolioAssets.reduce((sum, asset) => sum + (asset.quantity * (asset.current_price - asset.purchase_price)), 0);
        
        return {
          ...portfolio,
          asset_count: portfolioAssets.length,
          total_value: totalValue,
          total_profit: totalProfit
        };
      });

    res.json(userPortfolios);
  } catch (error) {
    console.error('Error obteniendo portfolios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para crear nueva cartera
app.post('/api/portfolios', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'El nombre de la cartera es requerido' });
    }

    const newPortfolio = {
      id: portfolios.length + 1,
      name,
      description: description || '',
      user_id: req.user.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    portfolios.push(newPortfolio);

    res.json({ 
      id: newPortfolio.id,
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
app.delete('/api/portfolios/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const portfolioId = parseInt(id);
    
    // Verificar que el portfolio pertenece al usuario
    const portfolioIndex = portfolios.findIndex(p => p.id === portfolioId && p.user_id === req.user.userId);
    if (portfolioIndex === -1) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    // Eliminar activos primero
    assets = assets.filter(a => a.portfolio_id !== portfolioId);
    
    // Eliminar portfolio
    portfolios.splice(portfolioIndex, 1);

    res.json({ message: 'Portfolio eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando portfolio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para obtener activos de un portfolio
app.get('/api/portfolios/:id/assets', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const portfolioId = parseInt(id);
    
    // Verificar que el portfolio pertenece al usuario
    const portfolio = portfolios.find(p => p.id === portfolioId && p.user_id === req.user.userId);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    const portfolioAssets = assets.filter(a => a.portfolio_id === portfolioId);
    res.json(portfolioAssets);
  } catch (error) {
    console.error('Error obteniendo activos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para obtener estadísticas del dashboard
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  try {
    const userPortfolios = portfolios.filter(p => p.user_id === req.user.userId);
    const userAssets = assets.filter(a => userPortfolios.some(p => p.id === a.portfolio_id));
    
    const stats = {
      total_portfolios: userPortfolios.length,
      total_assets: userAssets.length,
      total_value: userAssets.reduce((sum, asset) => sum + (asset.quantity * asset.current_price), 0),
      total_profit: userAssets.reduce((sum, asset) => sum + (asset.quantity * (asset.current_price - asset.purchase_price)), 0)
    };

    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para subir imagen OCR (simplificada)
app.post('/api/upload', authenticateToken, async (req, res) => {
  try {
    const { portfolio_id } = req.body;
    
    if (!portfolio_id) {
      return res.status(400).json({ error: 'ID de portfolio requerido' });
    }

    // Verificar que el portfolio pertenece al usuario
    const portfolio = portfolios.find(p => p.id === parseInt(portfolio_id) && p.user_id === req.user.userId);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    // Activos de demostración para Netlify
    const demoAssets = [
      { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, purchase_price: 150.00 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 5, purchase_price: 2500.00 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, purchase_price: 300.00 },
      { symbol: 'TSLA', name: 'Tesla Inc.', quantity: 3, purchase_price: 800.00 },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', quantity: 2, purchase_price: 3200.00 }
    ];

    // Obtener precios actuales
    for (let asset of demoAssets) {
      const currentPrice = await getYahooPrice(asset.symbol);
      asset.current_price = currentPrice || asset.purchase_price;
      
      // Insertar activo
      const newAsset = {
        id: assets.length + 1,
        symbol: asset.symbol,
        name: asset.name,
        quantity: asset.quantity,
        purchase_price: asset.purchase_price,
        current_price: asset.current_price,
        portfolio_id: parseInt(portfolio_id),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      assets.push(newAsset);
    }

    res.json({
      success: true,
      portfolio: { id: portfolio_id },
      assets: demoAssets,
      extractedFromImage: false,
      message: `Se agregaron ${demoAssets.length} activos de demostración al portfolio`
    });

  } catch (error) {
    console.error('Error en OCR:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función principal de Netlify
exports.handler = async (event, context) => {
  return new Promise((resolve) => {
    app(event, context, (err, result) => {
      if (err) {
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
