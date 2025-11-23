@echo off
REM Quick database setup script for Windows

echo 🚀 Setting up Niche Hunter Database...

REM Check if Docker is available
where docker >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Docker found - starting database...
    docker-compose up -d
    
    echo ⏳ Waiting for database to be ready...
    timeout /t 5 /nobreak >nul
    
    echo 📦 Running migrations...
    cd packages\db
    call npm run db:migrate
    cd ..\..
    
    echo ✅ Database setup complete!
) else (
    echo ❌ Docker not found
    echo.
    echo Please choose one:
    echo 1. Install Docker Desktop from https://www.docker.com/products/docker-desktop
    echo 2. Use existing PostgreSQL (update .env with DATABASE_URL)
    echo 3. Use Supabase cloud database (see DATABASE_SETUP.md)
    echo.
    echo Then run: cd packages\db ^&^& npm run db:migrate
)

pause


