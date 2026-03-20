# Log-Whisperer Backend - PowerShell Setup Script
# Run this to automatically install dependencies

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Log-Whisperer Backend - Automated Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "Checking for Python installation..." -ForegroundColor Yellow

try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Python not found on system!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python 3.10 or newer:" -ForegroundColor Yellow
    Write-Host "  1. Visit: https://www.python.org/downloads/" 
    Write-Host "  2. Download and run the installer"
    Write-Host "  3. IMPORTANT: Check 'Add Python to PATH' during installation"
    Write-Host "  4. Restart PowerShell"
    Write-Host "  5. Run this script again"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Check if pip is available
Write-Host "Checking pip installation..." -ForegroundColor Yellow

try {
    $pipVersion = python -m pip --version 2>&1
    Write-Host "✓ pip is available" -ForegroundColor Green
} catch {
    Write-Host "ERROR: pip not available!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running: python -m ensurepip --upgrade" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Install requirements
Write-Host "Installing project dependencies..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Step 1/2: Upgrading pip..." -ForegroundColor Cyan
python -m pip install --upgrade pip

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Failed to upgrade pip!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2/2: Installing requirements..." -ForegroundColor Cyan
python -m pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Failed to install dependencies!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running manually:" -ForegroundColor Yellow
    Write-Host "  python -m pip install -r requirements.txt"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✓ All dependencies installed successfully!" -ForegroundColor Green
Write-Host ""

# Verify installation
Write-Host "Verifying installation..." -ForegroundColor Yellow
python -c "import fastapi, pydantic, sklearn, numpy, pandas; print('✓ All packages verified!')" 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  Setup Complete!" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To start the backend server, run:" -ForegroundColor Yellow
    Write-Host "  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Then test with:" -ForegroundColor Yellow
    Write-Host "  curl http://localhost:8000/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use curl from another PowerShell window:" -ForegroundColor Yellow
    Write-Host "  Invoke-WebRequest http://localhost:8000/health" -ForegroundColor Cyan
    Write-Host ""
}

Read-Host "Press Enter to exit"
