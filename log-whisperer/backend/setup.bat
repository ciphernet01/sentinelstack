@echo off
REM Log-Whisperer Backend - Quick Setup Script
REM Run this script to automatically install Python and all dependencies

echo.
echo ============================================================
echo  Log-Whisperer Backend - Automated Setup
echo ============================================================
echo.

REM Check if Python is installed
echo Checking for Python installation...
python --version >nul 2>&1

if errorlevel 1 (
    echo.
    echo ERROR: Python not found on system!
    echo.
    echo Please install Python 3.10 or newer:
    echo   1. Visit: https://www.python.org/downloads/
    echo   2. Download and run the installer
    echo   3. IMPORTANT: Check "Add Python to PATH" during installation
    echo   4. Run this script again
    echo.
    pause
    exit /b 1
)

REM Get Python version
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✓ Found: %PYTHON_VERSION%
echo.

REM Check if pip is available
echo Checking pip installation...
python -m pip --version >nul 2>&1

if errorlevel 1 (
    echo ERROR: pip not available!
    echo.
    echo Run this in PowerShell to fix:
    echo   python -m ensurepip --upgrade
    echo.
    pause
    exit /b 1
)

echo ✓ pip is available
echo.

REM Install requirements
echo Installing project dependencies...
echo This may take a few minutes...
echo.

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo ERROR: Failed to install dependencies!
    echo.
    echo Try running manually:
    echo   python -m pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

echo.
echo ✓ All dependencies installed successfully!
echo.
echo ============================================================
echo  Setup Complete!
echo ============================================================
echo.
echo To start the backend server, run:
echo   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
echo.
echo Then test with:
echo   curl http://localhost:8000/health
echo.
pause
