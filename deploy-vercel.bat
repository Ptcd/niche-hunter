@echo off
echo ========================================
echo Deploying Niche Hunter to Vercel
echo ========================================
echo.

cd apps\web

REM Check if Vercel CLI is installed
where vercel >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing Vercel CLI...
    npm install -g vercel
)

echo.
echo Starting deployment...
echo.

REM Deploy to production
vercel --prod

echo.
echo ✅ Deployment started!
echo.
echo Next steps:
echo 1. Add environment variables in Vercel dashboard
echo 2. Redeploy if needed: vercel --prod
echo.

pause

