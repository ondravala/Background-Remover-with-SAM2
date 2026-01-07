@echo off
echo ========================================
echo  Lego Background Remover - INSTALACE
echo ========================================
echo.
echo Tento skript nainstaluje vsechny zavislosti
echo.
pause

cd /d "%~dp0"

echo.
echo [1/3] Kontrola Python...
python --version
if errorlevel 1 (
    echo CHYBA: Python neni nainstalovan!
    echo Stahni Python z https://www.python.org/
    pause
    exit /b 1
)

echo.
echo [2/3] Instalace Python balicku...
cd backend
pip install -r requirements.txt
if errorlevel 1 (
    echo CHYBA pri instalaci balicku!
    pause
    exit /b 1
)

echo.
echo [3/3] Kontrola SAM2...
cd ..
if not exist "sam2" (
    echo.
    echo POZOR: SAM2 neni naklonovan!
    echo.
    echo Spust nasledujici prikazy:
    echo   cd "%~dp0"
    echo   git clone https://github.com/facebookresearch/segment-anything-2.git sam2
    echo   cd sam2
    echo   pip install -e .
    echo.
    echo Potom stahnout checkpoint:
    echo   https://github.com/facebookresearch/segment-anything-2
    echo.
    pause
) else (
    echo SAM2 nalezen!
    cd sam2
    pip install -e .
)

echo.
echo ========================================
echo  INSTALACE DOKONCENA!
echo ========================================
echo.
echo Pro spusteni pouzij: start_all.bat
echo.
pause
