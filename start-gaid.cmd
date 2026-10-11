@echo off
rem GeoAIDesk (GAID) entry point: make sure Node exists, then run the GAID
rem launcher (geo/start.mjs), which starts the production build with user data
rem outside this checkout. macOS/Linux users run start-gaid.sh instead.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js not found. Install Node.js 22 or newer from https://nodejs.org/
    echo ^(or run: winget install OpenJS.NodeJS.LTS^), reopen this terminal,
    echo then run start-gaid.cmd again.
    exit /b 1
)

node geo\start.mjs %*
exit /b %errorlevel%
