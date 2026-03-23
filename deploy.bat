@echo off
setlocal enabledelayedexpansion

REM ===== Motion Notes API deploy (secure, SSH key-based) =====
set "SERVER_USER=root"
set "SERVER_HOST=134.209.170.51"
set "SERVER=%SERVER_USER%@%SERVER_HOST%"
set "REMOTE_DIR=/opt/motion/notes-api"
set "LOCAL_DIR=%~dp0hub-app\notes-api"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"

echo.
echo Motion deploy target: %SERVER%
echo Local notes-api path: %LOCAL_DIR%
echo Remote path:          %REMOTE_DIR%
echo.

if not exist "%LOCAL_DIR%\docker-compose.server.yml" (
  echo ERROR: Could not find notes-api deploy files.
  echo Expected: %LOCAL_DIR%\docker-compose.server.yml
  pause
  exit /b 1
)

if not exist "%SSH_KEY%" (
  echo ERROR: SSH key not found at %SSH_KEY%
  echo.
  echo Generate one first:
  echo   ssh-keygen -t ed25519 -C "motion-deploy"
  echo Then install it on server:
  echo   type "%SSH_KEY%.pub" ^| ssh %SERVER% "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
  echo.
  pause
  exit /b 1
)

echo [1/4] Ensuring remote directories...
ssh -i "%SSH_KEY%" %SERVER% "mkdir -p %REMOTE_DIR% /opt/motion/notes-data /opt/motion/caddy_data /opt/motion/caddy_config"
if errorlevel 1 (
  echo ERROR: Could not connect/create remote directories.
  pause
  exit /b 1
)

echo [2/4] Uploading notes-api project...
scp -i "%SSH_KEY%" -r "%LOCAL_DIR%\*" %SERVER%:%REMOTE_DIR%/
if errorlevel 1 (
  echo ERROR: Upload failed.
  pause
  exit /b 1
)

echo [3/4] Ensuring remote .env...
ssh -i "%SSH_KEY%" %SERVER% "cd %REMOTE_DIR% && if [ ! -f .env ]; then cp .env.server.example .env; fi"
if errorlevel 1 (
  echo ERROR: Failed to prepare .env on server.
  pause
  exit /b 1
)

echo [4/4] Building and starting containers...
ssh -i "%SSH_KEY%" %SERVER% "cd %REMOTE_DIR% && docker compose -f docker-compose.server.yml --env-file .env up -d --build && docker compose -f docker-compose.server.yml ps"
if errorlevel 1 (
  echo ERROR: Docker deploy failed.
  pause
  exit /b 1
)

echo.
echo Deploy complete.
echo.
echo Next steps:
echo 1) In Cloudflare DNS, create A record:
echo    Name: sync
echo    Content: 134.209.170.51
echo    Proxy status: DNS only (gray cloud) for initial certificate issuance.
echo 2) Wait 1-2 minutes, then verify:
echo    https://sync.motioncommunity.gg/health
echo 3) In Motion Hub, set Notes sync URL to:
echo    https://sync.motioncommunity.gg
echo.
pause

