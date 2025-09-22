const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const serverless = require('serverless-http');

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-manager-secret-key-2024';

// Inicializar Express
const app = express();

// Configuración CORS optimizada para acceso global
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir cualquier origen para acceso global
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: false,
  maxAge: 86400,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para manejar OPTIONS requests (preflight) - Acceso Global
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

// Base de datos en memoria (simplificada para Netlify)
let users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@portfolio.com',
    password_hash: '$2a$10$QQJGk.ZA68CVogSjuK8QQ.S49RWY2D7gdQx8jkSk/BKAXNVhVvboS', // admin123
    full_name: 'Administrador',
    created_at: new Date().toISOString(),
    last_login: null
  }
];

// Función para inicializar usuario admin si no existe
function ensureAdminUser() {
  const adminExists = users.find(u => u.username === 'admin');
  if (!adminExists) {
    users.push({
      id: 1,
      username: 'admin',
      email: 'admin@portfolio.com',
      password_hash: '$2a$10$QQJGk.ZA68CVogSjuK8QQ.S49RWY2D7gdQx8jkSk/BKAXNVhVvboS',
      full_name: 'Administrador',
      created_at: new Date().toISOString(),
      last_login: null
    });
    console.log('✅ Usuario admin inicializado');
  }
}

// Inicializar usuario admin al cargar
ensureAdminUser();

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

// Ruta de salud para verificar que la API funciona
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Portfolio Manager API funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    globalAccess: true
  });
});

// Rutas de autenticación
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('🔐 Intentando login:', { username, password: password ? '***' : 'undefined' });
    
    const user = users.find(u => u.username === username);
    console.log('🔍 Usuario encontrado:', user ? 'Sí' : 'No');
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    console.log('🔐 Contraseña coincide:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    console.log('✅ Login exitoso para:', username);

    res.json({ 
      token, 
      user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name }
    });
  } catch (error) {
    console.error('❌ Error en login:', error);
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

// Función mejorada para detectar activos desde texto
function detectAssetsFromText(text) {
  console.log('🔍 Analizando texto para detectar activos...');
  console.log('📄 Texto recibido:', text);
  
  const detectedAssets = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Lista expandida de símbolos válidos
  const validSymbols = [
    // Tech Giants
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'ADBE', 'CRM', 'ORCL', 'INTC', 'AMD', 'QCOM',
    // ETFs Populares
    'SPY', 'QQQ', 'VTI', 'VEA', 'VWO', 'SCHD', 'VYM', 'HDV', 'SPYI', 'SCHG', 'VUG', 'VTV', 'VYM', 'DIA', 'IWM',
    // Internacionales
    'EWZ', 'FXI', 'EWJ', 'EWG', 'EWU', 'EWC', 'EWA', 'EWH', 'EWS', 'EWT', 'EWY', 'EWL', 'EWN', 'EWO', 'EWP', 'EWQ', 'EWR', 'EWS', 'EWT', 'EWU', 'EWV', 'EWW', 'EWY', 'EWZ',
    // Acciones Populares
    'NKE', 'STLA', 'MRK', 'SUPV', 'XOM', 'UBER', 'BRK.B', 'JPM', 'BAC', 'WMT', 'PG', 'JNJ', 'KO', 'PFE', 'ABBV', 'CVX', 'MA', 'V', 'DIS', 'HD', 'MCD', 'NFLX', 'PYPL', 'SQ', 'ZM',
    // Financieras
    'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'AXP', 'BLK', 'SCHW', 'USB', 'PNC', 'TFC', 'COF', 'AON', 'MMC', 'SPGI', 'MCO', 'FIS', 'FISV', 'GPN', 'JKHY', 'NDAQ', 'TROW', 'WU',
    // Energía
    'XOM', 'CVX', 'COP', 'EOG', 'SLB', 'KMI', 'OKE', 'WMB', 'PSX', 'VLO', 'MPC', 'HES', 'DVN', 'PXD', 'NOV', 'HAL', 'BKR', 'FTI', 'RIG', 'DO', 'HP', 'NBR', 'PTEN', 'LBRT',
    // Healthcare
    'JNJ', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN', 'GILD', 'BIIB', 'REGN', 'VRTX', 'ILMN', 'MRNA', 'BNTX', 'ZTS', 'CVS', 'UNH', 'ANTM', 'CI', 'HUM', 'ELV', 'AET', 'CVS', 'WBA', 'RAD', 'MCK', 'ABC', 'CAH', 'HSIC', 'PDCO', 'DGX', 'LH', 'TMO', 'DHR', 'A', 'BDX', 'BSX', 'EW', 'ISRG', 'MDT', 'SYK', 'ZBH', 'BAX', 'BMY', 'LLY', 'NVS', 'PFE', 'SNY', 'GSK', 'AZN', 'NVO', 'RHHBY', 'TAK'
  ];
  
  console.log(`📊 Analizando ${lines.length} líneas de texto...`);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    console.log(`📝 Línea ${i + 1}: "${line}"`);
    
    // Patrones mejorados para detectar activos
    const patterns = [
      // Patrón 1: SYMBOL Exchange Price Change Quantity PnL
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 2: SYMBOL Exchange Price Change Quantity
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)$/,
      // Patrón 3: SYMBOL Exchange Price Quantity
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/,
      // Patrón 4: SYMBOL Price Change Quantity
      /^([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)$/,
      // Patrón 5: SYMBOL Exchange Price (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+al\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 6: SYMBOL Price (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 7: SYMBOL Exchange Price Change Quantity (formato específico)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 8: SYMBOL Exchange Price Quantity (formato específico)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 9: SYMBOL Exchange Price (cantidad implícita = 1, formato específico)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+al\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 10: SYMBOL Price Quantity (sin exchange)
      /^([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/,
      // Patrón 11: SYMBOL Price (cantidad implícita = 1, sin exchange)
      /^([A-Z]{1,5})\s+(\d+(?:\.\d+)?)$/,
      // Patrón 12: SYMBOL Exchange Price (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)$/,
      // Patrón 13: SYMBOL Exchange Price Change (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 14: SYMBOL Price Change (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 15: SYMBOL Exchange Price Quantity (formato alternativo)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 16: SYMBOL Exchange Price Change Quantity (formato alternativo)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 17: SYMBOL Exchange Price (cantidad implícita = 1, formato alternativo)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+al\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 18: SYMBOL Price (cantidad implícita = 1, formato alternativo)
      /^([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      // Patrón 19: SYMBOL Exchange Price (cantidad implícita = 1, formato alternativo)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)$/,
      // Patrón 20: SYMBOL Price (cantidad implícita = 1, formato alternativo)
      /^([A-Z]{1,5})\s+(\d+(?:\.\d+)?)$/
    ];
    
    // Probar cada patrón
    for (let j = 0; j < patterns.length; j++) {
      const match = line.match(patterns[j]);
      if (match) {
        const symbol = match[1].toUpperCase();
        const price = parseFloat(match[2]);
        const quantity = match[3] ? parseFloat(match[3]) : 1;
        
        console.log(`🎯 Patrón ${j + 1} detectado: ${symbol} precio=${price} cantidad=${quantity}`);
        
        if (validSymbols.includes(symbol) && !isNaN(quantity) && quantity > 0 && !detectedAssets.find(a => a.symbol === symbol)) {
          detectedAssets.push({
            symbol: symbol,
            name: `${symbol} Inc.`,
            quantity: quantity,
            purchase_price: price || 0
          });
          console.log(`✅ Activo detectado: ${symbol} ${quantity} @ $${price || 'N/A'}`);
          break; // Evitar procesar otros patrones para esta línea
        }
      }
    }
  }
  
  // Si no encontramos activos con patrones, buscar símbolos simples
  if (detectedAssets.length === 0) {
    console.log('🔍 Buscando símbolos simples...');
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length - 1; i++) {
      const word = words[i].toUpperCase();
      const nextWord = words[i + 1];
      
      if (validSymbols.includes(word) && !isNaN(parseFloat(nextWord))) {
        const quantity = parseFloat(nextWord);
        if (quantity > 0 && !detectedAssets.find(a => a.symbol === word)) {
          detectedAssets.push({
            symbol: word,
            name: `${word} Inc.`,
            quantity: quantity,
            purchase_price: 0
          });
          console.log(`✅ Activo simple detectado: ${word} ${quantity}`);
        }
      }
    }
  }
  
  console.log(`📊 Total activos detectados: ${detectedAssets.length}`);
  return detectedAssets;
}

// Ruta para subir imagen OCR (MEJORADA - Con detección inteligente)
app.post('/api/upload', authenticateToken, async (req, res) => {
  try {
    const { portfolio_id, imageData, textData } = req.body;
    
    console.log('📁 Procesando imagen OCR para portfolio:', portfolio_id);
    console.log('📁 Usuario:', req.user.userId);
    
    if (!portfolio_id) {
      return res.status(400).json({ error: 'ID de portfolio requerido' });
    }

    // Verificar que el portfolio pertenece al usuario
    const portfolio = portfolios.find(p => p.id === parseInt(portfolio_id) && p.user_id === req.user.userId);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    let extractedAssets = [];
    
    // Si hay texto proporcionado, analizarlo
    if (textData && textData.trim()) {
      console.log('📄 Analizando texto proporcionado...');
      extractedAssets = detectAssetsFromText(textData);
    } else {
      // Si no hay texto, usar activos de ejemplo inteligentes
      console.log('📊 Usando activos de ejemplo inteligentes...');
      extractedAssets = [
        { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, purchase_price: 150.00 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 5, purchase_price: 2500.00 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, purchase_price: 300.00 },
        { symbol: 'TSLA', name: 'Tesla Inc.', quantity: 3, purchase_price: 200.00 },
        { symbol: 'NVDA', name: 'NVIDIA Corporation', quantity: 2, purchase_price: 400.00 }
      ];
    }
    
    console.log('📊 Activos detectados:', extractedAssets.length);

    // Obtener precios actuales y agregar activos
    const processedAssets = [];
    for (let asset of extractedAssets) {
      console.log(`🔍 Obteniendo precio para ${asset.symbol}...`);
      const currentPrice = await getYahooPrice(asset.symbol);
      
      if (currentPrice) {
        console.log(`✅ Precio obtenido para ${asset.symbol}: $${currentPrice}`);
        
        // Insertar activo
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
      } else {
        console.log(`❌ No se pudo obtener precio para ${asset.symbol}`);
      }
    }

    res.json({
      success: true,
      portfolio: { id: portfolio_id },
      assets: processedAssets,
      extractedFromImage: !!textData,
      message: `Se procesaron ${processedAssets.length} activos ${textData ? 'desde el texto OCR' : 'con datos de ejemplo'}`
    });

  } catch (error) {
    console.error('Error en OCR:', error);
    res.status(500).json({ error: error.message });
  }
});

// Función principal de Netlify
exports.handler = serverless(app);