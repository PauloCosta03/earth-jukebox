@echo off
cd /d "%~dp0"
echo.
echo   EARTH JUKEBOX - servidor local
echo   Abrindo http://localhost:8013 ...
echo   Deixe esta janela aberta. Ctrl+C para parar.
echo.
start "" http://localhost:8013
rem scripts\serve.py = servidor do Python com fila de conexoes maior (o padrao recusa conexoes no 1o acesso)
python scripts\serve.py 8013 2>nul || py scripts\serve.py 8013 || python -m http.server 8013
pause
