@echo off
cd /d "%~dp0"
echo.
echo   EARTH JUKEBOX - servidor local
echo   Abrindo http://localhost:8013 ...
echo   Deixe esta janela aberta. Ctrl+C para parar.
echo.
start "" http://localhost:8013
python -m http.server 8013 2>nul || py -m http.server 8013
pause
