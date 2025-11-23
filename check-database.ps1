# Quick Database Connection Check
Write-Host "Checking DATABASE_URL..." -ForegroundColor Cyan

$dbUrl = "postgresql://postgres:Buildequity123!@db.fpwayqwhdendrgtottwj.supabase.co:5432/postgres"

Write-Host "Testing connection..." -ForegroundColor Yellow
cd packages/db
$result = npx prisma db pull --schema=./prisma/schema.prisma 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database connection works!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your DATABASE_URL should be:" -ForegroundColor Cyan
    Write-Host $dbUrl -ForegroundColor White
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Restart your Next.js server!" -ForegroundColor Yellow
    Write-Host "   1. Stop npm run dev (Ctrl+C)"
    Write-Host "   2. Make sure .env has: DATABASE_URL=$dbUrl"
    Write-Host "   3. Run: cd apps/web && npm run dev"
} else {
    Write-Host "❌ Database connection failed!" -ForegroundColor Red
    Write-Host $result
}

cd ../..

