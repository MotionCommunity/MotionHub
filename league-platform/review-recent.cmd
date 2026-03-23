@echo off
setlocal

set "LIMIT=%~1"
set "STATUS=%~2"
set "SINCE=%~3"

if "%LIMIT%"=="" set "LIMIT=10"
if "%STATUS%"=="" set "STATUS=parsed"
if "%SINCE%"=="" set "SINCE="

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0review-recent.ps1" -Limit %LIMIT% -Status %STATUS% -Since "%SINCE%"

endlocal
