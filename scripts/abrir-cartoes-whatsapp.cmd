@echo off
setlocal
cd /d "%~dp0.."
if not exist "output\participant-cards\playwright-runtime\node_modules\playwright-core\package.json" (
  echo Instalando Playwright local para preparar os anexos...
  call npm install --prefix output/participant-cards/playwright-runtime --no-package-lock playwright-core@1.65.1
  if errorlevel 1 exit /b 1
)
echo Este comando enviara ate 10 cartoes em sequencia pela conta do evento.
node --env-file=.env --env-file=.env.local scripts/prepare-whatsapp-card.mjs --batch=10 --send
pause
