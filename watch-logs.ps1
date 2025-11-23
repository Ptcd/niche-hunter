# Watch for new analysis log files and display validation messages
$lastLogFile = $null
$lastLogTime = Get-Date

Write-Host "🔍 Monitoring for new analysis runs..." -ForegroundColor Cyan
Write-Host ""

while ($true) {
    # Find the most recent log file
    $latestLog = Get-ChildItem -Path "." -Filter "analysis-run-*.log" -ErrorAction SilentlyContinue | 
        Sort-Object LastWriteTime -Descending | 
        Select-Object -First 1
    
    if ($latestLog -and ($latestLog.FullName -ne $lastLogFile -or $latestLog.LastWriteTime -gt $lastLogTime)) {
        $lastLogFile = $latestLog.FullName
        $lastLogTime = $latestLog.LastWriteTime
        
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host "📄 New/Updated log: $($latestLog.Name)" -ForegroundColor Yellow
        Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
        Write-Host ""
        
        # Read the log file and filter for important messages
        $content = Get-Content $latestLog.FullName -Tail 50 -ErrorAction SilentlyContinue
        
        # Show validation messages
        $validationLines = $content | Select-String -Pattern "\[VALIDATION\]|Volume for|📦 Using cached|Profit:|Difficulty signals" | Select-Object -Last 20
        
        if ($validationLines) {
            foreach ($line in $validationLines) {
                if ($line.Line -match "\[VALIDATION\].*REJECTED") {
                    Write-Host $line.Line -ForegroundColor Red
                } elseif ($line.Line -match "Volume for") {
                    Write-Host $line.Line -ForegroundColor Cyan
                } elseif ($line.Line -match "📦 Using cached") {
                    Write-Host $line.Line -ForegroundColor Yellow
                } elseif ($line.Line -match "Profit:") {
                    Write-Host $line.Line -ForegroundColor Green
                } elseif ($line.Line -match "Difficulty signals") {
                    Write-Host $line.Line -ForegroundColor Magenta
                } else {
                    Write-Host $line.Line
                }
            }
        } else {
            Write-Host "   (No validation messages yet - run may be starting...)" -ForegroundColor Gray
        }
        
        Write-Host ""
    }
    
    Start-Sleep -Seconds 2
}






