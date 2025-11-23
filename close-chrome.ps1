# Script to close all Chrome processes
Write-Host "Closing all Chrome processes..." -ForegroundColor Yellow

$chromeProcesses = Get-Process | Where-Object {$_.ProcessName -like "*chrome*"}

if ($chromeProcesses.Count -eq 0) {
    Write-Host "No Chrome processes found. Chrome is already closed." -ForegroundColor Green
} else {
    Write-Host "Found $($chromeProcesses.Count) Chrome process(es)..." -ForegroundColor Cyan
    
    foreach ($proc in $chromeProcesses) {
        Write-Host "  Closing process: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Yellow
        try {
            $proc.CloseMainWindow() | Out-Null
        } catch {
            Write-Host "  Could not close gracefully, force killing..." -ForegroundColor Red
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
    
    # Wait a moment for processes to close
    Start-Sleep -Seconds 3
    
    # Force kill any remaining Chrome processes
    $remaining = Get-Process | Where-Object {$_.ProcessName -like "*chrome*"}
    if ($remaining.Count -gt 0) {
        Write-Host "Force killing remaining Chrome processes..." -ForegroundColor Yellow
        Stop-Process -Name "chrome" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Final check
    $final = Get-Process | Where-Object {$_.ProcessName -like "*chrome*"}
    if ($final.Count -eq 0) {
        Write-Host "✅ All Chrome processes closed successfully!" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Some Chrome processes may still be running:" -ForegroundColor Yellow
        foreach ($proc in $final) {
            Write-Host "  - $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Yellow
        }
        Write-Host "You may need to manually close Chrome or restart your computer." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "You can now start a new analysis." -ForegroundColor Green

