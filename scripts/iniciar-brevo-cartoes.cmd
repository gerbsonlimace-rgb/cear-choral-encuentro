@echo off
setlocal
cd /d "%~dp0.."
node --env-file=.env --env-file=.env.local scripts/brevo-local-service.mjs
pause
