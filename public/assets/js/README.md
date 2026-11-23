# Frontend script order

`public/index.html` loads these as classic scripts in the order below. Keep that order: later files use globals and functions initialized earlier.

1. `application-core.js` — app state, modules, and core UI
2. `theme-and-status.js` — theme defaults and header status
3. `progression-ui.js` — stage and progress UI
4. `cinematic-intro.js` — intro copy and timing
5. `dashboard-cards.js` — dashboard card interactions
6. `navigation-shortcuts.js` — keyboard and navigation shortcuts
7. `navigation-layout.js` — navigation and layout helpers
8. `data-studio.js` — import and data studio interfaces
9. `cdr-ingestion.js` — CSV parsing, mapping, and persistence
10. `region-resolver.js` — location and region helpers
11. `map-diagnostics.js` — map diagnostics and fallback UI
12. `pointer-effects.js` — pointer animation effects
13. `intro-animation.js` — intro canvas animation
14. `devi.js` — in-app guide
15. `login.js` — Supabase login and session integration
16. `superadmin.js` — user administration UI
17. `recording.js` — audit and recording helpers
18. `recording-editor.js` — local file and backup controls
