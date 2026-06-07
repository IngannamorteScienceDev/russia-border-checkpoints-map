# Russia Border Checkpoints Globe

[![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JS-orange)](#)
[![Globe](https://img.shields.io/badge/globe-CesiumJS-blueviolet)](https://cesium.com/platform/cesiumjs/)
[![Data](https://img.shields.io/badge/data-GeoJSON-yellow)](#)
[![Pipeline](https://img.shields.io/badge/data%20pipeline-Python-informational)](#)

CesiumJS application for exploring Russian Federation border checkpoints on a 3D globe.

The frontend is intentionally limited to features backed by real data or Cesium services: search, filters, camera presets, clustering, terrain-aware checkpoint analysis, visibility checks, OSM buildings, and shareable map state.

## Current Frontend

- Local CesiumJS runtime.
- High-definition default imagery for GitHub Pages via Esri World Imagery.
- OpenStreetMap and local Natural Earth fallback imagery modes.
- Loading and normalization of `data/checkpoints.geojson`.
- Runtime repair for mojibake strings in the source data.
- Checkpoint rendering through Cesium `CustomDataSource` and `Entity`.
- Cesium clustering for dense regions.
- Search by checkpoint name, ID, country, region, type, address, corridor, and foreign checkpoint.
- Filters by checkpoint type and status.
- Camera presets for overview, west, south, Siberia, and Far East.
- Coordinate-quality visualization mode.
- Cesium World Terrain with ellipsoid fallback and terrain-clamped checkpoint markers.
- Curvature-aware, terrain-sampled viewshed surface and line-of-sight links to nearby checkpoints.
- Terrain metrics in the inspector: selected height, local relief, nearest-checkpoint height delta, visible and blocked neighbors.
- Optional Cesium OSM Buildings layer loaded from the real 3D Tiles service.
- Camera-aware clustering: aggregate clusters from orbit, real points closer in, labels at close zoom.
- Inspector with quality, radius, nearest checkpoint, terrain analysis, and source data.
- Share URL generation for filters, imagery mode, radius, and selected checkpoint.
- Mobile-first bottom sheets for filters, regions, legend, and checkpoint details.

## Local Run

Use a local HTTP server. Opening the HTML file directly can block `fetch()` for GeoJSON.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Data

Main frontend dataset:

- `data/checkpoints.geojson`

Data pipeline files are still available:

- `raw_data/rosgranstroy_map_data.json`
- `data/dataset_changelog.json`
- `data/data_quality_report.json`
- `data/research_coverage_report.json`
- `data/checkpoint_enrichment.json`

Full pipeline:

```bash
python scripts/run_pipeline.py
```

The pipeline normalizes source records through a temporary JSON file. It no longer creates or consumes CSV files.

## Checks

```bash
npm run lint
npm run format:check
npm run test:frontend
python -m unittest discover -s tests -v
```

## Notes

The raw GeoJSON still preserves upstream text exactly. The frontend repairs mojibake at load time so the user interface stays readable without breaking dataset hashes and pipeline validation.

Real terrain and OSM buildings depend on Cesium ion and browser network access. A deployment can set `window.CESIUM_ION_TOKEN` before loading CesiumJS. If terrain is unavailable, the app keeps running on ellipsoid terrain and marks terrain-dependent analysis as degraded.

## License

Personal Use License. See `LICENSE`.
