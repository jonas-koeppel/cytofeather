# Cytofeather project guidance

Read README.md for usage and architecture, and HANDOFF.md for the migration snapshot and recent work. The current user's request takes precedence over these notes.

- This is a static, browser-only flow cytometry app. Most code lives in index.html; jsPDF is bundled in vendor/. There is no build step or package installation required for the app.
- Preserve local data processing, reversible compensation, workspace compatibility, and the compact interface. Avoid adding a backend, external scripts, or a framework unless requested.
- Inspect git status and the existing diff before editing. Preserve uncommitted work; do not assume the remote contains the latest implementation.
- Run `node --test tests/*.test.cjs` with Node.js 22+ after logic changes. Tests extract production functions from index.html; update their extraction lists when adding helper dependencies. For UI or export layout changes, also inspect the affected browser view or rendered export.
- Preview from the project root with `python3 -m http.server 8765 --bind 127.0.0.1`. Use a fresh testing session and bundled/synthetic data rather than resetting a user's active analysis.
- Gate membership, raw versus compensated values, missing values, and workspace round trips are important correctness boundaries. Keep plots, gate statistics, and exported values consistent.
- Use portable paths. Previous machine-specific runtime locations and temporary test files are not project dependencies.
