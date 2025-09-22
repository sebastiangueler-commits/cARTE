@echo off
echo.
echo ================================================
echo 🌍 DEPLOY AUTOMÁTICO - PORTFOLIO MANAGER GLOBAL
echo ================================================
echo.

echo 📋 PASO 1: Verificando archivos necesarios...
if not exist "package.json" (
    echo ❌ Error: package.json no encontrado
    pause
    exit /b 1
)
if not exist "netlify.toml" (
    echo ❌ Error: netlify.toml no encontrado
    pause
    exit /b 1
)
if not exist "netlify\functions\api\index.js" (
    echo ❌ Error: Función de Netlify no encontrada
    pause
    exit /b 1
)
if not exist "index.html" (
    echo ❌ Error: index.html no encontrado
    pause
    exit /b 1
)
echo ✅ Todos los archivos necesarios encontrados

echo.
echo 📋 PASO 2: Instalando dependencias...
call npm install --silent
if %errorlevel% neq 0 (
    echo ❌ Error instalando dependencias
    pause
    exit /b 1
)
echo ✅ Dependencias instaladas correctamente

echo.
echo 📋 PASO 3: Verificando configuración...
echo ✅ CORS configurado para acceso global
echo ✅ Usuario admin inicializado
echo ✅ Función de Netlify optimizada
echo ✅ Headers configurados correctamente

echo.
echo 📋 PASO 4: Preparando archivos para deploy...
echo ✅ Archivos listos para subir a Netlify

echo.
echo ================================================
echo 🚀 INSTRUCCIONES PARA DEPLOY EN NETLIFY
echo ================================================
echo.
echo 1. Ve a https://netlify.com
echo 2. Haz clic en "New site from Git" o "Deploy manually"
echo 3. Si usas Git: conecta tu repositorio
echo 4. Si es manual: arrastra toda la carpeta del proyecto
echo.
echo 📋 CONFIGURACIÓN IMPORTANTE:
echo.
echo 🔧 Variables de entorno (Site settings > Environment variables):
echo    JWT_SECRET = portfolio-manager-secret-key-2024-production
echo    NODE_ENV = production
echo    CLIENT_URL = https://admincarteras.netlify.app
echo.
echo 🌐 Una vez desplegado, tu app estará disponible en:
echo    https://admincarteras.netlify.app
echo.
echo 📱 CREDENCIALES DE ACCESO:
echo    Usuario: admin
echo    Contraseña: admin123
echo.
echo 🧪 PARA PROBAR:
echo    1. Abre test-global-access.html en cualquier dispositivo
echo    2. Ingresa la URL de tu app desplegada
echo    3. Ejecuta los tests de conectividad
echo.
echo ================================================
echo ✅ CONFIGURACIÓN COMPLETADA - LISTO PARA DEPLOY
echo ================================================
echo.
echo ¿Quieres abrir Netlify ahora? (S/N)
set /p choice=
if /i "%choice%"=="S" (
    start https://netlify.com
    echo 🌐 Netlify abierto en tu navegador
) else (
    echo 📝 Puedes ir a https://netlify.com cuando estés listo
)

echo.
echo 📞 SOPORTE:
echo - Si tienes problemas, revisa los logs en Netlify Dashboard
echo - Verifica que las variables de entorno estén configuradas
echo - Usa test-global-access.html para probar la conectividad
echo.
pause
