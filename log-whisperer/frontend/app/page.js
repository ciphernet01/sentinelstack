const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8090";

async function fetchHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`, { cache: "no-store" });
    if (!response.ok) return { status: "down", details: `HTTP ${response.status}` };
    const data = await response.json();
    return { status: "up", details: JSON.stringify(data) };
  } catch (error) {
    return { status: "down", details: error instanceof Error ? error.message : "Unknown error" };
  }
}

export default async function Page() {
  const health = await fetchHealth();

  return (
    <main className="container">
      <section className="card">
        <h1>Log-Whisperer Frontend</h1>
        <p>Team runtime check endpoint is now active on this port.</p>
      </section>

      <section className="card">
        <h2>Backend Health</h2>
        <p className={health.status === "up" ? "ok" : "down"}>{health.status.toUpperCase()}</p>
        <pre>{health.details}</pre>
      </section>
    </main>
  );
}
