@echo off
echo ========================================
echo Starting Niche Hunter Database
echo ========================================
echo.

REM Check if Docker is running
docker ps >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Docker Desktop is not running!
    echo.
    echo Please:
    echo 1. Open Docker Desktop
    echo 2. Wait for it to fully start (icon in system tray)
    echo 3. Run this script again
    echo.
    pause
    exit /b 1
)

echo ✅ Docker is running
echo.
echo Starting database container...
docker compose up -d

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Database started!
    echo.
    echo Waiting 5 seconds for database to be ready...
    timeout /t 5 /nobreak >nul
    
    echo.
    echo Running database migrations...
    cd packages\db
    call npm run db:migrate
    cd ..\..
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ✅✅✅ SETUP COMPLETE! ✅✅✅
        echo.
        echo Your database is ready!
        echo You can now run: npx niche-hunter run --data ./my-data.csv
    ) else (
        echo.
        echo ⚠️ Migration had issues - check error messages above
    )
) else (
    echo.
    echo ❌ Failed to start database
    echo Check Docker Desktop is running and try again
)

echo.
pause

