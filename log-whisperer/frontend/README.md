# Log-Whisperer Frontend

Modern, responsive dashboard for intelligent log analysis and real-time anomaly detection powered by ML.

## 📋 Features

- **Live Dashboard** - Real-time metrics and anomaly visualization
- **Anomaly Detection** - Visual scoring system with severity levels (Low, Medium, High, Critical)
- **Crash Reports** - Root cause analysis with service dependency tracking
- **Real-time Streaming** - WebSocket-based live anomaly feed
- **Log Upload** - Batch log file ingestion (CSV, JSON, TXT, Apache, Nginx formats)
- **Advanced Filtering** - Filter by service, score range, and date
- **Charts & Analytics** - Trend charts, service comparison, event distribution
- **Responsive Design** - Mobile-friendly interface with Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Backend server running on `http://127.0.0.1:8090` (or configured URL)

### Installation

```bash
# Install dependencies
npm install

# Configure backend URL (if needed)
# Edit .env.local and set NEXT_PUBLIC_API_BASE_URL
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## 📁 Project Structure

```
frontend/
├── app/
│   ├── page.js              # Main dashboard page
│   ├── layout.js            # Root layout with metadata
│   └── globals.css          # Global Tailwind styles
├── components/
│   ├── Header.js            # Top navigation bar
│   ├── StatsPanel.js        # KPI metrics cards
│   ├── AnomalyFeed.js       # Anomaly list with click handling
│   ├── AnomalyScore.js      # Score badge and visualization components
│   ├── CrashReportPanel.js  # Crash report and RCA display
│   ├── RealtimeStream.js    # Live WebSocket anomaly stream
│   ├── LogUploadModal.js    # File upload modal
│   ├── FilterControls.js    # Advanced filtering UI
│   └── Charts.js            # Recharts components (trend, service, distribution)
├── lib/
│   ├── api.js               # Axios client + API methods + WebSocket util
│   └── utils.js             # Formatting, color mapping, data extraction
├── package.json             # Dependencies & scripts
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.mjs       # PostCSS with Tailwind
├── next.config.mjs          # Next.js configuration
└── .env.local               # Local environment variables
```

## 🔧 Configuration

### Environment Variables

**`.env.local`** (for development):

```env
# Backend API URL
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8090

# Optional settings
NEXT_PUBLIC_API_TIMEOUT=10000
NEXT_PUBLIC_DEBUG=false
```

**Production deployment**: Set `NEXT_PUBLIC_API_BASE_URL` to your production backend URL.

## 🔌 API Integration

The frontend communicates with the Log-Whisperer backend via:

### REST Endpoints

- `GET /health` - Backend health check
- `GET /api/v1/status` - System status (events, windows, thresholds)
- `GET /api/v1/anomalies/query` - Query anomalies with filters
- `GET /api/v1/crash-reports` - Fetch crash reports
- `GET /api/v1/crash-reports/latest` - Latest crash report
- `POST /api/v1/logs/upload` - Upload log files
- `GET /api/v1/config` - Get threshold configuration

### WebSocket Endpoint

- `WS /api/v1/stream/subscribe` - Live anomaly stream

All API methods are abstracted in `lib/api.js` for easy client-side use.

## 🎨 Component Guide

### Core Components

**`Header`**
- Navigation bar with backend status indicator
- Refresh button with loading state
- Settings/upload button

**`StatsPanel`**
- 4-column metric cards (Events, Windows, Anomalies, Threshold)
- Color-coded by severity

**`AnomalyFeed`**
- Scrollable list of anomalies
- Color-coded left border (green/yellow/orange/red)
- Hover effect with detailed breakdown
- Clickable for detailed views

**`AnomalyScore`** (3 variants)
- `AnomalyScoreBadge` - Colored pill (sm/md/lg)
- `AnomalyScoreBar` - Horizontal bar with percentage
- `AnomalyScoreIndicator` - Large circular display

**`CrashReportPanel`**
- Root cause highlighting
- Affected services list
- Event timeline
- Recommendations

**`RealtimeStream`**
- Live anomaly updates via WebSocket
- Connection status indicator
- Auto-reconnect on disconnect
- Limited to 50 most recent items

**`Charts`** (3 types)
- `AnomalyTrendChart` - Score over time + event count
- `ServiceAnomalyChart` - Avg/max score by service
- `EventDistributionChart` - Stacked bar (events/errors/warnings)

### Utility Functions

**Color Mapping**
```javascript
getAnomalyColor(score)      // Returns Tailwind class
getAnomalyBgColor(score)    // Background color class
getAnomalyBadgeColor(score) // Badge styling
getSeverityLabel(score)     // "Low" | "Medium" | "High" | "Critical"
```

**Formatting**
```javascript
formatTime(timestamp)       // "14:25:30"
formatDateTime(timestamp)   // "Jan 15 14:25"
formatRelativeTime(timestamp) // "2m ago"
formatNumber(num)           // "1,234.56"
formatPercent(value)        // "45.2%"
```

**Data Extraction**
```javascript
getAnomalyDetails(anomaly)   // Normalized fields
getLogDetails(log)           // Normalized fields
getCrashReportDetails(report) // Normalized fields
```

## 📊 Dashboard Layout

### Top Section
- Header with status and controls
- 4-column stats panel

### Main Content

**Left Column (Primary)**
1. Anomaly Trend Chart - Time series of scores and event counts
2. Service Analysis Chart - Compare services by avg/max scores
3. Event Distribution Chart - Breakdown of log events
4. Live Anomaly Stream - Real-time WebSocket updates

**Center/Right Column**
1. Anomaly Feed - Filtered list with 10/show-all toggle
2. Filter Controls - Service, score range, date filtering
3. Crash Report Panel - Latest RCA with recommendations
4. Quick Actions - Upload & Refresh buttons

## 🔄 Data Flow

```
Dashboard.js
├── fetchDashboard() [on mount + every 5s]
│   ├── api.health() → backend status
│   ├── api.status() → metrics
│   ├── api.getLatestAnomalies() → anomaly list
│   └── api.getLatestCrashReport() → RCA
├── RealtimeStream [WebSocket connection]
│   └── createAnomalyStream() → live updates → re-fetch on new data
└── UI State Management
    ├── filters → filter & re-render anomalies
    ├── showAllAnomalies → expand/collapse feed
    └── showUploadModal → modal visibility
```

## 🎯 Color Scheme

Anomaly Score Severity:

| Score  | Label    | Color    | Hex     |
|--------|----------|----------|---------|
| 0-25   | Low      | Green    | #10b981 |
| 25-50  | Medium   | Yellow   | #f59e0b |
| 50-75  | High     | Orange   | #f97316 |
| 75-100 | Critical | Red      | #ef4444 |

## 📦 Dependencies

- **next** (15.2.4) - React framework
- **react** / **react-dom** (19.0.0) - UI library
- **axios** (1.7.0) - HTTP client
- **recharts** (2.12.0) - Charts library
- **lucide-react** (0.340.0) - Icons
- **tailwindcss** (3.4.1) - Utility-first CSS
- **clsx** (2.0.0) - Conditional className utility

## 🛠️ Development Tips

### Debugging

Enable debug logging:
```javascript
// In .env.local
NEXT_PUBLIC_DEBUG=true
```

### Common Tasks

**Add a new page/route:**
```javascript
// app/reports/page.js
export default function ReportsPage() {
  return <div>Reports</div>;
}
```

**Add a new component:**
```javascript
// components/MyComponent.js
export default function MyComponent({ prop1 }) {
  return <div>{prop1}</div>;
}
```

**Call API with loading state:**
```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  try {
    const result = await api.getAnomalies();
    setData(result);
  } finally {
    setLoading(false);
  }
};
```

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Connect repo to Vercel
# Set NEXT_PUBLIC_API_BASE_URL env var in Vercel dashboard
```

### Docker

```dockerfile
# Build
FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install && npm run build

# Runtime
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup for Production

```env
NODE_ENV=production
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

## 🧪 Testing

```bash
# Run ESLint
npm run lint

# Run type checking
npm run typecheck
```

## 📝 Performance Considerations

- Anomaly feed displays 10 items by default, with "show all" toggle
- Real-time stream limited to 50 most recent items
- Charts use useMemo to prevent unnecessary recalculations
- Auto-refresh every 5 seconds (configurable)
- WebSocket auto-reconnect on disconnect

## 🐛 Troubleshooting

### API Connection Error

Check that:
1. Backend is running on configured URL
2. `.env.local` has correct `NEXT_PUBLIC_API_BASE_URL`
3. Backend has CORS enabled
4. No firewall blocking requests

### WebSocket Connection Failed

- Backend may not support WebSocket
- Check backend logs for connection errors
- Verify WebSocket endpoint: `WS /api/v1/stream/subscribe`

### Charts Not Showing

- Ensure anomaly data is available
- Check browser console for errors
- Verify recharts library loaded correctly

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com)
- [Recharts](https://recharts.org)
- [Lucide Icons](https://lucide.dev)
- [Backend Documentation](../backend/README.md)

## 📄 License

Part of SentinelStack project

