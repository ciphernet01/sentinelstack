# SentinelStack UI Redesign v4

This patch is a frontend-only correction pass on top of v3.

## Fixed
- Removed DOM `<div>` from inside the React Three Fiber `<Canvas>`; the previous v3 runtime error `R3F: Div is not part of the THREE namespace` is eliminated by rendering the country tooltip outside Canvas.
- Sidebar is now an absolute navigation panel that translates in/out while the main application translates right. The main content width does not change during sidebar opening, so the globe does not shrink/reflow.
- Increased Earth point density (sample step 2), brightness and point size.
- Increased country-border visibility.
- Increased network arc thickness and glow with a brighter core plus outer glow.
- Removed the explanatory globe text and interaction hint for a cleaner command-center presentation.
- Country hover tooltip remains outside Canvas and uses the local `public/data/world-countries.json` dataset.
- Country hover still highlights the country geometry and reports country context plus mapped SentinelStack nodes.

## Install
Replace the corresponding files from this archive in the existing repository. No new dependencies are required beyond the React 18-compatible R3F stack already installed:

- `@react-three/fiber@8.18.0`
- `@react-three/drei@9.122.0`
- `three@0.180.0`

Then restart the frontend:

```bash
npm run dev:frontend
```

Hard-refresh the browser with `Cmd+Shift+R` on macOS or `Ctrl+Shift+R` on Windows/Linux.

Do not run `npm audit fix --force` as part of this UI patch.
