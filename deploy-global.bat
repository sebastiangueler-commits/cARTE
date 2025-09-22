@echo off
echo ========================================
echo   DEPLOY GLOBAL - ACCESO MUNDIAL
echo ========================================
echo.
echo Preparando aplicacion para despliegue mundial...
echo.

REM Verificar que Netlify CLI esté instalado
where netlify >nul 2>nul
if %errorlevel% neq 0 (
    echo Instalando Netlify CLI...
    npm install -g netlify-cli
    if %errorlevel% neq 0 (
        echo Error instalando Netlify CLI
        pause
        exit /b 1
    )
)

echo.
echo Verificando archivos necesarios...
if not exist "netlify.toml" (
    echo Error: netlify.toml no encontrado
    pause
    exit /b 1
)

if not exist "netlify\functions\api\index.js" (
    echo Error: Funcion de Netlify no encontrada
    pause
    exit /b 1
)

echo.
echo Archivos verificados correctamente.
echo.

echo ========================================
echo   OPCIONES DE DEPLOY
echo ========================================
echo.
echo 1. Deploy manual (arrastrar carpeta a netlify.com)
echo 2. Deploy con CLI (requiere login)
echo 3. Solo verificar configuracion
echo.
set /p choice="Selecciona una opcion (1-3): "

if "%choice%"=="1" goto manual
if "%choice%"=="2" goto cli
if "%choice%"=="3" goto verify
goto invalid

:manual
echo.
echo ========================================
echo   DEPLOY MANUAL
echo ========================================
echo.
echo 1. Ve a https://netlify.com
echo 2. Inicia sesion o crea una cuenta
echo 3. Haz clic en "New site from Git" o "Deploy manually"
echo 4. Arrastra esta carpeta completa a Netlify
echo 5. Configura las variables de entorno:
echo    - JWT_SECRET = portfolio-manager-secret-key-2024-production
echo    - NODE_ENV = production
echo    - CLIENT_URL = https://tu-app-name.netlify.app
echo.
echo Tu aplicacion estara disponible en: https://tu-app-name.netlify.app
echo.
goto end

:cli
echo.
echo ========================================
echo   DEPLOY CON CLI
echo ========================================
echo.
echo Iniciando deploy con Netlify CLI...
echo.

REM Login a Netlify
netlify login
if %errorlevel% neq 0 (
    echo Error en login de Netlify
    pause
    exit /b 1
)

REM Deploy
netlify deploy --prod --dir .
if %errorlevel% neq 0 (
    echo Error en deploy
    pause
    exit /b 1
)

echo.
echo Deploy completado exitosamente!
echo Tu aplicacion esta disponible mundialmente.
echo.
goto end

:verify
echo.
echo ========================================
echo   VERIFICACION DE CONFIGURACION
echo ========================================
echo.

echo Verificando netlify.toml...
findstr "build" netlify.toml >nul
if %errorlevel% equ 0 (
    echo ✓ Configuracion de build encontrada
) else (
    echo ✗ Error en configuracion de build
)

findstr "functions" netlify.toml >nul
if %errorlevel% equ 0 (
    echo ✓ Configuracion de functions encontrada
) else (
    echo ✗ Error en configuracion de functions
)

echo.
echo Verificando funcion de API...
if exist "netlify\functions\api\index.js" (
    echo ✓ Funcion de API encontrada
) else (
    echo ✗ Funcion de API no encontrada
)

echo.
echo Verificando archivos principales...
if exist "index.html" (
    echo ✓ index.html encontrado
) else (
    echo ✗ index.html no encontrado
)

if exist "package.json" (
    echo ✓ package.json encontrado
) else (
    echo ✗ package.json no encontrado
)

echo.
echo ========================================
echo   RESUMEN
echo ========================================
echo.
echo Tu aplicacion esta lista para deploy mundial.
echo.
echo Credenciales por defecto:
echo - Usuario: admin
echo - Contraseña: admin123
echo.
echo Una vez desplegado, sera accesible desde:
echo - Cualquier dispositivo en el mundo
echo - Cualquier navegador
echo - HTTPS automatico
echo.
goto end

:invalid
echo Opcion invalida. Por favor selecciona 1, 2 o 3.
pause
goto start

:end
echo.
echo Presiona cualquier tecla para continuar...
pause > nul
