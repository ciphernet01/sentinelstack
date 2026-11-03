# SentinelStack UI Redesign v4 — bright and dark security platform

SentinelStack is an enterprise security assessment platform with a responsive command center, audit-ready reporting, and a consistent day/night interface across public and authenticated experiences.

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

## Bright and dark theme system

SentinelStack now provides a consistent day/night experience across the landing page, authentication flows, pricing, legal, and Trust Center pages.

- Theme selection persists across routes with `next-themes`.
- Landing, login, signup, password recovery, verification, pricing, privacy, and terms pages share the same visual language.
- Logos, navigation controls, forms, cards, buttons, notices, tables, and CTA sections adapt to the active theme.
- The pricing CTA uses a readable navy/cyan palette in night mode and a bright blue/indigo palette in day mode.
- Globe materials and public navigation controls update when the theme changes.

## Verification

The frontend build and lint checks pass. Browser smoke checks cover the day/night toggle on the landing page, authentication pages, pricing, privacy, and terms routes.

## UI/UX credit

UI/UX design and implementation: [@xo-satyam](https://github.com/xo-satyam).
