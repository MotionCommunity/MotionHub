@echo off
setlocal

if "%~1"=="" (
  echo.
  echo   Drag one or more .replay files onto this script to ingest them.
  echo   The League API and worker must be running ^(run-local.cmd^).
  echo.
  pause
  goto :eof
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ingest-replay.ps1" %*

endlocal
