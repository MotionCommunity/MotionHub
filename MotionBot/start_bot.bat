@echo off
title Motion RL Discord Bot
cd /d "%~dp0"
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)
echo Starting Motion RL Bot...
node index.js
pause
