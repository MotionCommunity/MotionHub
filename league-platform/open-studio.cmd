@echo off
setlocal

set ROOT=%~dp0
set PRISMA_CMD=%ROOT%node_modules\.bin\prisma.cmd

if not exist "%PRISMA_CMD%" (
  echo Prisma CLI not found. Run run-local.cmd first.
  goto :end
)

pushd "%ROOT%packages\db"
call "%PRISMA_CMD%" studio
popd

:end
endlocal
