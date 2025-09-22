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

  try {
    const path = event.path;
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    console.log(`Request: ${method} ${path}`);

    // Ruta de login
    if (path === '/api/auth/login' && method === 'POST') {
      const { username, password } = body;
      
      // Usuario por defecto
      if (username === 'admin' && password === 'admin123') {
        const token = 'admin-token-' + Date.now();
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            token,
            user: {
              id: 1,
              username: 'admin',
              email: 'admin@portfolio.com',
              fullName: 'Administrador'
            },
            message: 'Login exitoso'
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

    // Ruta de verificación de token
    if (path === '/api/auth/verify' && method === 'GET') {
      const authHeader = event.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer admin-token-')) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            user: {
              id: 1,
              username: 'admin',
              userId: 1
            },
            message: 'Token válido'
          })
        };
      } else {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Token inválido' })
        };
      }
    }

    // Ruta de portfolios
    if (path === '/api/portfolios' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([
          {
            id: 1,
            name: 'Mi Primera Cartera',
            description: 'Cartera de demostración',
            asset_count: 3,
            total_value: 15000,
            total_profit: 1500,
            created_at: new Date().toISOString()
          }
        ])
      };
    }

    // Ruta para crear portfolio
    if (path === '/api/portfolios' && method === 'POST') {
      const { name, description } = body;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: Date.now(),
          name: name || 'Nueva Cartera',
          description: description || '',
          message: 'Cartera creada exitosamente'
        })
      };
    }

    // Ruta para eliminar portfolio
    if (path.startsWith('/api/portfolios/') && method === 'DELETE') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Portfolio eliminado exitosamente' })
      };
    }

    // Ruta para activos de portfolio
    if (path.startsWith('/api/portfolios/') && path.endsWith('/assets') && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([
          {
            id: 1,
            symbol: 'AAPL',
            name: 'Apple Inc.',
            quantity: 10,
            purchase_price: 150.00,
            current_price: 165.00,
            portfolio_id: 1
          },
          {
            id: 2,
            symbol: 'GOOGL',
            name: 'Alphabet Inc.',
            quantity: 5,
            purchase_price: 2500.00,
            current_price: 2600.00,
            portfolio_id: 1
          }
        ])
      };
    }

    // Ruta para subir imagen OCR
    if (path === '/api/upload' && method === 'POST') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          portfolio: { id: 1 },
          assets: [
            { symbol: 'AAPL', name: 'Apple Inc.', quantity: 10, purchase_price: 150.00 },
            { symbol: 'MSFT', name: 'Microsoft Corporation', quantity: 8, purchase_price: 300.00 }
          ],
          extractedFromImage: true,
          message: 'Se agregaron 2 activos al portfolio'
        })
      };
    }

    // Ruta para usuarios (solo admin)
    if (path === '/api/users' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify([
          {
            id: 1,
            username: 'admin',
            email: 'admin@portfolio.com',
            full_name: 'Administrador',
            created_at: new Date().toISOString()
          }
        ])
      };
    }

    // Ruta para crear usuario
    if (path === '/api/auth/register' && method === 'POST') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          user: {
            id: Date.now(),
            username: body.username,
            email: body.email,
            fullName: body.fullName
          },
          message: 'Usuario creado exitosamente'
        })
      };
    }

    // Ruta para estadísticas del dashboard
    if (path === '/api/dashboard/stats' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          total_portfolios: 1,
          total_assets: 2,
          total_value: 15000,
          total_profit: 1500
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
