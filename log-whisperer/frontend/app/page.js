"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8090";

const initialData = {
  health: null,
  status: null,
  anomalies: { total: 0, items: [] },
  report: { item: null },
  logs: { total: 0, items: [] },
  enhanced: null,
  error: null,
};

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status}`);
  return response.json();
}

export default function Page() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [health, status, anomalies, report, logs, enhanced] = await Promise.all([
        fetchJson("/health"),
        fetchJson("/api/v1/status"),
        fetchJson("/api/v1/anomalies/live?limit=20"),
        fetchJson("/api/v1/reports/latest"),
        fetchJson("/api/v1/logs/recent?limit=10"),
        fetchJson("/api/v1/enhanced/status"),
      ]);

      setData({ health, status, anomalies, report, logs, enhanced, error: null });
    } catch (error) {
      setData((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to load dashboard",
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const intervalId = setInterval(refresh, 4000);
    return () => clearInterval(intervalId);
  }, []);

  const backendUp = useMemo(() => data.health?.status === "ok", [data.health]);
  const latestReport = data.report?.item || data.report?.report || null;

  return (
    <main className="container">
      <section className="card hero">
        <div>
          <h1>Log-Whisperer Dashboard</h1>
          <p>Live anomaly detection, ML enhancement health, and crash RCA feed.</p>
        </div>
        <button onClick={refresh} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </section>

      {data.error ? <section className="card error">{data.error}</section> : null}

      <section className="grid metrics">
        <div className="card">
          <div className="label">Backend</div>
          <div className={backendUp ? "ok metric" : "down metric"}>{backendUp ? "UP" : "DOWN"}</div>
        </div>
        <div className="card">
          <div className="label">Events Ingested</div>
          <div className="metric">{data.status?.events_ingested ?? 0}</div>
        </div>
        <div className="card">
          <div className="label">Windows Processed</div>
          <div className="metric">{data.status?.windows_processed ?? 0}</div>
        </div>
        <div className="card">
          <div className="label">Live Anomalies</div>
          <div className="metric">{data.anomalies?.total ?? 0}</div>
        </div>
      </section>

      <section className="grid two-col">
        <article className="card">
          <h2>Latest Crash Report</h2>
          {latestReport ? (
            <>
              <p><b>Root Cause:</b> {latestReport.root_cause || "n/a"}</p>
              <p><b>First Anomaly:</b> {latestReport.first_anomaly_timestamp || "n/a"}</p>
              <p><b>Affected Services:</b> {(latestReport.affected_services || []).join(", ") || "n/a"}</p>
            </>
          ) : (
            <p>No crash report generated yet.</p>
          )}
        </article>

        <article className="card">
          <h2>ML Enhancement Status</h2>
          <div className="phase-list">
            {Object.entries(data.enhanced || {})
              .filter(([key]) => key.startsWith("phase_"))
              .map(([phase, values]) => (
                <div key={phase} className="phase">
                  <b>{phase.replace("_", " ").toUpperCase()}</b>
                  <ul>
                    {Object.entries(values || {}).map(([name, value]) => (
                      <li key={name}>{name}: <span className="mono">{String(value)}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </article>
      </section>

      <section className="grid two-col">
        <article className="card">
          <h2>Recent Anomalies</h2>
          <ul className="feed">
            {(data.anomalies?.items || []).slice(0, 8).map((item, idx) => (
              <li key={`${item.window || item.timestamp || idx}`}>
                <span>{item.service || "unknown"}</span>
                <span className="mono">score={item.anomaly_score ?? 0}</span>
              </li>
            ))}
            {!data.anomalies?.items?.length ? <li>No anomaly records yet.</li> : null}
          </ul>
        </article>

        <article className="card">
          <h2>Recent Log Windows</h2>
          <ul className="feed">
            {(data.logs?.items || []).slice(0, 8).map((item, idx) => (
              <li key={`${item.window_start || idx}`}>
                <span>{item.service || "unknown"}</span>
                <span className="mono">events={item.event_count ?? 0}, err={item.error_rate ?? 0}</span>
              </li>
            ))}
            {!data.logs?.items?.length ? <li>No log windows yet.</li> : null}
          </ul>
        </article>
      </section>
    </main>
  );
}
