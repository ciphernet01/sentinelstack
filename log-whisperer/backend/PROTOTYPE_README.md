# Log-Whisperer Production Prototype

## Run

```powershell
cd log-whisperer/backend
c:/Users/Divyansh/Downloads/Compressed/download_2/.venv/Scripts/python.exe -m uvicorn app.prototype.api:app --host 127.0.0.1 --port 8091
```

## Key Endpoints

- `POST /upload_logs` (multipart file)
- `POST /stream_logs`
- `GET /anomalies`
- `GET /crash_report`
- `POST /similar_incidents`
- `GET /health`
- `GET /docs`

## Quick Smoke Test

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:8091/health" -UseBasicParsing
curl.exe -X POST -F "file=@samples/prototype_upload.log" http://127.0.0.1:8091/upload_logs
Invoke-WebRequest -Uri "http://127.0.0.1:8091/crash_report" -UseBasicParsing
```

## Notes

- Ingestion uses `asyncio.Queue` + batch consumers.
- Similarity uses FAISS when installed, otherwise cosine similarity fallback.
- Incident history is persisted in `prototype_incidents.db`.
