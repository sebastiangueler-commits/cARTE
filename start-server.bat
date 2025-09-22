@echo off
echo ========================================
echo   PORTFOLIO MANAGER - INICIO SERVIDOR
echo ========================================
echo.
echo Iniciando servidor...
echo.

REM Encontrar IP local
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        set LOCAL_IP=%%b
        goto :found_ip
    )
)
:found_ip

echo Tu IP local es: %LOCAL_IP%
echo.
echo URLs de acceso:
echo - Desde PC: http://localhost:5000
echo - Desde celular: http://%LOCAL_IP%:5000
echo.
echo IMPORTANTE: Asegurate de que tu celular este en la misma red WiFi
echo.

REM Iniciar servidor
node server.js

pause
