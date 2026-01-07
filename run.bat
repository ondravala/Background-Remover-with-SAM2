@echo off
echo ========================================
echo  Lego Background Remover
echo ========================================
echo.
echo Spoustim aplikaci...
echo.
echo Backend: http://localhost:5001
echo Frontend: http://localhost:8000
echo.
echo NEZAVIREJ toto okno - aplikace bezi!
echo Pro ukonceni stiskni CTRL+C
echo ========================================
echo.

cd /d "%~dp0"

:: Spustit backend v novem okne
start /min cmd /c "cd backend && python app.py"

:: Pockat 3 sekundy na start backendu
timeout /t 3 /nobreak >nul

:: Spustit frontend v novem okne
start /min cmd /c "cd frontend && python -m http.server 8000"

:: Pockat 2 sekundy
timeout /t 2 /nobreak >nul

:: Otevrit prohlizec
echo Oteviram prohlizec...
start http://localhost:8000

echo.
echo ========================================
echo  Aplikace bezi!
echo ========================================
echo.
echo Pro ukonceni zavri toto okno
echo nebo stiskni libovolnou klavesu
echo.

pause >nul

:: Pri ukonceni zabit procesy
echo Ukoncuji servery...
taskkill /F /FI "WINDOWTITLE eq Administrator:  C:\Windows\system32\cmd.exe - python*" >nul 2>&1
