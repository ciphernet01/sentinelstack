# Log-Whisperer Frontend - Developer Quick Start Guide

## 🎯 What's Been Built

A complete, production-ready frontend dashboard for Log-Whisperer with:

✅ **Real-time Dashboard** - Live metrics, stats, and monitoring
✅ **Anomaly Management** - Visual scoring, severity badges, filtering
✅ **Crash Report Analysis** - RCA with timeline and recommendations
✅ **Advanced Charts** - Trends, service comparison, event distribution
✅ **WebSocket Streaming** - Real-time live anomaly feed
✅ **Log File Upload** - Batch ingestion with progress tracking
✅ **Responsive Design** - Tailwind CSS, mobile-friendly UI
✅ **API Integration** - Fully connected to backend APIs

## 🚀 Getting Started (5 minutes)

### Step 1: Install Dependencies

```bash
cd log-whisperer/frontend
npm install
```

This will install:
- Next.js 15.2.4 (React 19)
- Tailwind CSS for styling
- Recharts for data visualization
- Axios for API calls
- Lucide icons library

### Step 2: Configure Backend Connection

Edit `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8090
```

Make sure your backend is running on this address, or adjust accordingly.

### Step 3: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📊 Dashboard Overview

The dashboard is organized into key sections:

### Header Area
- **Status Indicator** - Shows if backend is connected (green = OK)
- **Refresh Button** - Manual data refresh
- **Upload Button** - Quick access to log upload

### Metrics Strip (Top)
Four key KPI cards:
- Events Ingested - Total logs processed
- Windows Processed - Time-windowed aggregations
- Anomalies Detected - Total anomalies found
- Alert Threshold - Current scoring threshold

### Main Charts (Center)
1. **Anomaly Trends** - Time series of anomaly scores
2. **Service Analysis** - Which services have highest anomalies
3. **Event Distribution** - Breakdown of event types
4. **Live Stream** - Real-time anomaly updates

### Sidebar
- **Anomalies List** - Detailed feed of detected anomalies
- **Filter Controls** - Filter by service, score, date range
- **Crash Reports** - Latest RCA findings
- **Quick Actions** - Upload & refresh

## 🔌 Understanding the API Connection

### How the Frontend Talks to the Backend

All API calls go through `lib/api.js`:

```javascript
import { api } from '@/lib/api';

// Get latest anomalies
const anomalies = await api.getLatestAnomalies(20);

// Upload a log file
await api.uploadLogs(file);

// Query with filters
const filtered = await api.getAnomalies(limit, offset, minScore);

// Subscribe to real-time stream
const ws = createAnomalyStream(
  (data) => console.log('New anomaly:', data),
  (error) => console.error('Stream error:', error)
);
```

### Key API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Check if backend is up |
| `/api/v1/status` | GET | Get system metrics |
| `/api/v1/anomalies/query` | GET | Fetch anomalies |
| `/api/v1/crash-reports/latest` | GET | Latest crash report |
| `/api/v1/logs/upload` | POST | Upload log file |
| `/api/v1/stream/subscribe` | WebSocket | Live anomaly stream |

## 🎨 Understanding Components

### Component Hierarchy

```
Dashboard (page.js)
├── Header
├── StatsPanel
├── Charts
│   ├── AnomalyTrendChart
│   ├── ServiceAnomalyChart
│   └── EventDistributionChart
├── RealtimeStream
├── FilterControls
├── AnomalyFeed
│   └── AnomalyScoreBadge (for each item)
├── CrashReportPanel
└── LogUploadModal
```

### Key Component Props & Features

**`AnomalyFeed`**
```javascript
<AnomalyFeed 
  anomalies={items}
  isLoading={loading}
  onAnomalyClick={(anomaly) => {}}
/>
```
- Auto-paginates (10 items default)
- Color-coded by severity
- Shows model scores breakdown

**`AnomalyScore` Variants**
```javascript
// Colored badge with severity
<AnomalyScoreBadge score={78} size="md" showLabel />

// Horizontal bar visualization
<AnomalyScoreBar score={78} height="h-3" showScore />

// Large circular indicator
<AnomalyScoreIndicator score={78} compact={false} />
```

**`CrashReportPanel`**
```javascript
<CrashReportPanel
  report={latestReport}
  isLoading={loading}
  onRefresh={() => {}}
/>
```
- Shows root cause analysis
- Lists affected services
- Displays timeline
- Provides recommendations

**`RealtimeStream`**
```javascript
<RealtimeStream
  isEnabled={true}
  onNewAnomaly={(anomaly) => {}}
/>
```
- WebSocket connection status
- Auto-reconnect on disconnect
- Real-time updates as they come in

## 📝 Common Development Tasks

### Accessing Dashboard Data

The main dashboard state is in `app/page.js`:

```javascript
const [data, setData] = useState({
  health: null,
  status: null,
  anomalies: [],
  crashReport: null,
  error: null,
});
```

### Modifying Refresh Frequency

In `app/page.js`, find:
```javascript
const intervalId = setInterval(() => fetchDashboard(true), 5000); // 5 seconds
```

Change `5000` to desired milliseconds (e.g., `10000` for 10 seconds).

### Adding a New Filter

1. Add to initial state in `FilterControls`:
```javascript
const [filters, setFilters] = useState({
  // ... existing filters
  newFilter: '',
});
```

2. Add UI for it in FilterControls component
3. Apply logic in Dashboard's useEffect that filters anomalies

### Changing Color Scheme

Colors are defined in `lib/utils.js`:

```javascript
export function getAnomalyBadgeColor(score) {
  if (score < 25) return 'bg-green-100 text-green-800';  // Change here
  // ...
}
```

Also defined in `tailwind.config.js` custom colors:
```javascript
colors: {
  anomaly: {
    low: '#10b981',      // Low severity green
    medium: '#f59e0b',   // Medium yellow
    high: '#f97316',     // High orange
    critical: '#7f1d1d', // Critical dark red
  },
},
```

### Adding a New Page/Route

```javascript
// app/reports/page.js
'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    const fetchReports = async () => {
      const data = await api.getCrashReports(20);
      setReports(data);
    };
    fetchReports();
  }, []);

  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Crash Reports</h1>
      {/* Report components here */}
    </main>
  );
}
```

Then add navigation link in Header component.

## 🧪 Testing the Frontend

### Test Checklist

- [ ] **Backend Connection**: Page loads, header shows "Connected"
- [ ] **Stats Panel**: Shows non-zero counts (or 0 if no logs ingested yet)
- [ ] **Charts**: Render without console errors
- [ ] **Anomaly Feed**: Shows latest anomalies (if any)
- [ ] **Upload Modal**: Opens and closes cleanly
- [ ] **Filters**: Can filter by service, score range
- [ ] **Real-time Stream**: Shows connection status
- [ ] **Responsive**: Looks good on mobile/tablet/desktop

### Debug Mode

Enable detailed logging:

```env
NEXT_PUBLIC_DEBUG=true
```

Then check browser console for API calls and data.

### Common Issues & Solutions

**"Failed to load dashboard"**
- Check if backend is running
- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check browser console for CORS errors

**Charts not showing**
- Ensure anomaly data exists (upload logs first)
- Check if Recharts library loaded
- Look for JS errors in console

**WebSocket connection fails**
- Backend may not support it yet
- Check if backend has `/api/v1/stream/subscribe` endpoint
- Verify network tab shows WebSocket attempts

## 📚 File Reference

### Key Files Explained

| File | Purpose |
|------|---------|
| `app/page.js` | Main dashboard - state management, data fetching |
| `app/layout.js` | Root layout, metadata, HTML structure |
| `app/globals.css` | Tailwind CSS setup |
| `lib/api.js` | All backend API calls and WebSocket utilities |
| `lib/utils.js` | Helper functions (formatting, colors, data extraction) |
| `components/Header.js` | Top navigation bar |
| `components/StatsPanel.js` | KPI metric cards |
| `components/AnomalyFeed.js` | Main anomaly list |
| `components/AnomalyScore.js` | Score visualization (3 variants) |
| `components/Charts.js` | Recharts visualizations |
| `components/CrashReportPanel.js` | RCA and recommendations |
| `components/RealtimeStream.js` | WebSocket live stream |
| `components/LogUploadModal.js` | File upload dialog |
| `components/FilterControls.js` | Filter UI |
| `tailwind.config.js` | Tailwind configuration & custom colors |
| `package.json` | Dependencies & scripts |
| `.env.local` | Environment variables (create this) |

## 🚀 Next Steps

### Short Term
1. **Test with Real Backend** - Start backend, verify all data flows
2. **Customize Colors** - Match your branding in `tailwind.config.js`
3. **Add Your Logo** - Replace placeholder in Header
4. **Adjust Refresh Rates** - Fine-tune based on data volume

### Medium Term
1. **Add User Authentication** - Add login/logout flow
2. **Create Detail Pages** - Click anomaly to see full details
3. **Export Functionality** - Download anomalies as CSV
4. **Email Alerts** - Set up email notifications for critical anomalies

### Long Term
1. **Machine Learning Feedback Loop** - Let users rate ML predictions
2. **Custom Dashboards** - Allow users to create custom views
3. **Multi-tenancy** - Support multiple projects/services
4. **Advanced Analytics** - Predictive forecasting, trend analysis

## 🔧 Build & Deployment

### Development
```bash
npm run dev       # Start dev server on port 3000
```

### Production Build
```bash
npm run build     # Create optimized build
npm start         # Start production server
npm run lint      # Check code quality
```

### Docker Deployment
```bash
docker build -t log-whisperer-frontend .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_BASE_URL=http://api:8090 log-whisperer-frontend
```

### Vercel Deployment
```bash
# Push to GitHub, connect to Vercel dashboard
# Set env var: NEXT_PUBLIC_API_BASE_URL=https://your-api.com
# Deploy!
```

## 💡 Pro Tips

1. **Use React DevTools** - Browser extension for debugging component state
2. **Check Network Tab** - See actual API requests/responses
3. **Lighthouse Audit** - Check performance on production build
4. **Console Logs** - Add `console.log()` in components for debugging
5. **Component Reuse** - Build small, reusable components

## 📖 Documentation Files

- [Frontend README](./README.md) - Full documentation
- [../Backend Documentation](../backend/README.md) - Backend setup
- [Architecture Guide](../docs/ARCHITECTURE.md) - System design

## ❓ Need Help?

### Common Questions

**Q: How do I change the port?**
A: `npm run dev -- -p 5000` (for port 5000)

**Q: Where do API URLs come from?**
A: `lib/api.js` - Edit `API_BASE_URL` constant

**Q: Can I use this frontend with a different backend?**
A: Yes! Just ensure the backend implements the same API endpoints.

**Q: How do I add authentication?**
A: Create `components/AuthGuard.js` and wrap dashboard page with it

**Q: Can I host on a sub-path (e.g., /dashboard)?
**
A: Edit `next.config.mjs` and add `basePath: '/dashboard'`

## 🎉 You're Ready!

You now have a fully functional Log-Whisperer frontend. Start by:

1. ✅ Running `npm install`
2. ✅ Starting backend server
3. ✅ Running `npm run dev`
4. ✅ Opening http://localhost:3000
5. ✅ Uploading sample logs via the UI

Happy dashboarding! 🚀
