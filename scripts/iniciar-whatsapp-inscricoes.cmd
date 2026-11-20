@echo off
setlocal
cd /d "%~dp0.."
if not exist "output\participant-cards\playwright-runtime\node_modules\playwright-core\package.json" (
  call npm install --prefix output/participant-cards/playwright-runtime --no-package-lock playwright-core@1.65.1
  if errorlevel 1 exit /b 1
)
node --env-file=.env --env-file=.env.local scripts/whatsapp-local-service.mjs
pause
