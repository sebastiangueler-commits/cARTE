exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  console.log('🚀 FUNCIÓN EJECUTÁNDOSE:', event.httpMethod, event.path);

  try {
    // Parse the path - Netlify pasa el path completo
    let path = event.path;
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    // Si el path es solo "/", usar el path completo de la URL
    if (path === '/') {
      path = event.rawUrl ? new URL(event.rawUrl).pathname : event.path;
    }

    // Remover el prefijo de la función si existe
    if (path.startsWith('/.netlify/functions/api')) {
      path = path.replace('/.netlify/functions/api', '');
    }

    console.log('📋 REQUEST:', { 
      originalPath: event.path, 
      finalPath: path, 
      method, 
      body,
      rawUrl: event.rawUrl 
    });

    // LOGIN ENDPOINT
    if (path === '/auth/login' && method === 'POST') {
      console.log('🔐 LOGIN REQUEST recibido');
      
      const { username, password } = body;
      
      if (username === 'admin' && password === 'admin123') {
        console.log('✅ LOGIN EXITOSO');
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            token: 'fake-jwt-token-for-admin',
            user: {
              id: 1,
              username: 'admin',
              email: 'admin@portfolio.com',
              fullName: 'Administrador'
            }
          })
        };
      } else {
        console.log('❌ LOGIN FALLIDO');
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Credenciales inválidas' })
        };
      }
    }

    // HEALTH CHECK
    if (path === '/health' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'OK',
          message: 'Portfolio Manager API funcionando',
          timestamp: new Date().toISOString()
        })
      };
    }

    // VERIFY TOKEN
    if (path === '/auth/verify' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          user: { id: 1, username: 'admin' },
          message: 'Token válido'
        })
      };
    }

    // PORTFOLIOS
    if (path === '/portfolios' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([])
      };
    }

    // CREATE PORTFOLIO
    if (path === '/portfolios' && method === 'POST') {
      const { name, description } = body;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: 1,
          name: name || 'Mi Portfolio',
          description: description || '',
          message: 'Cartera creada exitosamente'
        })
      };
    }

    // UPLOAD/DETECTION
    if (path === '/upload' && method === 'POST') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          assets: [
            { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, purchase_price: 150.00, current_price: 155.00 },
            { symbol: 'GOOGL', name: 'Alphabet Inc.', quantity: 5, purchase_price: 2500.00, current_price: 2550.00 },
            { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, purchase_price: 300.00, current_price: 305.00 }
          ],
          message: 'Se procesaron 3 activos'
        })
      };
    }

    // DEFAULT - RUTA NO ENCONTRADA
    console.log('❌ RUTA NO ENCONTRADA:', {
      originalPath: event.path,
      finalPath: path,
      method: method,
      rawUrl: event.rawUrl,
      allEventKeys: Object.keys(event)
    });
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Ruta no encontrada',
        originalPath: event.path,
        finalPath: path,
        method: method,
        rawUrl: event.rawUrl
      })
    };

  } catch (error) {
    console.error('❌ ERROR EN FUNCIÓN:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno del servidor',
        message: error.message
      })
    };
  }
};