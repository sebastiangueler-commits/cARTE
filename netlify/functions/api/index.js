const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createWorker } = require('tesseract.js');

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'portfolio-manager-secret-key-2024';

// Inicializar Express
const app = express();

// Configuración CORS optimizada para móviles
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false,
  maxAge: 86400
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para manejar OPTIONS requests (preflight)
app.options('*', cors(corsOptions));

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

// Función para extraer activos de imagen OCR
async function extractAssetsFromImage(imageData) {
  try {
    console.log('🔍 Procesando imagen con OCR real...');
    
    const worker = await createWorker('eng');
    
    // Configurar OCR para mejor detección de texto financiero
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,+-$%()[]{}:; ',
      tessedit_pageseg_mode: '6' // Uniform block of text
    });
    
    const { data: { text } } = await worker.recognize(imageData);
    await worker.terminate();
    
    console.log('📄 Texto extraído de la imagen:');
    console.log('──────────────────────────────────────────────────');
    console.log(text);
    console.log('──────────────────────────────────────────────────');
    
    // Limpiar y normalizar el texto
    const cleanedText = text
      .replace(/\r\n/g, '\n')  // Normalizar saltos de línea
      .replace(/\r/g, '\n')    // Normalizar saltos de línea
      .replace(/\s+/g, ' ')    // Normalizar espacios
      .trim();
    
    console.log('🧹 Texto limpiado:');
    console.log('──────────────────────────────────────────────────');
    console.log(cleanedText);
    console.log('──────────────────────────────────────────────────');
    
    return parseAssetsFromText(cleanedText);
  } catch (error) {
    console.error('Error en OCR:', error);
    return [];
  }
}

// Función para parsear activos del texto OCR
function parseAssetsFromText(text) {
  const lines = text.split('\n');
  const assets = [];
  const seenSymbols = new Set();
  
  console.log('🔍 Analizando líneas del texto extraído...');
  
  for (const line of lines) {
    console.log('📝 Analizando línea:', `"${line}"`);
    
    // Limpiar línea de caracteres extraños
    const cleanLine = line
      .replace(/[^\w\s.,+-$%()[]{}:;]/g, '') // Solo caracteres válidos
      .replace(/\s+/g, ' ') // Normalizar espacios
      .trim();
    
    if (!cleanLine) continue;
    
    // Patrones UNIVERSALES para detectar activos en CUALQUIER formato de broker
    const patterns = [
      // Patrón 1: SYMBOL Exchange Price Change Quantity PnL
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+(\d+)\s+[+-]?\d+\.?\d*$/,
      // Patrón 2: SYMBOL Exchange Price Change Quantity
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+(\d+)$/,
      // Patrón 3: SYMBOL Exchange Price Quantity
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+(\d+)$/,
      // Patrón 4: SYMBOL Price Change Quantity
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+(\d+)$/,
      // Patrón 5: SYMBOL Exchange Price (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+al\s+[+-]?\d+\.?\d*$/,
      // Patrón 6: SYMBOL Price (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*$/,
      // Patrón 7: SYMBOL Exchange Price Change Quantity (formato más específico)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+(\d+)\s+[+-]?\d+\.?\d*$/,
      // Patrón 8: SYMBOL Exchange Price Quantity (formato específico)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+(\d+)\s+[+-]?\d+\.?\d*$/,
      // Patrón 9: SYMBOL Exchange Price (cantidad implícita = 1, formato específico)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+al\s+[+-]?\d+\.?\d*$/,
      
      // PATRONES ADICIONALES PARA MAYOR COMPATIBILIDAD
      // Patrón 10: SYMBOL Price Quantity (sin exchange)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+(\d+)$/,
      // Patrón 11: SYMBOL Price (cantidad implícita = 1, sin exchange)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)$/,
      // Patrón 12: SYMBOL Exchange Price (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)$/,
      // Patrón 13: SYMBOL Exchange Price Change (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*$/,
      // Patrón 14: SYMBOL Price Change (cantidad implícita = 1)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*$/,
      // Patrón 15: SYMBOL Exchange Price Quantity (formato alternativo)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+(\d+)\s+[+-]?\d+\.?\d*$/,
      // Patrón 16: SYMBOL Exchange Price Change Quantity (formato alternativo)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+(\d+)\s+[+-]?\d+\.?\d*$/,
      // Patrón 17: SYMBOL Exchange Price (cantidad implícita = 1, formato alternativo)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+al\s+[+-]?\d+\.?\d*$/,
      // Patrón 18: SYMBOL Price (cantidad implícita = 1, formato alternativo)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*$/,
      // Patrón 19: SYMBOL Exchange Price (cantidad implícita = 1, formato alternativo)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)$/,
      // Patrón 20: SYMBOL Price (cantidad implícita = 1, formato alternativo)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)$/,
      
      // PATRONES FLEXIBLES PARA MAYOR COMPATIBILIDAD
      // Patrón 21: SYMBOL Exchange Price (flexible)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*$/,
      // Patrón 22: SYMBOL Price (flexible)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*$/,
      // Patrón 23: SYMBOL Exchange Price (muy flexible)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)$/,
      // Patrón 24: SYMBOL Price (muy flexible)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)$/,
      // Patrón 25: SYMBOL Exchange Price Change (muy flexible)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*$/,
      // Patrón 26: SYMBOL Price Change (muy flexible)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*$/,
      // Patrón 27: SYMBOL Exchange Price Quantity (muy flexible)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+(\d+)$/,
      // Patrón 28: SYMBOL Price Quantity (muy flexible)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+(\d+)$/,
      // Patrón 29: SYMBOL Exchange Price Change Quantity (muy flexible)
      /^([A-Z]{1,5})\s+[a-zA-Z]+\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+(\d+)$/,
      // Patrón 30: SYMBOL Price Change Quantity (muy flexible)
      /^([A-Z]{1,5})\s+(\d+\.?\d*)\s+[+-]?\d+\.?\d*\s+(\d+)$/
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const match = cleanLine.match(patterns[i]);
      if (match) {
        const symbol = match[1];
        const price = parseFloat(match[2]);
        const quantity = match[3] ? parseInt(match[3]) : 1;
        
        if (!seenSymbols.has(symbol) && price > 0 && quantity > 0) {
          console.log(`🎯 Patrón ${i + 1} broker detectado: ${symbol} precio=${price} cantidad=${quantity}`);
          assets.push({
            symbol,
            name: `${symbol} Inc.`,
            quantity,
            purchase_price: price
          });
          seenSymbols.add(symbol);
          console.log(`✅ Activo agregado: ${symbol} ${quantity} @ $${price}`);
        }
        break;
      }
    }
  }
  
  console.log(`📊 Total activos detectados: ${assets.length}`);
  return assets;
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

// Ruta para subir imagen OCR (REAL)
app.post('/api/upload', authenticateToken, async (req, res) => {
  try {
    const { portfolio_id, imageData } = req.body;
    
    console.log('📁 Procesando imagen OCR para portfolio:', portfolio_id);
    console.log('📁 Usuario:', req.user.userId);
    
    if (!portfolio_id) {
      return res.status(400).json({ error: 'ID de portfolio requerido' });
    }

    if (!imageData) {
      return res.status(400).json({ error: 'Imagen requerida para procesar' });
    }

    // Verificar que el portfolio pertenece al usuario
    const portfolio = portfolios.find(p => p.id === parseInt(portfolio_id) && p.user_id === req.user.userId);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio no encontrado' });
    }

    // Procesar imagen con OCR REAL
    console.log('🔍 Iniciando análisis con Tesseract.js...');
    const extractedAssets = await extractAssetsFromImage(imageData);
    
    console.log('📊 Activos extraídos del OCR:', extractedAssets.length);

    if (extractedAssets.length === 0) {
      return res.json({
        success: false,
        message: 'No se pudieron detectar activos en la imagen. Asegúrate de que la imagen sea clara y contenga información de cartera.',
        extractedFromImage: true
      });
    }

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
      extractedFromImage: true,
      message: `Se procesaron ${processedAssets.length} activos desde la imagen OCR`
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