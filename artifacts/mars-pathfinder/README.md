# Mars Surface Analysis & Path Finder

## Complete project documentation

See [the project guide](docs/PROJECT_GUIDE.md) for Windows PowerShell installation and startup, runtime data, interface usage, exact DF/category equations, route objectives, traveler placement, event closures/residuals, API examples, troubleshooting and developer checks. Word and PDF copies can be regenerated using `python artifacts/mars-pathfinder/docs/export_guide.py` when python-docx and ReportLab are installed; Python is not required to run the app.

## Approved scientific scope

The user requested an explicit experimental per-cell risk formula and safety function using existing data. This is not an operational Mars navigation system. Unknown physical measurements and traversability remain unknown. Experimental routes assume covered cells can be crossed; that is an explicit scenario policy, not measured traversability. Scientifically validated routing is still unavailable.

## Experimental risk model

`sim3292-proxy-1`: `R = 45T + 35M + 20U`, `modelSafetyScore = 100 − R`, `DF = 1 + R/100`.

These dimensionless category scores and weights are analyst-selected assumptions, not NASA recommendations, probabilities, calibrated mission risks or scientifically established terrain rankings. Their rationale is qualitative mobility context, not a quantitative empirical justification. Full executable category rules, first-match order, spatial policy and references are exposed by the summary API and rendered in Methods & limits from the same definitions.

Terrain association uses the maximum category of geology polygons covering a cell midpoint. Structure association uses the maximum category of exact mapped structures intersecting the full cell rectangle, not a proximity threshold. Seven missing categories always contribute U=7/8; missing geology adds the eighth. Missing geology also excludes a cell from routing by data policy, not by asserting a physical obstacle. No mapped structure contributes M=0 but does not establish absence of local hazards.

Original BFS/Dijkstra/A* and original ComputeDF are unchanged. The new adapter directly supplies DF and inverse model scores; it does not call the unvalidated original ComputeDF or random generator. Dijkstra/A* optimize entered-cell step-plus-proxy-risk cost, not pure raw risk or kilometers. Endpoints snap to cell centers, and grid changes affect results. Route distance is a separately derived Mars-sphere center-to-center distance, excluding the offset from clicked locations to snapped centers.

## Architecture

- React/Vite and OpenLayers frontend, with an explicitly registered Mars spherical longitude/latitude projection. No terrestrial basemap.
- C# ASP.NET Core 9 API in `backend`, with controllers, a source/spatial-query service and an isolated algorithm fixture service.
- `backend/Prototype` contains byte-identical Business and Models files extracted from the uploaded backend. The original random generator and unvalidated ComputeDF formula are retained for reference, not used to populate scientific cells.
- OpenAPI contract: `lib/api-spec/openapi.yaml`. Client hooks are generated, not handwritten.
- No user database or accounts are required. This is a read-only scientific-source snapshot plus transient calculations.

## Scientific transformations

Run `research/prepare_mars_map.py` from the workspace root. A compatible native Expat library may need to be preloaded; consult the project's native XML compatibility guidance.

Four geographic SIM3292 shapefiles are decoded using GDAL. Display geometry is simplified with a topology-preserving **0.025-degree tolerance**; this is an engineering display choice, not a measured hazard threshold. All features and attributes are retained. Ninety-two contact features have null source geometry and cannot be drawn.

Full unsimplified geology and structure WKB are stored separately and indexed using NetTopologySuite. Boundary points can return multiple units. Geology membership is based on the midpoint, not an area-weighted cell aggregate or a claim that the entire cell is homogeneous.

The hillshade image is reprojected from its declared Robinson CRS to Mars-sphere geographic coordinates (radius **3,396,190 m**), bilinearly resampled to 1800×900 pixels. It is intensity, not elevation or slope.

Originals are unchanged. The 19 additional layers/tables remain catalogued with links to the source explorer; projected duplicates and annotation layers are not silently joined into the rendered map. The map-footprint ellipsoid and unresolved polar raster CRS are not assumed identical to the main spherical CRS.

## Original algorithm behavior

BFS minimizes grid steps. Dijkstra and A* minimize entered-cell DF excluding the start. A* uses Manhattan distance times minimum unblocked DF. Four-neighbor order is row−1, col+1, row+1, col−1. Weighted priority ties use cost, row, column. Equal-cost relaxations do not replace parents. No diagonal or antimeridian wrapping was introduced.

Lab fixtures are synthetic and have no geographic position. Weighted fixture: BFS yields 7 path cells and cost 101; Dijkstra and A* each yield 9 path cells and cost 8. Path-cell count is not the number of expanded nodes.

## Verification

`dotnet run --project artifacts/mars-pathfinder/tests/Mars.Checks.csproj`

Checks weighted, tied, zero-cost, unreachable and start=destination fixtures, costs, neighbors and blocked/negative input handling. The imported 11 prototype source files were also compared byte-for-byte with the uploaded ZIP. Frontend typecheck and live API requests verified layer counts, source inspection, null scientific inputs and unavailable routing.

## Manual areas and simulated hazard events

Use **Select area on map**, then click/tap two opposite corners. The rectangle fills the numeric geographic bounds; rows and columns remain independently editable. Click **Generate grid**, set start/end inside it, then calculate a route. Selection is rectangular in Mars spherical degrees, not a drawn obstacle polygon, and cannot wrap the longitude seam. Changed bounds/resolution invalidate the current grid and scenario.

**Random event on current path** chooses an eligible entered path cell (not the uncharged start) uniformly, then chooses one unsaturated terrain or structure factor uniformly. The normalized factor increment is:

```
δ ~ Uniform[min(0.05, 1 − f_origin), min(0.25, 1 − f_origin)]
f_origin_new = f_origin + δ

A = r² × Δλ × |sin(φN) − sin(φS)|  [km²; angles in radians; r = 3396.190 km]
δ_neighbor = min(1 − f_neighbor, δ × 0.5 / (1 + A / 10000) / sqrt(dr² + dc²))
ΔDF = factor_weight × δ_factor / 100
```

Only the same factor in at most eight immediate covered neighbors changes; there is no further propagation. Each neighbor uses its own spherical area, so larger cells produce smaller increments. Saturated factors do not increase. Missing-geology neighbors are skipped. The strict inequality is **added** neighbor danger < added origin danger, not an ordering of their total pre-existing DF. Weights, uncertainty penalty, source evidence and unknown physical traversability are unchanged. Values remain in [0,1] and DF in [1,2].

The interval 0.05–0.25, attenuation 0.5 and reference area 10,000 km² are analyst-selected scenario parameters, **not empirically calibrated realistic Mars hazard ranges**. Source data do not provide such a calibration. Worked example: δ=0.2 and A=10,000 km² gives orthogonal δ=0.05, diagonal δ≈0.035355; terrain weight45 gives origin ΔDF=0.09 and orthogonal ΔDF=0.0225.

Every event origin is a **forbidden scenario cell** until Reset, including all earlier event origins. The unchanged BFS, Dijkstra and A* receive this closure through their existing blocked-cell mask. It is an operational simulation rule, not a measured physical obstacle. Residual neighbors remain passable with the existing increased DF: weighted Dijkstra/A* penalize them, while BFS minimizes moves and ignores DF. Weighted routing may still use a residual cell when avoiding it would cost more overall; there is no absolute neighbor-avoidance guarantee.

The historical old path remains dashed amber for comparison and is now infeasible; the valid new path is solid blue and cannot enter any forbidden origin. If the event closes B or disconnects the allowed grid, the app reports no route rather than drawing an unsafe fallback. The cost panel marks the previous path as forbidden/unavailable after the event instead of presenting its finite DF sum as a feasible alternative. Source evidence and unknown physical measurements remain unchanged.

### Traveler position and endpoint display

Before triggering an event, optionally select the traveler/vehicle's current waypoint on the active route. Selection is snapped to an existing modeled cell center; it is not a continuous GPS or sub-cell location. Selection alone does not trigger an event. The next event is sampled on the remaining entered route cells ahead of that position, then rerouting runs from the traveler to B. The old-route comparison uses the exact remaining suffix, not completed travel. Costs exclude the current starting cell, as in the unchanged algorithms. The destination cannot be used as a traveler position because no remaining journey exists.

The event API accepts optional `travelerPathIndex` (zero-based index on the route reconstructed from the request's origin and current event history). The server validates that index before sampling, and rejects negative, destination or off-path indices. After movement, subsequent event requests must retain the moved origin along with event history; omitting a new position does not teleport the traveler back to A. Reset restores the original A-to-B baseline. With no position ever selected, behavior remains unchanged.

Exact A/B click markers connect to the center-to-center route using separately styled dashed, schematic within-cell links. These links fix the visual endpoint mismatch without changing grid nodes, prototype algorithms, route costs or reported center-to-center distance. No sub-cell topography or traversability is inferred from these display links.

Events accumulate up to 50, with an event seed and explicit replayable increments returned by `POST /mars-pathfinder/api/mars/event`. `POST /route` accepts the same optional event history. The server re-derives a source grid then replays increments rather than accepting arbitrary replacements for measured/source values. Scenarios live only in page memory: Reset restores the baseline grid and original route; changing endpoints, algorithm or bounds clears the scenario, and reload discards it.

Additional checks:

```
python artifacts/mars-pathfinder/tests/scenario_api_checks.py
pnpm --filter @workspace/scripts exec tsx --test ../artifacts/mars-pathfinder/src/lib/scenario.test.ts
```

The Python checks require the managed preview API to be running. `MARS_TEST_BASE_URL` can select another API base for developer checks. They exercise deterministic events, cumulative replay, costs, bounds, residual equations, and rejected requests. These checks do not validate real-world mission safety.

## Run and persistence

Use the managed `artifacts/mars-pathfinder: web` and `artifacts/mars-pathfinder: Mars API` workflows. The API is served under `/mars-pathfinder/api/`.

The scientific catalog, originals and generated derivatives are local, excluded from Git and deployment. **Not publish-ready**: durable source storage and a production C# service build/run configuration must be completed before publishing. Do not advertise static frontend deployment alone as a functional application.

## Run locally on Windows

The source-code download alone omits the generated map assets. Download `NASA_Pathfinder_Local_Data.zip` from this Repl's Library (or regenerate it with `research/package_mars_local.py`) and extract its contents into the project root; preserve the archive paths. It includes the runtime map derivatives and source catalog needed to run this preview. The 1.1 GB full NASA source archive is optional for running the app; retain it separately if you need the original inputs.

Install a compatible Node.js LTS release, pnpm 10, the .NET 9 SDK and Git for Windows. Follow the [Windows preparation steps](docs/PROJECT_GUIDE.md#3-windows-powershell-install-and-prepare) first: the current workspace needs four Windows x64 native-package exclusions removed locally, and Git's `usr\bin` on PATH for its `sh` install script. Use `.cmd` wrappers if PowerShell scripts are disabled. Then, in PowerShell at the extracted project root:

```powershell
pnpm.cmd install --no-frozen-lockfile
```

Open two PowerShell windows in that directory. In window 1, start the API:

```powershell
$env:PORT = "18220"
dotnet run --project artifacts/mars-pathfinder/backend/Mars.Api.csproj
```

In window 2, start the web app and its local API proxy:

```powershell
$env:PORT = "18219"
$env:BASE_PATH = "/mars-pathfinder/"
$env:LOCAL_API_PROXY = "1"
pnpm.cmd --filter @workspace/mars-pathfinder run dev
```

Open `http://localhost:18219/mars-pathfinder/`. Keep both windows running. No Python or database is required to run the packaged preview; Python GIS dependencies are only needed to regenerate the map-data archive.
