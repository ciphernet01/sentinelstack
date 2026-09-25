# SentinelStack UI Redesign v2 — professional dark command center

Replace the files in this archive at the same paths in the SentinelStack repo.

Changes:
- Dark SentinelStack palette applied consistently through the shadcn CSS tokens.
- Removed decorative/unused dashboard header controls; Search and account menu remain functional.
- Sidebar expands as an overlay, so dashboard content and the WebGL globe no longer resize/reflow on hover.
- Added stable transitions for width, padding, opacity and interactive state changes.
- Globe world-mask loading is explicit and resilient; it no longer depends on repeated interaction to appear.
- Globe keeps zoom/pan disabled and drag rotation/auto-rotation enabled.
- Settings cards/tabs now use the same dark cyan visual system.
- Fixed several dashboard sub-pages with hard-coded light UI colors.
- Preserved backend APIs, data fetching and existing workflows.
