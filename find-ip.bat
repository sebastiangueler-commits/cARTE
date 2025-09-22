@echo off
echo ========================================
echo   ENCONTRAR IP LOCAL PARA ACCESO MOVIL
echo ========================================
echo.
echo Buscando tu IP local...
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo Tu IP local es: %%b
        echo.
        echo Para acceder desde tu celular usa:
        echo http://%%b:5000
        echo.
        echo Asegurate de que tu celular este conectado a la misma red WiFi
        echo.
    )
)

echo Presiona cualquier tecla para continuar...
pause > nul
