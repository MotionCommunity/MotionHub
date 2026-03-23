@echo off
setlocal

set ROOT=%~dp0
set NODE_BIN=%ProgramFiles%\nodejs
set NPM_CMD=%NODE_BIN%\npm.cmd
set PRISMA_CMD=%ROOT%node_modules\.bin\prisma.cmd

echo.
echo [1/5] Checking Docker...
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker CLI not found. Open Docker Desktop first, then run this file again.
  goto :end
)

echo.
echo [2/5] Starting local infra containers...
docker compose -f "%ROOT%infra\docker-compose.yml" up -d postgres redis minio
if errorlevel 1 (
  echo Failed to start containers. Make sure Docker Desktop is running.
  goto :end
)

if not exist "%NPM_CMD%" (
  echo npm.cmd not found at "%NPM_CMD%".
  goto :end
)

echo.
echo [3/5] Ensuring dependencies are installed...
call "%NPM_CMD%" install
if errorlevel 1 goto :end

if not exist "%PRISMA_CMD%" (
  echo Prisma CLI not found. npm install may have failed.
  goto :end
)

echo.
echo [4/5] Syncing Prisma schema to database...
pushd "%ROOT%packages\db"
call "%PRISMA_CMD%" db push
if errorlevel 1 (
  popd
  goto :end
)
popd

echo.
echo [5/5] Launching API and Worker in new terminals...
start "League API" cmd /k "cd /d %ROOT% && "%NPM_CMD%" run dev:api"
start "League Worker" cmd /k "cd /d %ROOT% && "%NPM_CMD%" run dev:worker"

echo.
echo =============================================
echo   All running!
echo   API:      http://localhost:4001/health
echo   Studio:   run open-studio.cmd (optional)
echo   Stop:     run stop-local.cmd
echo =============================================

:end
endlocal
