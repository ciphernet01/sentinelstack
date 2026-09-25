# SentinelStack UI Redesign — Replacement Files

This package contains the frontend files implemented from `plan.md`.

## What was changed

- Replaced the dashboard presentation with the cyber command-center layout.
- Preserved the existing dashboard API and cyber-risk API as data sources.
- Preserved the original SentinelStack logo.
- Reworked the desktop sidebar into a compact icon-first navigation.
- Added a responsive top command bar and mobile navigation.
- Added a custom React Three Fiber / Three.js point-cloud Earth.
- Added custom Earth and atmosphere shaders.
- Added decorative network arcs/nodes/particles.
- Added the generated world-land mask.
- Added cyber-styled risk, findings, financial-risk, risk-driver and assessment panels.
- Kept backend, database, API contracts, assessment logic, risk calculations and other routes untouched.

## Replacement

Copy the contents of this package into the repository root, preserving the directory structure.

The main replacement files are:

```text
package.json
src/app/dashboard/page.tsx
src/app/dashboard/layout.tsx
src/app/globals.css
src/components/dashboard/Sidebar.tsx
src/components/dashboard/DashboardTopBar.tsx
src/components/dashboard/redesigned/DashboardCommandCenter.tsx
src/components/dashboard/redesigned/ui/CyberPanel.tsx
src/components/dashboard/redesigned/globe/SentinelGlobe.tsx
src/components/dashboard/redesigned/globe/utils/latLngToVector3.ts
src/components/dashboard/redesigned/globe/utils/createEarthPoints.ts
src/components/dashboard/redesigned/globe/shaders/index.ts
src/components/dashboard/redesigned/globe/shaders/*.vert
src/components/dashboard/redesigned/globe/shaders/*.frag
public/branding/sentinel-globe-world-mask.png
```

## Dependencies

The redesign adds:

```bash
npm install three @react-three/fiber @react-three/drei
```

The supplied `package.json` already declares these dependencies.

Because the implementation environment could not complete a network dependency installation, the repository's existing `package-lock.json` was intentionally not rewritten. Run `npm install` after replacing the files so npm resolves and records the new dependencies.

Do not run `npm ci` before refreshing the lockfile.

## Important

Do not copy these files over an unrelated branch without first committing or backing up your current work.

No backend files or Prisma files are part of this UI redesign.

## Validation performed here

The newly created TypeScript/TSX source files were syntax-transpiled successfully with TypeScript's parser.

A full Next.js production build was not executed because the uploaded repository did not contain `node_modules` and the environment could not complete the network dependency installation.

## Globe behavior

The new globe intentionally does not use Globe.GL.

It uses:

```text
React Three Fiber
Three.js
custom BufferGeometry
custom GLSL shaders
world-land mask
atmosphere Fresnel effect
3D network curves
decorative nodes
traveling particles
OrbitControls with zoom/pan disabled
```

The network is decorative and is not presented as live attack geography.

## Existing functionality

The redesigned dashboard reads the existing:

```text
/dashboard/summary
/dashboard/analytics?days=30
/cyber-risk/enterprise
/admin/scan-queue
```

endpoints.

No new backend endpoint is required for the redesign.
