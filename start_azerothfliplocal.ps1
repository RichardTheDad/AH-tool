param(
    [string]$PythonPath = "",
    [switch]$SkipInstall,
    [switch]$NoBrowser,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[AzerothFlipLocal] $Message" -ForegroundColor Cyan
}

function Resolve-PythonPath {
    param([string]$RequestedPath)

    $candidates = @()

    if ($RequestedPath) {
        $candidates += $RequestedPath
    }

    if ($env:AZEROTHFLIPLOCAL_PYTHON) {
        $candidates += $env:AZEROTHFLIPLOCAL_PYTHON
    }

    $candidates += "C:\Users\Richard\AppData\Local\Python\pythoncore-3.14-64\python.exe"

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if ($candidate -and (Test-Path $candidate)) {
            return (Resolve-Path $candidate).Path
        }
    }

    $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        return $pythonCommand.Source
    }

    throw "Python was not found. Pass -PythonPath `"C:\path\to\python.exe`" or set AZEROTHFLIPLOCAL_PYTHON."
}

function Get-FileHashString {
    param([string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}

function Ensure-BackendDependencies {
    if ($SkipInstall) {
        Write-Step "Skipping backend dependency install."
        return
    }

    $requirementsHash = Get-FileHashString $script:backendRequirementsPath
    $stampPath = Join-Path $script:backendDepsDir ".requirements.sha256"
    $installedHash = ""

    if (Test-Path $stampPath) {
        $installedHash = (Get-Content -LiteralPath $stampPath -Raw).Trim()
    }

    if ((Test-Path (Join-Path $script:backendDepsDir "fastapi")) -and $installedHash -eq $requirementsHash) {
        Write-Step "Backend dependencies already look up to date."
        return
    }

    if ($DryRun) {
        Write-Step "Dry run: backend dependencies would be installed or updated."
        return
    }

    Write-Step "Installing backend dependencies into backend\.deps ..."
    $env:TEMP = $script:backendTempDir
    $env:TMP = $script:backendTempDir
    & ${script:pythonExe} -m pip install --disable-pip-version-check --upgrade --target $script:backendDepsDir -r $script:backendRequirementsPath
    Set-Content -LiteralPath $stampPath -Value $requirementsHash -Encoding ASCII
}

function Ensure-FrontendDependencies {
    if ($SkipInstall) {
        Write-Step "Skipping frontend dependency install."
        return
    }

    $lockPath = Join-Path $script:frontendDir "package-lock.json"
    if (-not (Test-Path $lockPath)) {
        $lockPath = Join-Path $script:frontendDir "package.json"
    }

    $lockHash = Get-FileHashString $lockPath
    $stampPath = Join-Path $script:frontendDir ".node_modules.sha256"
    $installedHash = ""

    if (Test-Path $stampPath) {
        $installedHash = (Get-Content -LiteralPath $stampPath -Raw).Trim()
    }

    if ((Test-Path (Join-Path $script:frontendDir "node_modules")) -and $installedHash -eq $lockHash) {
        Write-Step "Frontend dependencies already look up to date."
        return
    }

    if ($DryRun) {
        Write-Step "Dry run: frontend dependencies would be installed or updated."
        return
    }

    Write-Step "Installing frontend dependencies into frontend\node_modules ..."
    Push-Location $script:frontendDir
    try {
        & ${script:npmExe} install
    }
    finally {
        Pop-Location
    }

    Set-Content -LiteralPath $stampPath -Value $lockHash -Encoding ASCII
}

function Start-BackendWindow {
    $command = @"
`$Host.UI.RawUI.WindowTitle = 'AzerothFlipLocal Backend'
Set-Location '$script:backendDir'
`$env:PYTHONPATH = '$script:backendDepsDir;$script:backendDir'
`$env:TEMP = '$script:backendTempDir'
`$env:TMP = '$script:backendTempDir'
`$env:AZEROTHFLIPLOCAL_CORS_ORIGINS = 'http://127.0.0.1:5173,http://localhost:5173'
Write-Host 'Backend starting on http://127.0.0.1:8000' -ForegroundColor Green
& '$script:pythonExe' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
"@

    if ($DryRun) {
        Write-Step "Dry run: backend window would start uvicorn on http://127.0.0.1:8000"
        return
    }

    Start-Process -FilePath "powershell.exe" -WorkingDirectory $script:backendDir -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        $command
    ) | Out-Null
}

function Start-FrontendWindow {
    $command = @"
`$Host.UI.RawUI.WindowTitle = 'AzerothFlipLocal Frontend'
Set-Location '$script:frontendDir'
`$env:VITE_API_BASE_URL = 'http://127.0.0.1:8000'
Write-Host 'Frontend starting on http://127.0.0.1:5173' -ForegroundColor Green
& '$script:npmExe' run dev -- --host 127.0.0.1 --port 5173
"@

    if ($DryRun) {
        Write-Step "Dry run: frontend window would start Vite on http://127.0.0.1:5173"
        return
    }

    Start-Process -FilePath "powershell.exe" -WorkingDirectory $script:frontendDir -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        $command
    ) | Out-Null
}

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"
$backendDepsDir = Join-Path $backendDir ".deps"
$backendTempDir = Join-Path $backendDir ".tmp"
$backendRequirementsPath = Join-Path $backendDir "requirements.txt"
$envPath = Join-Path $rootDir ".env"

if (-not (Test-Path $backendDir)) {
    throw "Backend directory not found at $backendDir"
}

if (-not (Test-Path $frontendDir)) {
    throw "Frontend directory not found at $frontendDir"
}

if (-not (Test-Path $envPath)) {
    throw ".env was not found at $envPath. Create it in the repo root before starting the app."
}

$pythonExe = Resolve-PythonPath $PythonPath
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
}

if (-not $npmCommand) {
    throw "npm was not found on PATH. Install Node.js or open a terminal where npm is available."
}

$npmExe = $npmCommand.Source

New-Item -ItemType Directory -Force $backendDepsDir, $backendTempDir | Out-Null

Write-Step "Using Python: $pythonExe"
Write-Step "Using npm: $npmExe"

Ensure-BackendDependencies
Ensure-FrontendDependencies
Start-BackendWindow
Start-FrontendWindow

if (-not $NoBrowser) {
    if ($DryRun) {
        Write-Step "Dry run: browser would open http://127.0.0.1:5173"
    }
    else {
        Start-Sleep -Seconds 3
        Start-Process "http://127.0.0.1:5173"
    }
}

Write-Step "Done. Close the backend and frontend PowerShell windows when you want to stop the app."
