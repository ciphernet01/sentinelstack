# SentinelStack UI Redesign v3

This pass is focused on the interaction and globe issues visible in the current UI while preserving the existing backend/data workflows.

## Replace these files

- `src/app/dashboard/layout.tsx`
- `src/app/globals.css`
- `src/components/dashboard/DashboardTopBar.tsx`
- `src/components/dashboard/Sidebar.tsx`
- `src/components/dashboard/redesigned/globe/SentinelGlobe.tsx`
- `src/components/dashboard/redesigned/globe/shaders/earth.vert`
- `src/components/dashboard/redesigned/globe/shaders/earth.frag`
- `src/components/chat/ChatWidget.tsx`
- `public/data/world-countries.json`

The existing `public/branding/sentinel-globe-world-mask.png` remains required.

## Behavior changes

- The SentinelStack logo is fixed in the top navigation and no longer belongs to the collapsible sidebar.
- Search and profile controls are removed from the top navigation.
- The navigation opens from the top-bar menu button rather than opening on hover.
- Opening navigation changes the flex layout width, so the application content shifts smoothly to the right instead of being overlaid.
- The globe uses manual group rotation instead of camera OrbitControls. Zoom and pan remain unavailable.
- Globe auto-rotation pauses while dragging and resumes smoothly after release.
- Country boundaries are rendered from a bundled local geography dataset.
- Hovering the globe resolves the geographic point to a country and displays country name, ISO code, region, capital, and mapped SentinelStack overlay-node count.
- The country tooltip explicitly avoids making country-level cyber-risk or attack claims because the current SentinelStack backend does not provide that geographic telemetry.
- Earth points are denser/brighter.
- Network arcs have a soft outer glow plus a brighter core.
- The assistant launcher is now a compact bot icon rather than a transparent text pill.

## Data provenance

`public/data/world-countries.json` is a locally bundled, simplified country-geometry dataset derived from the Python `countryinfo` package's Natural Earth-derived GeoJSON data. It is used only for geographic context and hover interaction; it does not create SentinelStack risk findings or attack telemetry.

## Dependencies

No new dependency is required by this v3 pass. Keep the React 18-compatible Three stack already installed:

- `@react-three/fiber@8.18.0`
- `@react-three/drei@9.122.0`
- `three@0.180.0`
