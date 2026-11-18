@echo off
setlocal
cd /d "%~dp0app"
call npm run deploy:hk -- %*
if errorlevel 1 pause
endlocal
