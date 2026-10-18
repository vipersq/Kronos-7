@echo off
chcp 65001 >nul
title KRONOS-7 Planetary Intel
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
if not exist data mkdir data
echo.
echo  KRONOS-7 · przygotowanie systemu
echo.

rem ---------------------------------------------------------------- Python
call :findpy
if defined PY goto deps
echo  Nie znaleziono Pythona.
choice /C TN /M "  Zainstalowac Pythona 3.12 automatycznie"
if errorlevel 2 goto nopy
where winget >nul 2>nul || goto nopy
winget install -e --id Python.Python.3.12 --scope user --silent --accept-source-agreements --accept-package-agreements
set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%LOCALAPPDATA%\Programs\Python\Launcher;%PATH%"
call :findpy
if defined PY goto deps
:nopy
echo.
echo  Zainstaluj Pythona 3.10 lub nowszego z https://www.python.org/downloads/
echo  (zaznacz "Add python.exe to PATH") i uruchom ten plik ponownie.
pause
exit /b 1

rem ---------------------------------------------------------------- dodatki
:deps
if exist "data\.deps_ok" goto ollama
echo  Instaluje dodatki: pycountry (polskie nazwy krajow) i h3 (mapa zaklocen GPS)...
%PY% -m pip install --user --quiet --disable-pip-version-check -r requirements.txt && echo ok> "data\.deps_ok"

rem ---------------------------------------------------------------- Ollama
:ollama
set "OLL=%LOCALAPPDATA%\Programs\Ollama"
if exist "%OLL%\ollama.exe" set "PATH=%OLL%;%PATH%"
where ollama >nul 2>nul && goto ollama_run
if exist "data\.no_ollama" goto start
echo.
echo  Nie znaleziono Ollamy, czyli silnika lokalnego AI.
choice /C TN /M "  Zainstalowac Ollame automatycznie"
if errorlevel 2 goto skip_ollama
where winget >nul 2>nul && winget install -e --id Ollama.Ollama --silent --accept-source-agreements --accept-package-agreements
if exist "%OLL%\ollama.exe" goto ollama_ok
echo  Pobieram instalator z ollama.com...
powershell -NoProfile -Command "Invoke-WebRequest -UseBasicParsing https://ollama.com/download/OllamaSetup.exe -OutFile $env:TEMP\OllamaSetup.exe"
if exist "%TEMP%\OllamaSetup.exe" "%TEMP%\OllamaSetup.exe" /VERYSILENT /NORESTART
:ollama_ok
if exist "%OLL%\ollama.exe" set "PATH=%OLL%;%PATH%"
where ollama >nul 2>nul && goto ollama_run
echo  Instalacja Ollamy nie powiodla sie. Pobierz ja recznie z https://ollama.com/download
goto start
:skip_ollama
echo n> "data\.no_ollama"
echo  OK, terminal ruszy bez analizy AI. Aby wrocic do tego pytania, usun plik data\.no_ollama
goto start

:ollama_run
tasklist /FI "IMAGENAME eq ollama.exe" | find /I "ollama.exe" >nul || start "" /min ollama serve

rem ---------------------------------------------------------------- start
:start
echo.
echo  KRONOS-7 startuje: http://127.0.0.1:7707
echo  Przy pierwszym uruchomieniu system sam pobierze model AI dobrany do karty graficznej.
echo  Zamknij to okno, aby wylaczyc system.
echo.
%PY% server.py
pause
exit /b 0

:findpy
set "PY="
py -3 --version >nul 2>nul && set "PY=py -3" && goto :eof
python --version >nul 2>nul && set "PY=python" && goto :eof
goto :eof
