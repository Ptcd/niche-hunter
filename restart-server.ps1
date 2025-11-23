Write-Host "🔄 Restarting Next.js Server..." -ForegroundColor Cyan
Write-Host ""

# Close existing PowerShell windows running npm
Write-Host "1. Closing old PowerShell windows..." -ForegroundColor Yellow
# Get all PowerShell processes except the current one
$currentPid = $PID
$powershellProcs = Get-Process powershell -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $currentPid }
if ($powershellProcs.Count -gt 0) {
    Write-Host "   Found $($powershellProcs.Count) PowerShell process(es) to close" -ForegroundColor Cyan
    foreach ($proc in $powershellProcs) {
        try {
            # Try to close gracefully first
            $proc.CloseMainWindow() | Out-Null
            Start-Sleep -Milliseconds 500
            # Force kill if still running
            if (!$proc.HasExited) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1
    Write-Host "   ✅ Closed old PowerShell windows" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  No old PowerShell windows found" -ForegroundColor Gray
}

# Find and kill Node processes on port 3000
Write-Host ""
Write-Host "2. Stopping current server..." -ForegroundColor Yellow
$port3000 = netstat -ano | findstr ":3000" | Select-String "LISTENING"
if ($port3000) {
    $pid = ($port3000 -split '\s+')[-1]
    Write-Host "   Found process on port 3000 (PID: $pid)" -ForegroundColor Cyan
    try {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Host "   ✅ Stopped server process" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "   ⚠️  Could not stop process (might already be stopped)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ℹ️  No process found on port 3000" -ForegroundColor Gray
}

# Close Chrome
Write-Host ""
Write-Host "3. Closing Chrome..." -ForegroundColor Yellow
$chromeProcs = Get-Process | Where-Object {$_.ProcessName -like "*chrome*"}
if ($chromeProcs.Count -gt 0) {
    Write-Host "   Found $($chromeProcs.Count) Chrome process(es)" -ForegroundColor Cyan
    Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Write-Host "   ✅ Closed Chrome" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Chrome is already closed" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Now start the server manually:" -ForegroundColor Cyan
Write-Host "   cd apps\web" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Or press any key to start it automatically..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Start the server
Write-Host ""
Write-Host "4. Starting server..." -ForegroundColor Yellow
Set-Location "apps\web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
Set-Location ..\..

Write-Host ""
Write-Host "✅ Server should be starting in a new window!" -ForegroundColor Green
Write-Host "   Wait for 'Ready on http://localhost:3000' message" -ForegroundColor Cyan
Write-Host "   Then start a new analysis in Firefox" -ForegroundColor Cyan

