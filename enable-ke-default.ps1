$chromeData = "$env:LOCALAPPDATA\Google\Chrome\User Data"
$defaultPrefs = "$chromeData\Default\Preferences"
$keExtId = "hbapdpeemoojbophdfndmlgdhppljgmp"

if (Test-Path $defaultPrefs) {
    $json = Get-Content $defaultPrefs -Raw
    $prefs = $json | ConvertFrom-Json
    
    if (-not $prefs.extensions) {
        $prefs | Add-Member -MemberType NoteProperty -Name "extensions" -Value @{} -Force
    }
    if (-not $prefs.extensions.settings) {
        $prefs.extensions | Add-Member -MemberType NoteProperty -Name "settings" -Value @{} -Force
    }
    
    # Create extension settings
    $extSettings = @{
        state = 1
        creation_flags = 1
        path = $keExtId
        location = 1
        initial_keybindings_set = $true
    }
    
    $prefs.extensions.settings | Add-Member -MemberType NoteProperty -Name $keExtId -Value $extSettings -Force
    
    # Convert back to JSON and save
    $prefs | ConvertTo-Json -Depth 20 | Set-Content $defaultPrefs -Encoding UTF8
    Write-Host "✅ Enabled Keywords Everywhere in Default profile"
} else {
    Write-Host "Creating Default preferences file..."
    $defaultDir = "$chromeData\Default"
    if (-not (Test-Path $defaultDir)) {
        New-Item -ItemType Directory -Path $defaultDir -Force | Out-Null
    }
    
    $prefs = @{
        extensions = @{
            settings = @{
                $keExtId = @{
                    state = 1
                    creation_flags = 1
                    path = $keExtId
                    location = 1
                }
            }
        }
    }
    
    $prefs | ConvertTo-Json -Depth 20 | Set-Content $defaultPrefs -Encoding UTF8
    Write-Host "✅ Created Default preferences with Keywords Everywhere enabled"
}








