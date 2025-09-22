exports.handler = async (event, context) => {
  console.log('🚀 FUNCIÓN ULTRA-SIMPLE:', event.httpMethod, event.path);

  // Headers básicos
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // OPTIONS para CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Path simple
    let path = event.path;
    if (path.startsWith('/.netlify/functions/api')) {
      path = path.replace('/.netlify/functions/api', '');
    }

    console.log('📋 PATH:', path, 'METHOD:', event.httpMethod);

    // HEALTH CHECK
    if (path === '/health' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'OK', message: 'API funcionando' })
      };
    }

    // LOGIN
    if (path === '/auth/login' && event.httpMethod === 'POST') {
      let body = {};
      try {
        if (event.body) {
          body = JSON.parse(event.body);
        }
      } catch (e) {
        console.log('Error parsing body:', e.message);
      }

      if (body.username === 'admin' && body.password === 'admin123') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            token: 'fake-token',
            user: { id: 1, username: 'admin' }
          })
        };
      } else {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Credenciales inválidas' })
        };
      }
    }

    // PORTFOLIOS
    if (path === '/portfolios' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([])
      };
    }

    // UPLOAD
    if (path === '/upload' && event.httpMethod === 'POST') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          assets: [
            { symbol: 'AAPL', quantity: 10, price: 150.00 },
            { symbol: 'GOOGL', quantity: 5, price: 2500.00 }
          ]
        })
      };
    }

    // DEFAULT
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({
        error: 'Ruta no encontrada',
        path: path,
        method: event.httpMethod
      })
    };

  } catch (error) {
    console.error('❌ ERROR:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Error interno',
        message: error.message
      })
    };
  }
};