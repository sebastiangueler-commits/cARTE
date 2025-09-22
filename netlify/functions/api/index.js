const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-manager-secret-key-2024';

// Inicializar Express
const app = express();

// CORS simple y directo
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Usuario admin hardcodeado para evitar problemas
const ADMIN_USER = {
  id: 1,
  username: 'admin',
  email: 'admin@portfolio.com',
  password_hash: '$2a$10$QQJGk.ZA68CVogSjuK8QQ.S49RWY2D7gdQx8jkSk/BKAXNVhVvboS', // admin123
  full_name: 'Administrador'
};

// Base de datos simple en memoria
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

// Función para obtener precio de Yahoo Finance
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

// RUTAS DE LA API

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Portfolio Manager API funcionando',
    timestamp: new Date().toISOString()
  });
});

// LOGIN - RUTA PRINCIPAL
app.post('/auth/login', async (req, res) => {
  try {
    console.log('🔐 LOGIN REQUEST:', req.body);
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Usuario y contraseña son requeridos' 
      });
    }
    
    // Solo aceptar admin por ahora
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign({ 
        userId: ADMIN_USER.id, 
        username: ADMIN_USER.username 
      }, JWT_SECRET, { expiresIn: '24h' });

      console.log('✅ LOGIN EXITOSO para admin');
      
      res.json({ 
        token, 
        user: { 
          id: ADMIN_USER.id, 
          username: ADMIN_USER.username, 
          email: ADMIN_USER.email, 
          fullName: ADMIN_USER.full_name 
        }
      });
    } else {
      console.log('❌ LOGIN FALLIDO:', username);
      res.status(401).json({ error: 'Credenciales inválidas' });
    }
  } catch (error) {
    console.error('❌ ERROR EN LOGIN:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Verificar token
app.get('/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    user: req.user,
    message: 'Token válido' 
  });
});

// Obtener portfolios
app.get('/portfolios', authenticateToken, (req, res) => {
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

// Crear portfolio
app.post('/portfolios', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'El nombre de la cartera es requerido' });
    }

    const newPortfolio = {
      id: portfolios.length + 1,
      name: name.trim(),
      description: (description || '').trim(),
      user_id: req.user.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    portfolios.push(newPortfolio);

    res.json({ 
      id: newPortfolio.id,
      name: newPortfolio.name,
      description: newPortfolio.description,
      message: 'Cartera creada exitosamente' 
    });
  } catch (error) {
    console.error('Error creando cartera:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar portfolio
app.delete('/portfolios/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const portfolioId = parseInt(id);
    
    const portfolioIndex = portfolios.findIndex(p => p.id === portfolioId && p.user_id === req.user.userId);
    if (portfolioIndex === -1) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    assets = assets.filter(a => a.portfolio_id !== portfolioId);
    portfolios.splice(portfolioIndex, 1);

    res.json({ message: 'Portfolio eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando portfolio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener activos de portfolio
app.get('/portfolios/:id/assets', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const portfolioId = parseInt(id);
    
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

// Upload/detección de activos
app.post('/upload', authenticateToken, async (req, res) => {
  try {
    const { portfolio_id, textData } = req.body;
    
    if (!portfolio_id) {
      return res.status(400).json({ error: 'ID de portfolio requerido' });
    }

    const portfolio = portfolios.find(p => p.id === parseInt(portfolio_id) && p.user_id === req.user.userId);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    // Activos de ejemplo por ahora
    const extractedAssets = [
      { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, purchase_price: 150.00 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 5, purchase_price: 2500.00 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, purchase_price: 300.00 }
    ];

    // Obtener precios actuales
    const processedAssets = [];
    for (let asset of extractedAssets) {
      const currentPrice = await getYahooPrice(asset.symbol);
      
      if (currentPrice) {
        const newAsset = {
          id: assets.length + 1,
          symbol: asset.symbol,
          name: asset.name,
          quantity: asset.quantity,
          purchase_price: asset.purchase_price,
          current_price: currentPrice,
          portfolio_id: parseInt(portfolio_id),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        assets.push(newAsset);
        processedAssets.push(newAsset);
      }
    }

    res.json({
      success: true,
      portfolio: { id: portfolio_id },
      assets: processedAssets,
      message: `Se procesaron ${processedAssets.length} activos`
    });

  } catch (error) {
    console.error('Error en upload:', error);
    res.status(500).json({ error: error.message });
  }
});

// Estadísticas
app.get('/dashboard/stats', authenticateToken, (req, res) => {
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

// Manejar todas las rutas no encontradas
app.use('*', (req, res) => {
  console.log('❌ RUTA NO ENCONTRADA:', req.method, req.path);
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    method: req.method,
    path: req.path
  });
});

// Función principal de Netlify
exports.handler = serverless(app);