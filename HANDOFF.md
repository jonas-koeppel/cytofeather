# Cytofeather migration handoff

Snapshot: 2026-09-29. This describes local work at migration preparation time, not a guarantee about the deployed website. Recheck the current files and Git state before acting.

## Moving the project

1. Copy the entire current folder, including hidden `.git` and `.github` folders, tests, vendor libraries, icons, and bundled datasets. A fresh clone alone will not include uncommitted files or commits that have not been pushed.
2. Save any open Cytofeather analysis with **Workspace > Save Workspace**. Copy those JSON files and any separately stored source data too. Browser sessions are not automatically saved in the project folder.
3. Open the copied folder as the project in the new Codex installation/account. Project files do not include the old chat history, account settings, tool connections, or machine credentials. This document preserves the relevant project context.
4. Use a browser to run the app. Python 3 is convenient for the optional local server; Node.js 22+ is needed for the regression checks, not for ordinary app use. No npm install is required.
5. Run `node --test tests/*.test.cjs`, launch `python3 -m http.server 8765 --bind 127.0.0.1`, and open http://127.0.0.1:8765. Try Example Data and reload a saved workspace.
6. Set up GitHub authentication separately if you want to push from the new computer. Do not assume copying the repository transfers SSH credentials.

Suggested first message to the new session:

> Read AGENTS.md, README.md, and HANDOFF.md. Inspect the current Git diff and run the regression tests. Summarize the project state before making changes.

## Repository snapshot

- Product name: Cytofeather; the local folder is named `flow` but can be renamed.
- Origin: `git@github.com:jonas-koeppel/cytofeather.git`.
- Branch at preparation: `main`; latest observed HEAD: `b5c0e8d` (`small changes`), following `2a71053` (`added sample groups`).
- README.md, index.html, tests/core.test.cjs, and tests/plot-features.test.cjs were modified at the first inspection but became clean during preparation when HEAD advanced. At the final check, only the new AGENTS.md and HANDOFF.md were untracked. Copy these notes too, or include them in a subsequent commit.
- This assistant did not commit or deploy the latest feature tasks. A new local commit appeared during migration preparation; whether it has been pushed or deployed was not verified. Check the actual diff and remote before publishing.
- README's top links still use an older `flowfeather` repository/site name. Treat the actual Git remote as the current repository reference; verify hosting settings before updating public URLs.

## Architecture and behavior to preserve

- `index.html`: UI, application state, FCS/CSV parsing, compensation, canvas plotting, gating, workspace persistence, CSV/PDF/PNG exports.
- `vendor/`: bundled jsPDF and its license. `example_data/` and `compensation_test_data/`: bundled FCS datasets and provenance notes.
- `tests/core.test.cjs` and `tests/plot-features.test.cjs`: dependency-free Node tests, including production-function extraction and real PDF generation. GitHub Actions runs them with Node 22.
- Event values are retained as raw data; compensation derives current values without destroying originals. Workspace JSON persists the data and settings needed to reconstruct an analysis.
- All calculations run locally in the browser. Sessions require explicit workspace saves. No backend or OpenAI API key is needed by the app.

## Recent completed work

- Polygon vertex insertion/removal, large-file import choices, and compensation preview.
- Sample groups with customizable colors, distinct defaults, overlapping membership dots, independent copied gate branches, and workspace persistence.
- Gate percentage cache uses all checked samples so switching group views does not lose other groups' percentages.
- CSV exports skip sample/gate combinations that do not apply, expose group/population choices, and identify memberships and gate paths.
- Gating strategy PDF overlays use one row per sample group plus a row for shared gates. Individual sample rows contain only applicable gates, packed across columns.
- Histogram segment gate PDF fills and lines are clipped to the plot rectangle when bounds extend past the visible axis range (`drawHistGatesPDF`).
- **Custom axes** link in the Axes section opens an arithmetic editor: name a calculation, choose two original parameters, and select +, -, *, or /. Derived parameters work in axis menus, gates, statistics, and exports and persist in workspaces.

Custom axis implementation: `validateCustomAxes`, `applyCustomAxes`, and `refreshCustomAxesEditor`. Values are materialized as extra per-sample columns, tracked by `customAxisNames`, and rebuilt after compensation changes, imports, and workspace restoration. Missing inputs, zero denominators, and non-finite results produce NaN. Derived axes cannot currently reference other derived axes; the editor offers creation and deletion, not expression editing. Gates using an axis must be deleted before that axis can be removed.

## Validation and remaining context

- Last feature-task validation: all 38 tests passed on 2026-09-26; a ratio axis was created and plotted using bundled example data in the browser. The clipping regression verifies that PDF gate drawing occurs inside a clipping region.
- No unfinished feature request was left from those tasks. Migration preparation only adds documentation; rerun tests on the destination to verify its setup.
- Prior temporary fixtures, screenshots, local preview tabs, and runtime paths are disposable and are not required to continue development.
- A separate Seurat/pseudobulk question appeared in the old chat; it did not result in changes to this app and is not part of its feature scope.

## Integration update — 2026-10-29

The single-plot app now includes linked quadrant gates (Q), independently tiltable dividers, 100-step undo/redo, resizable sidebars, and binary `.cytofeather` read/write alongside JSON. Custom arithmetic axes and the histogram PDF clipping fix are retained. No multi-plot UI, control overlays, or gating-template workflow has been imported.

Quadrant geometry uses saved linear/log coordinates and fixed transformed spans; four populations share their centre/divider angles. Sample/group application and deletion operate on the set. Older V2 readers do not interpret tilt metadata. A V2 multi-plot workspace opens using its saved active plot and is subsequently saved as one plot.

History retains raw columns by reference and rebuilds compensation/custom axes on restoration. Loading a workspace resets history. Sidebar widths are local browser preferences. Workspace files are validated before installation; binary files use V2's `CYTOFWS1` header and raw Float32/Float64 columns.

Validation: regression suite expanded with quadrant partition/CSV/export checks, binary and JSON round trips, compensation/custom axes, linked copies, and history. The supplied V2 test workspace (82 samples, six groups, 21 gates, 149,978 events) also passed a read/write/read check. Browser checks used bundled examples in a fresh session to exercise creation, both divider tilts, centre movement, undo/redo back to an empty analysis, and sidebar drag/persistence/reset. Changes are local; no commit or deployment was made.


## Statistics tiles update — 2026-10-30

A cogwheel beside Stats opens a three-slot editor using the CSV export metrics. Custom selections start empty, preserving the original events / % total / % parent tiles. Users choose a metric and, for mean/median/SD, a parameter. Pooled and per-sample modes follow the current population and samples in view. Pooled intensity statistics operate on events rather than averages of sample statistics; missing/non-finite values are excluded, compensation and custom axes are respected, and values use CSV's three significant figures.

`statsSettings` is validated and persisted in JSON/binary workspaces and undo history; absent settings restore legacy defaults. `collectPanelStatistics` computes the records, and `updateStats` renders them with safe text nodes. A cache is invalidated by `markGatePercentDirty`, population/view changes, and configuration changes, so ordinary hover/style renders do not sort unchanged parameter values again. Per-sample rows retain sample colors and full-name tooltips. Draft edits, cancel, reset, and required-parameter validation are handled by the existing accessible modal workflow.

The Stats heading also names the active population (including group and ancestor path, with a full-name tooltip). Its download arrow writes only the displayed three metrics in tile order to `displayed-statistics.csv`, preserving pooled/per-sample scope and population metadata. `currentPanelStatistics` shares the same cached records between display and download; `panelStatisticRawValue` supplies consistent numeric CSV and formatted tile values. Repeated metric headers are disambiguated; labels are CSV-escaped. The shortcut is disabled without sample events in view.

Validation expanded to 60 passing tests, covering event-weighted pooling, nested/group/sample gates, agreement with CSV, empty/missing values, compensation/custom axes, configuration validation, legacy defaults, both workspace formats, undo/redo, exact displayed CSV selections/order, population context, visibility changes, escaping, and duplicate columns. Browser checks used bundled examples in a separate preview session to verify the empty-state button, selected-gate label, per-sample custom tiles, and download shortcut. Changes remain local.

## Interaction performance update — 2026-10-31

The single plot now schedules screen redraws with one `requestAnimationFrame` and keeps its event/axes/sample-caption layer in an offscreen canvas. Scatter, grid scatter, histogram overlay, and histogram offset have separate data and live-overlay phases. `plotDataKey` tracks current columns by weak object identity, population ancestry/scope, sample visibility/order/names/colors, group memberships, axes, style, theme, and canvas size/DPR. Gate geometry outside the plotted population and label movement do not invalidate event drawing. Ghost drawing is part of the scheduled frame. Exports remain synchronous and bypass the screen cache, with render flags restored even on failure.

During gate movement/resizing/rotation/quad tilt, full percentage and tile recalculation is deferred. A gesture-local preview evaluates at most 25,000 evenly spaced candidate events through the unchanged parent and retains those points while geometry moves. Compiled geometry tests preserve ellipse/polygon log coordinates and tilted quadrant boundary ownership. Edited labels show approximate percentages; other labels and the Stats tiles retain their last exact values, with a release notice and disabled tile-download shortcut. `finishGateInteraction` clears previews and requests exact refresh on mouse release or window blur. A data layer whose population depends on the edited gate is held with an update notice until release.

This does not add V2's general membership-mask cache, chunked background recomputation, compact FCS reader, multi-plot UI, or altered scatter drawing budgets. Exact release calculations still run synchronously and may pause for a large analysis. Workspaces/history persist analysis state only; these rendering caches are transient.

Validation: all 71 tests pass. `tests/rendering.test.cjs` covers redraw coalescing/latest-state handling, cached event reuse across all four plot types and pseudocolor, exact release and image exports, compensation/workspace column replacement, ancestry/scope/appearance invalidation, bounded previews, sample/group/missing-value handling, tilted/log geometry, linked quadrant estimates, quick release, and export-failure cleanup. Browser checks use bundled examples in a separate preview and cover rectangle movement, quadrant tilt, grid rendering, histogram offset segment editing, and histogram overlays. Changes remain local.
