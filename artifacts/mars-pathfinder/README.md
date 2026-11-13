# Mars Surface Analysis & Path Finder

## Approved scientific scope

The user approved a source-grounded map and preserved algorithm laboratory with explicit scientific limits. This is not an operational Mars navigation system. Unknown measurements and traversability are not zero, safe, or implicitly unblocked. The scientific route endpoint returns eligibility, not a fabricated route.

## Architecture

- React/Vite and OpenLayers frontend, with an explicitly registered Mars spherical longitude/latitude projection. No terrestrial basemap.
- C# ASP.NET Core 9 API in `backend`, with controllers, a source/spatial-query service and an isolated algorithm fixture service.
- `backend/Prototype` contains byte-identical Business and Models files extracted from the uploaded backend. The original random generator and unvalidated ComputeDF formula are retained for reference, not used to populate scientific cells.
- OpenAPI contract: `lib/api-spec/openapi.yaml`. Client hooks are generated, not handwritten.
- No user database or accounts are required. This is a read-only scientific-source snapshot plus transient calculations.

## Scientific transformations

Run `research/prepare_mars_map.py` from the workspace root. A compatible native Expat library may need to be preloaded; consult the project's native XML compatibility guidance.

Four geographic SIM3292 shapefiles are decoded using GDAL. Display geometry is simplified with a topology-preserving **0.025-degree tolerance**; this is an engineering display choice, not a measured hazard threshold. All features and attributes are retained. Ninety-two contact features have null source geometry and cannot be drawn.

Full unsimplified geology WKB is stored separately and indexed using NetTopologySuite for exact point coverage. Boundary points can return multiple units. Grid membership is based on the midpoint, not an area-weighted cell aggregate or a claim that the entire cell is homogeneous.

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
