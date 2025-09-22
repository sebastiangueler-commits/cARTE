@echo off
echo ========================================
echo   ACTUALIZAR APLICACION EN NETLIFY
echo ========================================
echo.
echo Tu aplicacion ya esta desplegada en Netlify.
echo Ahora vamos a actualizarla para acceso mundial.
echo.

echo ========================================
echo   PASOS A SEGUIR:
echo ========================================
echo.
echo 1. Ve a tu dashboard de Netlify
echo 2. Selecciona tu sitio
echo 3. Ve a Site settings ^> Environment variables
echo 4. Agrega estas variables:
echo.
echo    JWT_SECRET = portfolio-manager-secret-key-2024-production
echo    NODE_ENV = production
echo    CLIENT_URL = https://tu-app-name.netlify.app
echo.
echo 5. Reemplaza "tu-app-name" con tu URL real
echo.

set /p netlify_url="Ingresa tu URL de Netlify (ej: https://mi-app.netlify.app): "

if "%netlify_url%"=="" (
    echo Error: URL requerida
    pause
    exit /b 1
)

echo.
echo Actualizando configuracion para: %netlify_url%
echo.

REM Actualizar netlify.toml
powershell -Command "(Get-Content 'netlify.toml') -replace 'https://your-app-name.netlify.app', '%netlify_url%' | Set-Content 'netlify.toml'"

REM Actualizar netlify functions
powershell -Command "(Get-Content 'netlify\functions\api\index.js') -replace 'https://tu-app-name.netlify.app', '%netlify_url%' | Set-Content 'netlify\functions\api\index.js'"

echo.
echo ========================================
echo   ARCHIVOS ACTUALIZADOS
echo ========================================
echo.
echo ✓ netlify.toml actualizado
echo ✓ netlify/functions/api/index.js actualizado
echo.

echo ========================================
echo   PROXIMOS PASOS:
echo ========================================
echo.
echo 1. Sube estos archivos actualizados a Netlify:
echo    - Opcion A: git add . ^&^& git commit -m "Update global access" ^&^& git push
echo    - Opcion B: Arrastra la carpeta actualizada a Netlify
echo.
echo 2. Ve a Site settings ^> Environment variables
echo 3. Agrega las variables mencionadas arriba
echo 4. Tu aplicacion estara disponible mundialmente en: %netlify_url%
echo.

echo ========================================
echo   CREDENCIALES DE ACCESO:
echo ========================================
echo.
echo Usuario: admin
echo Contraseña: admin123
echo.

echo Presiona cualquier tecla para continuar...
pause > nul
