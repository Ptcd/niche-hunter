# PowerShell script to update .env with Supabase connection string

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Update .env with Supabase Connection String" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$connectionString = Read-Host "Paste your Supabase connection string here"

if ([string]::IsNullOrWhiteSpace($connectionString)) {
    Write-Host "❌ No connection string provided!" -ForegroundColor Red
    exit 1
}

# Clean up the string (remove quotes if present)
$connectionString = $connectionString.Trim().Trim('"').Trim("'")

# Validate format
if (-not $connectionString.StartsWith("postgresql://")) {
    Write-Host "⚠️  Warning: Connection string doesn't start with 'postgresql://'" -ForegroundColor Yellow
    Write-Host "   Make sure you copied the full URI from Supabase" -ForegroundColor Yellow
}

# Get .env file path
$envPath = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envPath)) {
    Write-Host "❌ .env file not found at: $envPath" -ForegroundColor Red
    exit 1
}

# Read .env content
$envContent = Get-Content $envPath -Raw

# Replace DATABASE_URL line
if ($envContent -match "DATABASE_URL=(.+)") {
    $newContent = $envContent -replace "DATABASE_URL=.+", "DATABASE_URL=$connectionString"
    
    # Write back
    Set-Content -Path $envPath -Value $newContent -NoNewline
    
    Write-Host ""
    Write-Host "✅ Successfully updated .env file!" -ForegroundColor Green
    Write-Host ""
    Write-Host "New DATABASE_URL:" -ForegroundColor Cyan
    Write-Host $connectionString -ForegroundColor Gray
    Write-Host ""
    Write-Host "Next step: Run migrations with:" -ForegroundColor Yellow
    Write-Host "  cd packages/db" -ForegroundColor White
    Write-Host "  npm run db:migrate" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ Could not find DATABASE_URL in .env file" -ForegroundColor Red
    exit 1
}

