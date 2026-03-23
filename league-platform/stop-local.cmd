@echo off
setlocal

set ROOT=%~dp0

echo Stopping local infra containers...
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker CLI not found. If Docker Desktop is closed already, you can ignore this.
  goto :end
)

docker compose -f "%ROOT%infra\docker-compose.yml" down

echo.
echo Note: API/Worker terminals stay open until you close them manually.

:end
endlocal
