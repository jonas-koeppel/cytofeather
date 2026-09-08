# Cytofeather

Cytofeather is a lightweight browser app for exploring flow cytometry data. It runs as a static HTML app, keeps analysis local in the browser, and focuses on fast visual gating, sample comparison, and polished exports.

[Open Cytofeather](https://jonas-koeppel.github.io/flowfeather/) · [Report an issue](https://github.com/jonas-koeppel/flowfeather/issues)

For a quick first look, click **Example Data**, draw a rectangle gate around a population, then try **Scatter (Grid)** or **Histogram (Overlay)**. A **Quick guide** is available below the gate hierarchy.

## Features

- Import `.fcs` and `.csv` files, including drag-and-drop loading into the empty plot workspace or Files panel.
- Apply reversible manual fluorescence compensation with a detector-aware spillover matrix.
- View samples as scatter overlays, scatter grids, histogram overlays, and histogram offsets, with overlay histograms normalized by peak or shown as event counts.
- Draw rectangle, ellipse, polygon, and histogram segment gates.
- Build hierarchical populations, including sample-specific gates and apply-to-sample or apply-to-all workflows.
- Move and edit gates, labels, axes, sample colors, and grid column layout interactively.
- Export publication-style plots as PDF or PNG.
- Export gated populations and configurable statistics as CSV.
- Save and reload workspace JSON files with samples, axes, gates, and view state.
- Use light or dark mode, with matching plot/export options.

## Getting Started

Cytofeather has no build step. Serve the folder with any local static server:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765
```

You can also open `index.html` directly in a browser for basic local file loading. The bundled example data works best through a local server because browsers restrict some file access from `file://` pages.

PDF export uses a bundled copy of jsPDF. Imported-file analysis and all exports work without an external CDN. When self-hosting, include the `vendor/` and `example_data/` folders alongside `index.html`.

## Data Formats

### FCS

Cytofeather reads list-mode (`$MODE=L`) numeric FCS files: 32-bit floats, 64-bit doubles, and byte-aligned unsigned integers up to JavaScript’s exact integer limit. It supports common little- and big-endian layouts, validates segment lengths, and rejects unsupported histogram modes or truncated data. Duplicate stain names are disambiguated using detector names so channels remain independently selectable.

Only the first dataset is loaded from multi-dataset files. Values are read as stored; acquisition gain and logarithmic amplifier metadata are not converted automatically, and embedded spillover matrices are not automatically applied. Use the manual compensation editor when appropriate.

### CSV

CSV files use the first row for unique, nonempty parameter names. Quoted commas, escaped quotes, line breaks, and UTF-8 byte-order marks are supported. Text-only annotation columns are ignored. Numeric columns may contain blank values, which remain missing and are excluded from parameter statistics. Mixed numeric/text values and inconsistent row lengths produce an error instead of silently dropping events.

Population CSV exports align channels by name across samples; missing channels produce blank cells.

## Basic Workflow

1. Add one or more `.fcs` or `.csv` files.
2. Choose X/Y parameters and a plot type.
3. Open **Compensation** in the Data panel if the acquisition needs spillover correction.
4. Adjust linear/log scales and axis ranges as needed.
5. Draw gates from the Gates panel.
6. Double-click a gate in the plot or hierarchy to select that population.
7. Use exports for figures, statistics, or event-level population data.
8. Save a workspace JSON if you want to return to the session later.

**Sessions are not automatically saved.** Save before closing or reloading the page. Workspaces contain raw sample data, gates, compensation, the selected plot/population, axis settings, styles, and theme. Treat workspace files with the same care as the original samples. Invalid workspace files are validated before replacing the current session; older unversioned workspaces remain supported.

## Compensation

The Compensation control stays collapsed in the Data panel until needed. Open it, select two or more fluorescence detectors, and enter spillover percentages. Rows are source channels and columns are the detectors in which that source signal was measured; diagonal values remain fixed at 100%.

Applying the matrix updates plots, gates, statistics, and exports. Raw event values are retained in memory, so compensation can be edited or disabled without reloading files. The raw values and compensation settings are also stored safely in workspace files, preventing double compensation when a workspace is reopened.

`compensation_test_data/` contains a small public set of unstained and singly stained FCS controls for exercising this workflow.

## Gates

Top-level gates are drawn on All Events. Gates drawn while another population is selected become children of that population and only display when that parent population is active. In grid and offset views, gates can become sample-specific so individual samples can be adjusted independently.

Right-click a gate to apply it to a sample or all samples. Sample-specific gates are marked in the hierarchy with the sample color.

## Exports

The Export menu includes:

- Image (PDF)
- Image (PNG)
- Gating strategy (PDF)
- Statistics (CSV)
- Population (CSV)

PNG exports include the current theme background so shared images stay legible. PDF export includes options for size, gates, sample labels, percent labels, all-events plotting, custom axis labels, and light/dark background. Statistics export lets you choose gates, parameters, and metrics such as events, mean, median, standard deviation, percent parent, and percent total.

Gating strategy export follows the gate hierarchy, with sibling gates on the same axes grouped into one panel. Choose overlaid samples or a grid with one row per sample, a density palette, and the number of panels per page. Each panel shows its parent population, gate outlines, and percentages of parent.

Use the Pseudocolor toggle below a scatter plot to enable density dots in overlay or grid mode. Right-click the plot to choose a palette and adjust styling. Overlay density is calculated across all visible samples. Palettes include Classic (blue/cyan/green/yellow/red), Viridis, and Plasma. Use the gate hierarchy disclosure arrows to collapse branches and the gate icon to view a population.

## Privacy

Imported data is processed in the browser. Cytofeather does not upload samples to a server, run analytics, or load third-party scripts. Opening the hosted app and loading its bundled examples makes ordinary requests to the static host. PDF generation uses the local `vendor/` library.

## Current scope

- Desktop browsers with a mouse or trackpad are the primary gating experience. The interface adapts to smaller screens; touch-only gate drawing is not implemented.
- Axis transforms are linear or logarithmic; biexponential/logicle transforms and spectral unmixing are not implemented. Use linear axes to inspect negative compensated values.
- Histograms are smoothed for display; use statistics or population CSV exports for numerical event counts.
- Large files, many samples, and all-event vector PDF exports can take time and browser memory. Workspaces embed event data and can be substantially larger than FCS files.
- This is an exploratory analysis tool. Check important analyses against known controls and your established workflow.

## Development

The app is currently implemented as a static single-page app:

- `index.html` contains the UI, plotting, parsers, gates, and export logic.
- `cytofeather-icon.svg` is the shared header and favicon artwork; PNG versions support browser fallbacks and home-screen icons.
- `example_data/` contains bundled example FCS files.
- `compensation_test_data/` contains openly licensed compensation control files and source notes.

Because there is no build step, refreshing the browser is enough after editing `index.html`.

Run the dependency-free regression checks with Node.js 22 or later:

```bash
node --test tests/*.test.cjs
```

The tests exercise the production parser, compensation, export, workspace, density, and gating strategy functions, including all nine bundled FCS files and real PDF generation.

## License

This project is open source under the MIT License. See [LICENSE.md](LICENSE.md). Bundled dependencies and datasets retain their respective licenses; see [vendor/README.md](vendor/README.md) and [compensation control provenance](compensation_test_data/README.md).
