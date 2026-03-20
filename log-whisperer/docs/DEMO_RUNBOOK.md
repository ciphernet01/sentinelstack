# Demo Runbook

## Scenario 1: Healthy baseline
- Stream normal logs for 30-60 seconds
- Confirm low anomaly scores

## Scenario 2: Crash pattern
- Inject DB timeout spikes + missing heartbeat + 5xx burst
- Observe threshold breach and crash report generation

## Demo checkpoints
- Live anomaly feed updates
- Alert fired on threshold breach
- Crash report shows first anomaly and likely root cause
