from __future__ import annotations

from fastapi.responses import HTMLResponse


def render_dashboard_stub() -> HTMLResponse:
    html = """
    <!doctype html>
    <html>
    <head>
      <meta charset=\"utf-8\" />
      <title>Log-Whisperer Dashboard Stub</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; background: #0f172a; color: #e2e8f0; }
        h1 { margin-bottom: 8px; }
        .card { background: #1e293b; border-radius: 10px; padding: 16px; margin: 12px 0; }
        .mono { font-family: Consolas, monospace; font-size: 13px; }
      </style>
    </head>
    <body>
      <h1>Log-Whisperer Prototype</h1>
      <p>Use API endpoints to ingest logs and inspect crash analytics.</p>
      <div class=\"card\">
        <div><b>POST</b> /upload_logs</div>
        <div><b>POST</b> /stream_logs</div>
        <div><b>GET</b> /anomalies</div>
        <div><b>GET</b> /crash_report</div>
        <div><b>POST</b> /similar_incidents</div>
      </div>
      <div class=\"card mono\">
        Tip: Open /docs for interactive request testing.
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)
