from fastapi import FastAPI

app = FastAPI(title="Log-Whisperer API", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "log-whisperer-backend"}


@app.get("/api/v1/status")
def status() -> dict:
    return {
        "ingest": "pending",
        "parse": "pending",
        "detect": "pending",
        "report": "pending",
    }
