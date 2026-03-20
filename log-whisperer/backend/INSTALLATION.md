# Log-Whisperer Backend - Installation & Setup Guide

## Status: Python Not Found on System

**Current Issue:** Python is not installed on this system. The `python` command redirects to the Microsoft Store placeholder instead of a real Python installation.

---

## Step 1: Install Python 3.10+ (Required First)

### Option A: Download from Official Site (Recommended)

1. Go to https://www.python.org/downloads/
2. Download **Python 3.11** or newer (latest stable version)
3. Run the installer (.exe file)
4. **IMPORTANT:** Check the box "Add Python to PATH" during installation
5. Complete the installation

### Option B: Use Windows Package Manager (If Available)

```powershell
winget install Python.Python.3.11
```

### Option C: Using Chocolatey (If Installed)

```powershell
choco install python
```

---

## Step 2: Verify Python Installation

After installing Python, restart PowerShell and run:

```powershell
python --version
python -m pip --version
```

Both should show version numbers (not "not found").

**Expected Output:**
```
Python 3.11.x
pip X.X.x from C:\Users\...\Python311\lib\site-packages\pip (python 3.11)
```

---

## Step 3: Install Project Dependencies

### Navigate to Backend Directory

```powershell
cd c:\Users\ASUS\OneDrive\Desktop\sentinelstack-main\sentinelstack-main\log-whisperer\backend
```

### Install All Requirements

```powershell
python -m pip install -r requirements.txt
```

**What Gets Installed:**
```
fastapi==0.115.0          # Web framework
uvicorn[standard]==0.30.6 # ASGI server
pydantic==2.9.2           # Data validation
scikit-learn==1.5.2       # ML algorithms (Isolation Forest)
numpy==2.1.1              # Numerical computing
pandas==2.2.3             # Data processing
python-dateutil==2.9.0    # Date/time utilities
orjson==3.10.7            # Fast JSON serialization
```

### Upgrade pip First (Optional but Recommended)

```powershell
python -m pip install --upgrade pip
```

---

## Step 4: Verify Installation

Run this to verify all packages are installed:

```powershell
python -c "import fastapi, pydantic, sklearn, numpy, pandas; print('✅ All dependencies installed successfully!')"
```

---

## Step 5: Run the Application

### Start the Backend Server

```powershell
cd log-whisperer/backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### Test Health Endpoint

In a new PowerShell window:

```powershell
curl http://localhost:8000/health
```

**Expected Response:**
```json
{"status":"ok","service":"log-whisperer-backend"}
```

---

## Step 6: Run Tests (Optional)

### Install pytest (If You Want to Run Tests)

```powershell
python -m pip install pytest
```

### Run All Tests

```powershell
cd log-whisperer/backend
pytest tests/ -v --tb=short
```

### Run Specific Test File

```powershell
pytest tests/test_api_routes.py -v
```

---

## Step 7: API Endpoints Reference

Once the server is running, you can access endpoints:

### Health Check
```bash
curl http://localhost:8000/health
```

### Upload Logs
```bash
curl -X POST http://localhost:8000/api/v1/logs/upload \
  -F "file=@path/to/logfile.txt" \
  -F "format_hint=nginx"
```

### Query Anomalies
```bash
curl "http://localhost:8000/api/v1/anomalies?min_score=50"
```

### Stream Anomalies (Real-Time)
```bash
curl "http://localhost:8000/api/v1/stream/anomalies?duration_sec=60"
```

### Get Detector Status
```bash
curl http://localhost:8000/api/v1/status/detector
```

### Get Crash Reports
```bash
curl "http://localhost:8000/api/v1/crashes"
```

---

## Troubleshooting

### Error: "Python was not found; run without arguments to install from the Microsoft Store"

**Solution:**
1. Uninstall or disable the Python Windows App alias:
   - Settings → Apps → Advanced app settings → App execution aliases
   - Toggle OFF "python.exe" and "python3.exe"
2. Install Python from https://www.python.org/downloads/ (check "Add to PATH")
3. Restart PowerShell
4. Verify: `python --version`

### Error: "No module named 'fastapi'"

**Solution:**
```powershell
python -m pip install -r requirements.txt
```

Ensure you ran this from the `log-whisperer/backend` directory.

### Error: "port 8000 already in use"

**Solution:**
```powershell
# Use a different port
uvicorn app.main:app --reload --port 8001
```

or kill the existing process:

```powershell
# Find process on port 8000
netstat -ano | findstr :8000
# Kill it (replace PID with actual number)
taskkill /PID <PID> /F
```

### ModuleNotFoundError after pip install

**Solution:**
1. Ensure you're in the correct directory:
   ```powershell
   pwd  # Should show: ...sentinelstack-main\log-whisperer\backend
   ```

2. Try upgrading pip:
   ```powershell
   python -m pip install --upgrade pip
   ```

3. Reinstall requirements:
   ```powershell
   python -m pip install --force-reinstall -r requirements.txt
   ```

---

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Python | 3.8 | 3.11+ |
| pip | 20.0 | Latest |
| RAM | 2GB | 4GB+ |
| Disk Space | 500MB | 1GB |
| OS | Windows 10/11 | Windows 11 |

---

## Virtual Environment (Optional but Recommended)

To isolate project dependencies:

```powershell
# Create virtual environment
python -m venv venv

# Activate it
.\venv\Scripts\Activate.ps1

# Install requirements
python -m pip install -r requirements.txt

# Deactivate when done
deactivate
```

---

## Configuration Files

Once dependencies are installed, the application can be configured via:

- **Schema Defaults:** `app/core/schemas.py` (Config class)
- **Environment Variables:** Create `.env` file in backend directory:
  ```
  WINDOW_SIZE_SEC=60
  ALERT_THRESHOLD=61
  CRITICAL_THRESHOLD=81
  ```

---

## Next Steps

1. ✅ Install Python from official site
2. ✅ Run `python -m pip install -r requirements.txt` in backend directory
3. ✅ Start server: `uvicorn app.main:app --reload`
4. ✅ Test: `curl http://localhost:8000/health`
5. ✅ Upload logs: Use POST /api/v1/logs/upload endpoint
6. ✅ Query anomalies: Use GET /api/v1/anomalies endpoint

---

## Support

If any issues persist:
1. Check Python is in PATH: `python --version`
2. Verify all deps: `python -m pip list`
3. Check firewall blocking port 8000
4. Ensure backend directory has all `__init__.py` files

**Repository:** https://github.com/ciphernet01/sentinelstack

