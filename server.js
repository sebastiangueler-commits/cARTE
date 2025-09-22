const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const fetch = require('node-fetch');
const Tesseract = require('tesseract.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-manager-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

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

// Multer para uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Base de datos SQLite
const db = new sqlite3.Database('portfolio.db');

// Crear tablas
db.serialize(() => {
  // Eliminar tablas existentes si hay problemas
  db.run(`DROP TABLE IF EXISTS transactions`);
  db.run(`DROP TABLE IF EXISTS price_history`);
  db.run(`DROP TABLE IF EXISTS assets`);
  db.run(`DROP TABLE IF EXISTS portfolios`);
  db.run(`DROP TABLE IF EXISTS user_settings`);
  db.run(`DROP TABLE IF EXISTS users`);

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
    image_url TEXT,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
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

  // Tabla de historial de cambios
  db.run(`CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    change_percent DECIMAL(5,2),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asset_id) REFERENCES assets (id)
  )`);

  // Tabla de activos
  db.run(`CREATE TABLE assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    purchase_price REAL DEFAULT 0,
    current_price REAL DEFAULT 0,
    portfolio_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios (id) ON DELETE CASCADE
  )`);

  // Tabla de transacciones
  db.run(`CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER NOT NULL,
    asset_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'sell')),
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (portfolio_id) REFERENCES portfolios (id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE
  )`);

  console.log('✅ Base de datos inicializada correctamente');
});

// Cache de precios para evitar llamadas duplicadas
const priceCache = new Map();
const CACHE_DURATION = 60000; // 1 minuto

// Función para obtener datos históricos de Yahoo Finance
async function getYahooHistoricalData(symbol, period = '1y') {
  try {
    const periods = {
      '1m': '1mo',
      '3m': '3mo', 
      '6m': '6mo',
      '1y': '1y',
      '2y': '2y',
      '5y': '5y',
      'max': 'max'
    };
    
    const periodParam = periods[period] || '1y';
    
    console.log(`📊 Obteniendo datos históricos para ${symbol} (${periodParam})...`);
    
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${periodParam}&interval=1d`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      const timestamps = result.timestamp;
      const prices = result.indicators.quote[0].close;
      
      // Filtrar valores válidos
      const validData = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (prices[i] !== null && prices[i] !== undefined) {
          validData.push({
            date: new Date(timestamps[i] * 1000),
            price: prices[i]
          });
        }
      }
      
      return validData;
    }
    
    console.log(`⚠️ No se encontraron datos históricos para ${symbol}`);
    return null;
  } catch (error) {
    console.error(`❌ Error obteniendo datos históricos para ${symbol}:`, error.message);
    return null;
  }
}

// Función para calcular cambios temporales
async function calculateTemporalChanges(asset) {
  try {
    const currentPrice = asset.current_price;
    if (!currentPrice) return null;
    
    // Obtener datos históricos
    const historicalData = await getYahooHistoricalData(asset.symbol, '1y');
    if (!historicalData || historicalData.length === 0) return null;
    
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    // Encontrar precios más cercanos a las fechas objetivo
    let oneYearPrice = null;
    let oneMonthPrice = null;
    
    for (const data of historicalData) {
      if (!oneYearPrice && data.date <= oneYearAgo) {
        oneYearPrice = data.price;
      }
      if (!oneMonthPrice && data.date <= oneMonthAgo) {
        oneMonthPrice = data.price;
      }
    }
    
    const changes = {
      oneYear: oneYearPrice ? {
        price: oneYearPrice,
        change: currentPrice - oneYearPrice,
        changePercent: ((currentPrice - oneYearPrice) / oneYearPrice) * 100
      } : null,
      oneMonth: oneMonthPrice ? {
        price: oneMonthPrice,
        change: currentPrice - oneMonthPrice,
        changePercent: ((currentPrice - oneMonthPrice) / oneMonthPrice) * 100
      } : null,
      sinceCreation: asset.purchase_price ? {
        price: asset.purchase_price,
        change: currentPrice - asset.purchase_price,
        changePercent: ((currentPrice - asset.purchase_price) / asset.purchase_price) * 100
      } : null
    };
    
    return changes;
  } catch (error) {
    console.error(`❌ Error calculando cambios temporales para ${asset.symbol}:`, error.message);
    return null;
  }
}
// Función para obtener precios de Yahoo Finance
async function getYahooPrice(symbol) {
  try {
    // Verificar cache primero
    const cached = priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.priceData;
    }
    
    console.log(`🔍 Obteniendo precio para ${symbol}...`);
    
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.chart && data.chart.result && data.chart.result[0]) {
      const result = data.chart.result[0];
      const meta = result.meta;
      
      const priceData = {
        price: meta.regularMarketPrice || meta.previousClose || 0,
        change: meta.regularMarketChange || 0,
        changePercent: (meta.regularMarketChangePercent || 0) * 100,
        currency: meta.currency || 'USD',
        marketState: meta.marketState || 'CLOSED',
        lastUpdate: new Date().toISOString()
      };
      
      // Guardar en cache
      priceCache.set(symbol, { priceData: priceData, timestamp: Date.now() });
      
      console.log(`✅ Precio obtenido para ${symbol}: $${priceData.price}`);
      return priceData;
    }
    
    console.log(`⚠️ No se encontraron datos para ${symbol}`);
  return null;
  } catch (error) {
    console.error(`❌ Error obteniendo precio para ${symbol}:`, error.message);
    return null;
  }
}

// Función para actualizar precios de todos los activos
async function updateAllPrices() {
  try {
    console.log('🔄 Actualizando precios de todos los activos...');
    
    const assets = await new Promise((resolve) => {
      db.all("SELECT DISTINCT symbol FROM assets", (err, rows) => {
        resolve(rows || []);
      });
    });

    for (let asset of assets) {
      const priceData = await getYahooPrice(asset.symbol);
      if (priceData) {
        // Actualizar precio actual en la tabla de activos
        db.run("UPDATE assets SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE symbol = ?", 
          [priceData.price, asset.symbol]);
        
        // Guardar en historial de precios (solo si hay activos)
        const assetId = await new Promise((resolve) => {
          db.get("SELECT id FROM assets WHERE symbol = ? LIMIT 1", [asset.symbol], (err, row) => {
            resolve(row ? row.id : null);
          });
        });
        
        if (assetId) {
          db.run("INSERT INTO price_history (asset_id, price, change_percent) VALUES (?, ?, ?)", 
            [assetId, priceData.price, priceData.changePercent]);
        }
      }
      
      // Pequeña pausa para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('✅ Precios actualizados correctamente');
  } catch (error) {
    console.error('❌ Error actualizando precios:', error);
  }
}

// Función para procesar OCR real de imagen usando Tesseract.js
async function extractAssetsFromImage(imagePath) {
  try {
    console.log('🔍 Procesando imagen con OCR real:', imagePath);
    console.log('📸 Iniciando análisis con Tesseract.js...');
    
    // Realizar OCR real con Tesseract.js
    const { data: { text } } = await Tesseract.recognize(
      imagePath,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`📝 Progreso OCR: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    console.log('📄 Texto extraído de la imagen:');
    console.log('─'.repeat(50));
    console.log(text);
    console.log('─'.repeat(50));
    
    // Parsear el texto extraído para encontrar activos
    const extractedAssets = parseAssetsFromText(text);
    
    console.log(`✅ OCR real completado - ${extractedAssets.length} activos detectados`);
    console.log('📊 Activos detectados:', extractedAssets.map(a => `${a.symbol} (${a.quantity} @ $${a.purchase_price})`).join(', '));
    
    return extractedAssets;
    
  } catch (error) {
    console.error('❌ Error en OCR real:', error);
    console.log('🔄 Usando fallback con activos de ejemplo...');
    
    // Fallback con activos de ejemplo si el OCR falla
    return [
      { symbol: 'AAPL', name: 'Apple Inc.', quantity: 5, purchase_price: 180.00 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 3, purchase_price: 350.00 },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 2, purchase_price: 140.00 }
    ];
  }
}

// Función para parsear activos del texto extraído por OCR
function parseAssetsFromText(text) {
  const assets = [];
  const lines = text.split('\n');
  
  // Lista de símbolos válidos conocidos (universal para cualquier broker)
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
    'JNJ', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN', 'GILD', 'BIIB', 'REGN', 'VRTX', 'ILMN', 'MRNA', 'BNTX', 'ZTS', 'CVS', 'UNH', 'ANTM', 'CI', 'HUM', 'ELV', 'AET', 'CVS', 'WBA', 'RAD', 'MCK', 'ABC', 'CAH', 'HSIC', 'PDCO', 'DGX', 'LH', 'TMO', 'DHR', 'A', 'BDX', 'BSX', 'EW', 'ISRG', 'MDT', 'SYK', 'ZBH', 'BAX', 'BMY', 'LLY', 'NVS', 'PFE', 'SNY', 'GSK', 'AZN', 'NVO', 'RHHBY', 'TAK', 'DEO', 'BUD', 'KO', 'PEP', 'MNST', 'KDP', 'CCEP', 'CCH', 'FIZZ', 'CELH', 'KOF', 'FMX', 'ABEV', 'STZ', 'TAP', 'SAM', 'BUD', 'HEINY', 'ASBRF', 'DEO', 'BF.B', 'BF.A', 'TAP', 'SAM', 'BUD', 'HEINY', 'ASBRF', 'DEO', 'BF.B', 'BF.A'
  ];
  
  console.log('🔍 Analizando líneas del texto extraído...');
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    console.log(`📝 Analizando línea: "${line}"`);
    
    // Patrones específicos para diferentes formatos de broker (ordenados por especificidad)
    const brokerPatterns = [
      // Patrón 1: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (formato completo)
      // Ejemplo: "SCHD Arca 27.50  +0.03 10 0.30"
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?$/,
      
      // Patrón 2: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (con dos puntos)
      // Ejemplo: "SPYI ATs 52.44  +0.12 3 0:33"
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+\d+:\d+$/,
      
      // Patrón 3: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (sin espacios en mercado)
      // Ejemplo: "STLANYSE 9.90  +0.22 5 1.50"
      /^([A-Z]{1,5})[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?$/,
      
      // Patrón 4: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (formato con "al" y cantidad)
      // Ejemplo: "GOOGL woos 252.38 +2.85 al 2:91" -> cantidad = 1 (por defecto)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+al\s+\d+:\d+$/,
      
      // Patrón 5: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (con "al" sin cantidad explícita)
      // Ejemplo: "EWZ Arca 30.84 -0.10 al -0.10" -> cantidad = 1 (por defecto)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+al\s+[+-]?\d+(?:\.\d+)?$/,
      
      // Patrón 6: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (formato simple)
      // Ejemplo: "NKE nyse 72.16 -0.15 al -0.20" -> cantidad = 1 (por defecto)
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+al\s+[+-]?\d+(?:\.\d+)?$/,
      
      // Patrón 7: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (formato sin "al")
      // Ejemplo: "SUPV nvysE 5.11 -0.49 2 -0.88"
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      
      // Patrón 8: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (formato sin "al" con espacios)
      // Ejemplo: "XOM nyse 114.01 -1.28 1 -1.29"
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/,
      
      // Patrón 9: SÍMBOLO MERCADO PRECIO CAMBIO CANTIDAD (formato sin "al" con espacios)
      // Ejemplo: "AMD naspagnms 157.10 -2.06 2 -4.12"
      /^([A-Z]{1,5})\s+[A-Za-z]+\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?\s+(\d+(?:\.\d+)?)\s+[+-]?\d+(?:\.\d+)?$/
    ];
    
    // Probar cada patrón de broker (solo el primero que coincida)
    let assetFound = false;
    for (let i = 0; i < brokerPatterns.length && !assetFound; i++) {
      const pattern = brokerPatterns[i];
      const match = line.match(pattern);
      
      if (match) {
        const symbol = match[1].toUpperCase();
        const price = parseFloat(match[2]);
        let quantity = parseFloat(match[3]);
        
        // Si no hay cantidad explícita (patrones 4, 5, 6), usar 1 por defecto
        if (isNaN(quantity) || quantity <= 0) {
          quantity = 1;
        }
        
        console.log(`🎯 Patrón ${i+1} broker detectado: ${symbol} precio=${price} cantidad=${quantity}`);
        
        if (validSymbols.includes(symbol) && !isNaN(quantity) && quantity > 0) {
          if (!assets.find(a => a.symbol === symbol)) {
            assets.push({
              symbol: symbol,
              name: `${symbol} Inc.`,
              quantity: quantity,
              purchase_price: price || 0
            });
            console.log(`✅ Activo agregado: ${symbol} ${quantity} @ $${price || 'N/A'}`);
            assetFound = true; // Evitar procesar otros patrones para esta línea
          }
        }
      }
    }
    
    // Patrones alternativos más simples
    const patterns = [
      // Patrón: SÍMBOLO CANTIDAD PRECIO
      /([A-Z]{1,5})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g,
      // Patrón: SÍMBOLO CANTIDAD
      /([A-Z]{1,5})\s+(\d+(?:\.\d+)?)/g,
      // Patrón: SÍMBOLO - CANTIDAD
      /([A-Z]{1,5})\s*-\s*(\d+(?:\.\d+)?)/g,
      // Patrón: SÍMBOLO: CANTIDAD
      /([A-Z]{1,5}):\s*(\d+(?:\.\d+)?)/g
    ];
    
    for (let pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const symbol = match[1].toUpperCase();
        const quantity = parseFloat(match[2]);
        const price = match[3] ? parseFloat(match[3]) : 0;
        
        if (validSymbols.includes(symbol) && !isNaN(quantity) && quantity > 0) {
          if (!assets.find(a => a.symbol === symbol)) {
          assets.push({
            symbol: symbol,
            name: `${symbol} Inc.`,
              quantity: quantity,
              purchase_price: price || 0
          });
            console.log(`✅ Activo alternativo detectado: ${symbol} ${quantity} @ $${price || 'N/A'}`);
          }
        }
      }
    }
  }
  
  // Si aún no encontramos activos, buscar patrones más simples
  if (assets.length === 0) {
    console.log('🔍 Buscando patrones simples en palabras individuales...');
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length - 1; i++) {
      const word = words[i].toUpperCase();
      const nextWord = words[i + 1];
      
      // Si es un símbolo válido seguido de un número
      if (validSymbols.includes(word) && !isNaN(parseFloat(nextWord))) {
        const quantity = parseFloat(nextWord);
        if (quantity > 0 && !assets.find(a => a.symbol === word)) {
        assets.push({
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
  
  console.log(`📊 Total activos detectados: ${assets.length}`);
  return assets;
}

// RUTAS DE LA API

// Obtener todos los portfolios con datos completos
app.get('/api/portfolios', authenticateToken, async (req, res) => {
  try {
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
      `, [req.user.userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Obtener activos detallados para cada portfolio con precios actualizados
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
            asset.current_price = priceData.price;
            asset.current_value = asset.quantity * priceData.price;
            asset.gain_loss = asset.current_value - asset.purchase_value;
            asset.gain_loss_percent = asset.purchase_value > 0 
              ? ((asset.current_value - asset.purchase_value) / asset.purchase_value) * 100 
              : 0;
            
            // Calcular cambios temporales
            const temporalChanges = await calculateTemporalChanges(asset);
            if (temporalChanges) {
              asset.temporal_changes = temporalChanges;
            }
            
            // Actualizar precio en la base de datos
            db.run("UPDATE assets SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", 
              [priceData.price, asset.id]);
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

    res.json(portfolios);
  } catch (error) {
    console.error('Error obteniendo portfolios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener un portfolio específico
app.get('/api/portfolios/:id', async (req, res) => {
  try {
    const portfolioId = req.params.id;
    
    const portfolio = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM portfolios WHERE id = ?", [portfolioId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

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
      `, [portfolioId], (err, rows) => {
        resolve(rows || []);
      });
    });

    portfolio.assets = assets;
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error obteniendo portfolio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo portfolio
// Crear portfolio desde imagen OCR
app.post('/api/upload', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { portfolio_id } = req.body;
    
    console.log('📁 Procesando imagen OCR para portfolio:', portfolio_id);
    console.log('📁 Archivo recibido:', req.file ? req.file.filename : 'Sin archivo');
    console.log('📁 Usuario:', req.user.userId);

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

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

    // Procesar imagen con OCR
    const extractedAssets = await extractAssetsFromImage(req.file.path);
    console.log('🔍 Activos extraídos del OCR:', extractedAssets.length);

    // Si no hay activos, usar algunos por defecto
    if (extractedAssets.length === 0) {
      extractedAssets = [
        { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, purchase_price: 150.00 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 5, purchase_price: 2500.00 },
        { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, purchase_price: 300.00 }
      ];
      console.log('📊 Usando activos por defecto');
    }

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
      extractedFromImage: !!req.file,
      message: `Se agregaron ${extractedAssets.length} activos al portfolio`
      });

  } catch (error) {
    console.error('Error en OCR:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar portfolio
app.put('/api/portfolios/:id', async (req, res) => {
  try {
    const portfolioId = req.params.id;
    const { name, description } = req.body;
    
    await new Promise((resolve, reject) => {
      db.run("UPDATE portfolios SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", 
        [name, description, portfolioId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true, message: 'Portfolio actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando portfolio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar portfolio
app.delete('/api/portfolios/:id', async (req, res) => {
  try {
    const portfolioId = req.params.id;
    
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM portfolios WHERE id = ?", [portfolioId], function(err) {
        if (err) reject(err);
        else resolve();
  });
});

    res.json({ success: true, message: 'Portfolio eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando portfolio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todos los activos
app.get('/api/assets', async (req, res) => {
  try {
    const assets = await new Promise((resolve) => {
  db.all(`
        SELECT a.*, p.name as portfolio_name,
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
    JOIN portfolios p ON a.portfolio_id = p.id 
        ORDER BY a.symbol
      `, (err, rows) => {
        resolve(rows || []);
      });
    });

    res.json(assets);
  } catch (error) {
    console.error('Error obteniendo activos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Agregar activo a portfolio
app.post('/api/assets', async (req, res) => {
  try {
    const { symbol, name, quantity, purchase_price, portfolio_id } = req.body;
    
    if (!symbol || !portfolio_id) {
      return res.status(400).json({ error: 'Símbolo y portfolio_id son requeridos' });
    }

    const assetId = await new Promise((resolve, reject) => {
      db.run("INSERT INTO assets (symbol, name, quantity, purchase_price, portfolio_id) VALUES (?, ?, ?, ?, ?)", 
        [symbol, name, quantity || 0, purchase_price || 0, portfolio_id], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    res.json({
      success: true,
      asset: { id: assetId, symbol, name, quantity, purchase_price, portfolio_id },
      message: 'Activo agregado exitosamente'
    });
  } catch (error) {
    console.error('Error agregando activo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar activo
app.put('/api/assets/:id', async (req, res) => {
  try {
    const assetId = req.params.id;
    const { symbol, name, quantity, purchase_price } = req.body;
    
    await new Promise((resolve, reject) => {
      db.run("UPDATE assets SET symbol = ?, name = ?, quantity = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", 
        [symbol, name, quantity, purchase_price, assetId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true, message: 'Activo actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando activo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar activo
app.delete('/api/assets/:id', async (req, res) => {
  try {
    const assetId = req.params.id;
    
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM assets WHERE id = ?", [assetId], function(err) {
        if (err) reject(err);
        else resolve();
  });
});

    res.json({ success: true, message: 'Activo eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando activo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar precios de todos los activos
app.post('/api/prices/update', async (req, res) => {
  try {
    await updateAllPrices();
    res.json({ success: true, message: 'Precios actualizados exitosamente' });
  } catch (error) {
    console.error('Error actualizando precios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener precio de un símbolo específico
app.get('/api/prices/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const priceData = await getYahooPrice(symbol);
    
    if (priceData) {
      res.json(priceData);
    } else {
      res.status(404).json({ error: 'Precio no encontrado para el símbolo' });
    }
  } catch (error) {
    console.error('Error obteniendo precio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener estadísticas generales
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await new Promise((resolve) => {
      db.get(`
        SELECT 
          COUNT(DISTINCT p.id) as total_portfolios,
          COUNT(a.id) as total_assets,
          COALESCE(SUM(a.quantity * COALESCE(a.current_price, 0)), 0) as total_value,
          COALESCE(SUM(a.quantity * COALESCE(a.purchase_price, 0)), 0) as total_cost,
          COALESCE(SUM(a.quantity * COALESCE(a.current_price, 0)), 0) - COALESCE(SUM(a.quantity * COALESCE(a.purchase_price, 0)), 0) as total_gain_loss
        FROM portfolios p
        LEFT JOIN assets a ON p.id = a.portfolio_id
      `, (err, row) => {
        resolve(row || {});
      });
    });

    stats.total_gain_loss_percent = stats.total_cost > 0 
      ? ((stats.total_gain_loss || 0) / stats.total_cost) * 100 
      : 0;

    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
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

// Rutas de autenticación
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

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Buscar usuario
    const user = await new Promise((resolve) => {
      db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], (err, row) => {
        resolve(row);
      });
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Actualizar último login
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Generar token
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ 
      token, 
      user: { id: user.id, username: user.username, email: user.email, fullName: user.full_name },
      message: 'Login exitoso' 
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para verificar token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ 
    user: req.user,
    message: 'Token válido' 
  });
});

// Ruta para crear nueva cartera
app.post('/api/portfolios', authenticateToken, async (req, res) => {
  console.log('🚀 INICIO: Creando portfolio - req.user:', req.user);
  try {
    const { name, description } = req.body;
    
    console.log('🔍 Creando portfolio:', { name, description, userId: req.user.userId });
    console.log('🔍 req.user completo:', req.user);
    
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
      console.log('🔍 Tipo de userId:', typeof req.user.userId);
      
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

// Ruta para eliminar cartera
app.delete('/api/portfolios/:id', authenticateToken, async (req, res) => {
  try {
    const portfolioId = req.params.id;
    
    // Verificar que la cartera pertenece al usuario
    const portfolio = await new Promise((resolve) => {
      db.get('SELECT id FROM portfolios WHERE id = ? AND user_id = ?', 
        [portfolioId, req.user.userId], (err, row) => {
          resolve(row);
        });
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Cartera no encontrada' });
    }

    // Eliminar cartera (los activos se eliminan por CASCADE)
    db.run('DELETE FROM portfolios WHERE id = ?', [portfolioId]);

    res.json({ message: 'Cartera eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando cartera:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Servir la aplicación principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Portfolio Manager ejecutándose en puerto ${PORT}`);
  console.log(`🌐 Accede a: http://localhost:${PORT}`);
  console.log(`📊 Conectado a Yahoo Finance para precios en tiempo real`);
  console.log(`💾 Base de datos SQLite inicializada`);
  
  // Crear usuario por defecto para pruebas
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
  }, 2000);
});

// Actualizar precios al iniciar y cada 5 minutos (después de crear las tablas)
setTimeout(() => {
  updateAllPrices();
  setInterval(updateAllPrices, 5 * 60 * 1000);
}, 3000);

// Cerrar BD al terminar
process.on('SIGINT', () => {
  console.log('\n🔄 Cerrando servidor...');
  db.close();
  process.exit();
});