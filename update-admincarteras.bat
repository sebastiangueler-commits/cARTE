@echo off
echo ========================================
echo   ACTUALIZAR admincarteras.netlify.app
echo ========================================
echo.
echo Tu aplicacion: https://admincarteras.netlify.app
echo Configurando para acceso mundial...
echo.

echo ========================================
echo   ARCHIVOS ACTUALIZADOS:
echo ========================================
echo.
echo ✓ netlify.toml - URL actualizada
echo ✓ netlify/functions/api/index.js - CORS configurado
echo ✓ index.html - API adaptativa
echo.

echo ========================================
echo   VARIABLES DE ENTORNO PARA NETLIFY:
echo ========================================
echo.
echo Ve a tu dashboard de Netlify:
echo 1. Selecciona admincarteras.netlify.app
echo 2. Ve a Site settings ^> Environment variables
echo 3. Agrega estas variables:
echo.
echo    JWT_SECRET = portfolio-manager-secret-key-2024-production
echo    NODE_ENV = production
echo    CLIENT_URL = https://admincarteras.netlify.app
echo.

echo ========================================
echo   PROXIMOS PASOS:
echo ========================================
echo.
echo 1. Sube estos archivos actualizados a Netlify:
echo    - Opcion A: git add . ^&^& git commit -m "Update for global access" ^&^& git push
echo    - Opcion B: Arrastra la carpeta actualizada a Netlify
echo.
echo 2. Configura las variables de entorno (pasos de arriba)
echo 3. Espera 2-3 minutos para que se actualice
echo 4. Prueba desde cualquier dispositivo: https://admincarteras.netlify.app
echo.

echo ========================================
echo   CREDENCIALES DE ACCESO:
echo ========================================
echo.
echo Usuario: admin
echo Contraseña: admin123
echo.

echo ========================================
echo   PRUEBAS RECOMENDADAS:
echo ========================================
echo.
echo 1. Desde tu celular (misma red WiFi)
echo 2. Desde otra computadora
echo 3. Desde un navegador diferente
echo 4. Desde modo incognito
echo.

echo ¡Tu aplicacion estara disponible mundialmente!
echo URL: https://admincarteras.netlify.app
echo.

echo Presiona cualquier tecla para continuar...
pause > nul
