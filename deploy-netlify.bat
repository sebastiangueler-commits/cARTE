@echo off
echo 🌍 DESPLEGANDO APLICACIÓN A NETLIFY PARA ACCESO GLOBAL
echo =====================================================

echo 📦 Instalando dependencias...
call npm install

echo 🔧 Verificando configuración...
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

echo ✅ Configuración verificada correctamente

echo 🚀 Iniciando deploy a Netlify...
echo.
echo 📋 INSTRUCCIONES IMPORTANTES:
echo 1. Asegúrate de tener una cuenta en Netlify
echo 2. Conecta tu repositorio o haz deploy manual
echo 3. Configura las variables de entorno en Netlify Dashboard:
echo    - JWT_SECRET = portfolio-manager-secret-key-2024-production
echo    - NODE_ENV = production
echo    - CLIENT_URL = https://admincarteras.netlify.app
echo.
echo 🌐 Una vez desplegado, tu app estará disponible globalmente en:
echo    https://admincarteras.netlify.app
echo.
echo 📱 Credenciales de acceso:
echo    Usuario: admin
echo    Contraseña: admin123
echo.

echo ¿Quieres continuar con el deploy? (S/N)
set /p choice=
if /i "%choice%"=="S" (
    echo 🚀 Ejecutando deploy...
    call netlify deploy --prod --dir .
    echo.
    echo ✅ Deploy completado!
    echo 🌍 Tu aplicación ahora es accesible desde cualquier lugar del mundo
) else (
    echo ❌ Deploy cancelado
)

echo.
echo 📞 Si tienes problemas:
echo 1. Revisa los logs en Netlify Dashboard
echo 2. Verifica las variables de entorno
echo 3. Confirma que todos los archivos estén subidos
echo 4. Prueba desde diferentes navegadores y ubicaciones
echo.
pause
