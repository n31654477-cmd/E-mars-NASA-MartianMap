# Mars Surface Analysis & Path Finder

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

## Run and persistence

Use the managed `artifacts/mars-pathfinder: web` and `artifacts/mars-pathfinder: Mars API` workflows. The API is served under `/mars-pathfinder/api/`.

The scientific catalog, originals and generated derivatives are local, excluded from Git and deployment. **Not publish-ready**: durable source storage and a production C# service build/run configuration must be completed before publishing. Do not advertise static frontend deployment alone as a functional application.
