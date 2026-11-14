# Mars Surface Analysis & Path Finder
## Installation, operation, calculations and technical reference

This guide describes the current experimental Mars map, grid-routing model and hazard-event simulator. It includes Windows PowerShell instructions.

**Important:** This is a research and software demonstration, not an operational navigation or astronaut-safety system. “Safe route” means minimum cost under the application's assumed model. It does not establish real-world safety.

## 1. What the project does

The application displays Mars geological context, lets you choose a rectangular travel area, divides that area into cells, calculates a danger factor (DF) for each cell, and finds a route between A and B. You can place a traveler on that route, simulate a hazard ahead of them, and compare the previous route with a new route.

Main capabilities:

- Display geologic units, contacts, structures, landing sites and hillshade.
- Inspect a location and see source-linked geological evidence.
- Select grid bounds by clicking opposite map corners or typing coordinates.
- Generate an experimental risk grid with independently chosen rows and columns.
- Compare BFS, Dijkstra and A* routes.
- Place an optional traveler/vehicle on the current route before an event.
- Simulate a factor increase, forbid the event's central cell, and reroute.
- Accumulate up to 50 events, or reset to the original grid and route.
- Read the in-app Methods & limits and compare algorithms on synthetic lab fixtures.

The underlying source data are a local SIM3292 snapshot. They are not a live Mars weather, terrain-obstacle or rover telemetry feed.

## 2. Project layout and requirements

Run installation commands from the **whole project root**, not the frontend or backend folder alone. The frontend imports shared packages from this workspace.

| Location relative to project root | Purpose |
| --- | --- |
| artifacts/mars-pathfinder | React/Vite frontend, map and local frontend configuration |
| artifacts/mars-pathfinder/backend | C# ASP.NET Core API and routing adapter |
| artifacts/mars-pathfinder/backend/Prototype | Preserved original algorithm source |
| artifacts/mars-pathfinder/tests | C# checks and live API scenario checks |
| lib/api-spec/openapi.yaml | API contract |
| lib/api-client-react | Generated frontend API client |
| generated-artifacts/mars-map | Required local map and exact-geometry data |
| artifacts/nasa-data-explorer/public/data/catalog.json | Required source catalog |
| research | Data-preparation utilities; also used to locate the project data root |

Local requirements:

- Windows 10/11 x64 for the commands below. Windows ARM requires matching native packages and is not covered by this x64 procedure.
- A supported Node.js LTS release compatible with the workspace's Vite version, plus npm.
- pnpm major version 10.
- .NET 9 SDK, matching the API's net9.0 target. A runtime-only install is insufficient for building.
- Git for Windows: this project's current install script invokes sh.
- Internet for initial package installation and NuGet restore.
- The complete workspace source and the separate runtime data files.

Python is not needed to run the frontend and API with prepared runtime data. It is needed for optional Python checks and data preparation. No database, login or Google Drive connection is needed to use the prepared local map.

The frontend and C# API are separate processes. Starting Vite alone is insufficient.

## 3. Windows PowerShell: install and prepare

### 3.1 Install missing tools

Use PowerShell. Run only installations you still need. Accept installer prompts, then close and reopen PowerShell.

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --source winget
winget install --id Git.Git --exact --source winget
winget install --id Microsoft.DotNet.SDK.9 --exact --source winget
```

If an ID is unavailable in your winget catalog, use the official Node.js, Git for Windows, or Microsoft .NET download site. Install the SDK version targeted by the project; do not silently retarget the code to another .NET version.

The following PATH setup applies to the current PowerShell window and assumes the standard install locations:

```powershell
$env:Path = "C:\Program Files\Git\usr\bin;C:\Program Files\nodejs;$env:Path"
node --version
npm.cmd --version
dotnet --version
sh --version

npm.cmd install --global pnpm@10
$npmGlobal = (npm.cmd config get prefix).Trim()
$env:Path = "$npmGlobal;$env:Path"
pnpm.cmd --version
```

Use npm.cmd and pnpm.cmd rather than their PowerShell .ps1 wrappers if script execution is disabled. You do not need to weaken your execution policy.

### 3.2 Open the project root

The examples use this existing local folder. Change it if your extracted project is elsewhere. Quotes are required around paths containing spaces.

```powershell
cd "C:\Users\IP3 SLIM\Downloads\NASAPRO"
Test-Path ".\package.json"
Test-Path ".\pnpm-workspace.yaml"
Test-Path ".\artifacts\mars-pathfinder\backend\Mars.Api.csproj"
```

All three checks should print True. Keep the complete workspace structure, including research and lib.

### 3.3 Include the runtime data

The Windows-ready `NASAproV2.zip` bundle already contains these runtime files in the required paths. If you have a regular source-code download instead, it may exclude large generated data. Extract `NASA_Pathfinder_Local_Data.zip` into the project root, preserving its internal paths. If it is in Downloads:

```powershell
Expand-Archive `
  -Path "$HOME\Downloads\NASA_Pathfinder_Local_Data.zip" `
  -DestinationPath "." -Force

$required = @(
  "generated-artifacts\mars-map\layer-02.json",
  "generated-artifacts\mars-map\layer-03.json",
  "generated-artifacts\mars-map\layer-04.json",
  "generated-artifacts\mars-map\layer-05.json",
  "generated-artifacts\mars-map\geology-exact.json",
  "generated-artifacts\mars-map\structures-exact.json",
  "generated-artifacts\mars-map\hillshade.png",
  "artifacts\nasa-data-explorer\public\data\catalog.json"
)
$required | ForEach-Object {
  "{0}: {1}" -f (Test-Path $_), $_
}
```

Every entry must print True. Extraction with -Force replaces files with the same names; use the intended matching data package. The larger original-source archive is useful for provenance and regeneration but is not required to run the packaged map. The runtime package is not a substitute for the complete original dataset.

### 3.4 Allow Windows x64 native dependencies

The current Replit-oriented workspace excludes some non-Linux native packages. The `NASAproV2.zip` bundle already enables these packages for Windows x64. For a regular source-code download, remove the four x64 exclusions below from your **local Windows copy** before installation. This procedure makes a backup and leaves other workspace settings unchanged. Skip it if your copy already removed them.

```powershell
if (!(Test-Path ".\pnpm-workspace.yaml.windows-backup")) {
  Copy-Item ".\pnpm-workspace.yaml" ".\pnpm-workspace.yaml.windows-backup"
}
$remove = @(
  '"esbuild>@esbuild/win32-x64": "-"',
  '"lightningcss>lightningcss-win32-x64-msvc": "-"',
  '"@tailwindcss/oxide>@tailwindcss/oxide-win32-x64-msvc": "-"',
  '"rollup>@rollup/rollup-win32-x64-msvc": "-"'
)
$lines = Get-Content ".\pnpm-workspace.yaml"
$lines | Where-Object {
  $_.Trim() -notin $remove
} | Set-Content ".\pnpm-workspace.yaml" -Encoding UTF8

pnpm.cmd install --no-frozen-lockfile
```

This updates your local lockfile as necessary. Preserve your working Windows workspace settings when applying future source updates. Do not replace them with the Linux-oriented copy without reviewing these exclusions.

## 4. Start the project locally

### Window 1: C# backend

Open a PowerShell window and run:

```powershell
cd "$HOME\Downloads\NASAproV2"
$env:PORT = "18220"
dotnet run --project ".\artifacts\mars-pathfinder\backend\Mars.Api.csproj" --no-launch-profile
```

Keep this window open. Initial NuGet restore/build can take longer than later starts.

### Window 2: frontend and local API proxy

Open a second PowerShell window:

```powershell
$env:Path = "C:\Program Files\Git\usr\bin;C:\Program Files\nodejs;$env:Path"
$npmGlobal = (npm.cmd config get prefix).Trim()
$env:Path = "$npmGlobal;$env:Path"
cd "$HOME\Downloads\NASAproV2"

$env:PORT = "18219"
$env:BASE_PATH = "/mars-pathfinder/"
$env:LOCAL_API_PROXY = "1"
pnpm.cmd --filter @workspace/mars-pathfinder run dev
```

Open **http://localhost:18219/mars-pathfinder/** in your browser.

Frontend folder: artifacts/mars-pathfinder. Backend folder: artifacts/mars-pathfinder/backend. Commands are deliberately run from the root to retain workspace package resolution.

PORT selects each process's listening port. BASE_PATH is required by Vite. LOCAL_API_PROXY=1 forwards frontend requests under /mars-pathfinder/api to the local backend on port 18220. The trailing slash in the browser URL is intentional. This is a development server, not a production deployment procedure.

Keep both windows running. Press Ctrl+C in each to stop. PATH and environment assignments shown here are session-local; repeat them in new windows.

### Verify both services

In another PowerShell window:

```powershell
$s = Invoke-RestMethod "http://localhost:18220/mars-pathfinder/api/mars/summary"
"API title: $($s.title)"
"Layer count: $($s.layers.Count)"

$s2 = Invoke-RestMethod "http://localhost:18219/mars-pathfinder/api/mars/summary"
"Through frontend proxy: $($s2.title)"
```

The prepared snapshot has 23 catalog layers. Both calls should return the Mars summary, not HTML. A successful Vite startup alone does not confirm that the API or map data work.

The Source Explorer is a separate app. Its links/downloads may require that app to be started and its larger export files to be present; those are not prerequisites for Mars map routing.

## 5. Using the interface

1. Turn context layers on/off as needed. These are geological context, not measured safe/unsafe boundaries.
2. Choose Select area on map and click two opposite corners, or enter numeric geographic bounds.
3. Set rows and columns, each from 1 to 80. Bounds must increase and stay within latitude -90 to 90 and longitude -180 to 180.
4. Press Generate grid. Bounds are rectangular; wrapping across the longitude seam is unsupported.
5. Use Set start and Set end to place A and B inside the generated grid.
6. Choose bfs, dijkstra or astar and calculate the experimental route.
7. Inspect cells to review factors, source evidence, missing inputs and any simulated changes.
8. Optionally place a traveler, then trigger a random event.
9. Compare the historical amber path with the valid new blue path, or read the no-route message.

Changing grid bounds/resolution, endpoints or algorithm discards the associated scenario. Generate a new grid after changing its bounds or resolution. Reset in the event panel restores the source-derived grid and original pre-scenario route. Reloading discards in-memory state.

More rows/columns mean smaller cells, not better source resolution. At most 6,400 cells are generated; exact geometry intersections can take time.

## 6. How a cell is constructed

For rows N and columns K:

```text
cellHeight = (endLat - startLat) / N
cellWidth  = (endLng - startLng) / K
centerLat  = startLat + (row + 0.5) * cellHeight
centerLng  = startLng + (col + 0.5) * cellWidth
```

Rows increase with latitude; columns increase with longitude. Indices are zero-based. Geographic dimensions above are in degrees, not kilometers.

For every cell, the backend:

- Queries full, unsimplified geology polygons covering the midpoint.
- Queries exact mapped structures intersecting the whole cell rectangle.
- Derives normalized factor scores T, M and U.
- Computes R, DF and the inverse model score using the equations below.
- Retains source filenames, layers, feature IDs and unknown inputs separately.

Missing midpoint geology excludes a cell from routing by data policy. It does not prove a physical obstacle. In a source-only grid, blocked is null: actual physical traversability is unknown. In an event scenario, blocked=true means a simulated operational closure, not a newly observed obstacle.

## 7. Exact DF equation

The implemented model is:

```text
R = 45*T + 35*M + 20*U

DF = 1 + R/100
   = 1 + (45*T + 35*M + 20*U)/100

modelSafetyScore = 100 - R
```

| Symbol | Meaning | Range / units |
| --- | --- | --- |
| T | Geological terrain-association score | 0 to 1, dimensionless |
| M | Mapped structural-feature score | 0 to 1, dimensionless |
| U | Missing-data penalty | 0 to 1, dimensionless |
| R | Weighted proxy-risk score | 0 to 100, model points |
| DF | Entered-cell movement cost / danger factor | 1 to 2, dimensionless |
| modelSafetyScore | Inverse proxy score, not probability of safety | 0 to 100, model points |

These are mathematical bounds; the category rules and missing-data floor mean baseline cells do not necessarily attain every value.

### 7.1 Factor weights and rationale

| Factor | Weight / maximum contribution | Interpretation |
| --- | --- | --- |
| Geological terrain association T | 45 | Broad mobility context; not measured roughness or bearing strength |
| Mapped structures M | 35 | Potential relief-related context; not measured slope, height or crossability |
| Missing-data penalty U | 20 | Explicit penalty for unavailable evidence |

The weights total 100. **The weights and category scores are analyst-selected assumptions.** NASA, JPL and SIM3292 do not establish these numerical weights or validate the category ordering. Their importance is qualitative, not empirically calibrated mission risk.

### 7.2 Terrain score T

Descriptions are matched case-insensitively in the order below. The **first matching rule** wins for each geology description. If several polygons cover a midpoint, the highest resulting terrain score is used.

| First applicable description match | T | Contribution 45*T |
| --- | --- | --- |
| Contains polar or dune | 1.0 | 45 |
| Contains apron, massif or edifice | 0.8 | 36 |
| Contains highland, impact or transition | 0.6 | 27 |
| Contains volcanic | 0.5 | 22.5 |
| Contains basin or lowland | 0.3 | 13.5 |
| Missing or unmatched description | 1.0 | 45 |

Example: a description containing both volcanic and edifice scores 0.8 because the edifice rule occurs first. These names do not provide local wheel-scale measurements.

### 7.3 Structure score M

The Interpreta category uses exact category matching. The highest score among structures intersecting the cell is used, not their sum.

| Mapped category | M | Contribution 35*M |
| --- | --- | --- |
| Scarp; Caldera rim; Crater rim; Pit crater chain | 1.0 | 35 |
| Graben axis; Channel axis; Outflow Channel; Spiral trough; Rille | 0.8 | 28 |
| Wrinkle ridge; Ridge; Yardangs | 0.6 | 21 |
| Lobate flow | 0.4 | 14 |
| Other / unrecognized mapped category | 1.0 | 35 |
| No mapped structure intersects the cell | 0.0 | 0 |

M=0 means no intersection in this map, **not** proven absence of local hazards.

### 7.4 Missing-data penalty U

```text
U = (7 + g) / 8
g = 0 if midpoint geology is present
g = 1 if midpoint geology is absent
```

The seven always-missing categories are elevation, slope, radiation, temperature, weather, rock size/wheel interaction, and soil bearing strength. Geological description is the eighth category.

- Geology present: U=7/8=0.875; contribution 20*U=17.5.
- Geology absent: U=1; contribution 20. The cell is also excluded from routing.

Unknown measurements are never presented as measured zero values.

### 7.5 Worked DF example

For a basin-associated cell with a mapped scarp:

```text
T = 0.3, M = 1, U = 0.875
R = 45*0.3 + 35*1 + 20*0.875
  = 13.5 + 35 + 17.5 = 66
DF = 1 + 66/100 = 1.66
modelSafetyScore = 100 - 66 = 34
```

DF=1.66 is an experimental movement cost, not a 66% chance of harm. The inverse score 34 is not a 34% survival or safety probability.

## 8. Routing algorithms and route cost

| Algorithm | Objective | Effect of residual risk | Event origins |
| --- | --- | --- | --- |
| BFS | Fewest four-neighbor moves | Ignores DF differences | Always excluded |
| Dijkstra | Baseline: lowest entered-cell DF; event scenario: fewest residual cells first, then lowest DF | Avoids residual cells when an alternative exists; uses them if needed | Always excluded |
| A* | Same two-stage event objective with its original heuristic | Avoids residual cells when an alternative exists; uses them if needed | Always excluded |

“Fastest” here means fewest grid moves, not modeled travel time. No speed, energy use or real rover dynamics are available.

For path cells c0 through cn:

```text
totalCost = sum(DF(ci), i=1..n)
          = n + sum(R(ci), i=1..n)/100
```

The start/current traveler cell is not charged. On baseline grids, Dijkstra/A* minimize entered-cell DF. During a hazard scenario, a separate, event-only lexicographic preference first minimizes the number of entered residual cells, then the unchanged DF sum. The internal preference is large enough to prioritize one fewer residual entry over any possible DF difference on this grid (DF is at most 2 and the grid at most 80×80); it is not included in reported DF costs, scores, or the risk formula. This is a conservative route-planning preference, not a calibrated physical risk value. Average/minimum inverse model scores describe path cells, while accumulatedRisk sums R for entered cells after the start.

The preserved prototype uses four neighbors in order row-1, col+1, row+1, col-1. No diagonals or seam wrapping are added. A* uses Manhattan distance times the minimum unblocked DF. The scenario changes its input costs and blocked-cell mask, not the original algorithm implementations.

Endpoints map to grid cells for routing. Exact A/B dots are connected to the center-based path by dotted schematic links. Those links are not costed or included in reported distance and have no sub-cell hazard validation.

Reported distance is the sum of spherical great-circle distances between successive cell centers, using Mars radius 3396.190 km. It is separate from the optimization objective.

## 9. Random events: exact sequence and equations

### 9.1 Sequence

1. Rebuild the source-derived grid and replay any existing event history.
2. Reconstruct the current route.
3. If a traveler was selected beforehand, retain only the exact remaining route suffix from that cell to B.
4. Uniformly choose an eligible entered path cell after the start/traveler. At least one terrain or structure factor must have headroom below 1.
5. Uniformly choose an eligible terrain or structure factor. Do not change factor weights or U.
6. Raise that factor by the bounded random increment below.
7. Raise the same factor by smaller residual increments in at most eight immediate covered neighbors.
8. Mark the event's central cell forbidden for **every** routing algorithm.
9. Recalculate from the current origin to B using the same algorithm, updated DF and all accumulated forbidden cells.

These events are simulated what-if scenarios, not observations. Their increment range and residual parameters are not empirically established realistic Mars hazard magnitudes.

### 9.2 Central factor increase

Let f be the selected normalized factor before the event:

```text
headroom = 1 - f
lower = min(0.05, headroom)
upper = min(0.25, headroom)
delta ~ Uniform[lower, upper]
f_new = f + delta
```

If the factor is saturated, it is not selected. If no entered path cell has an eligible factor, the server reports an error instead of inventing an increase.

Recompute R and DF using the same equation:

```text
deltaDF = weight * deltaFactor / 100
weight = 45 for terrain, 35 for structure
```

Example: terrain increases by 0.2, so R increases by 9 and DF increases by 0.09. The origin is forbidden independently of its numerical DF; **there is no DF threshold that permits re-entry**.

### 9.3 Peripheral residual effect and grid area

For each receiving neighbor, let dr and dc be offsets from the origin, each in {-1,0,1}, excluding (0,0). Its spherical cell area is:

```text
A = r^2 * deltaLongitude * abs(sin(phiNorth) - sin(phiSouth))
r = 3396.190 km
```

A is in km^2; angles are in radians. The residual increment is:

```text
deltaNeighbor =
  min(1 - f_neighbor,
      deltaOrigin * 0.5 / (1 + A/10000) / sqrt(dr^2 + dc^2))

f_neighbor_new = f_neighbor + deltaNeighbor
deltaDF_neighbor = weight * deltaNeighbor / 100
```

Each neighbor uses its own area. Larger cells receive smaller residual increments; diagonals receive an additional division by sqrt(2). Missing-geology neighbors are skipped, saturated factors cannot increase, and propagation stops after this one ring. Previously forbidden origins stay forbidden even if a later event also affects them as neighbors.

For deltaOrigin=0.2 and A=10000 km^2:

- Orthogonal neighbor: deltaNeighbor=0.05.
- Diagonal neighbor: deltaNeighbor approximately 0.035355.
- With terrain weight 45, origin deltaDF=0.09 and orthogonal deltaDF=0.0225.

The guarantee is **added neighbor danger < added origin danger**, not neighbor total DF < origin total DF. Different cells can have different baseline scores.

### 9.4 Forbidden center versus passable neighbors

All event origins remain closed until the scenario is reset. Their blocked=true value describes a scenario exclusion, not measured physical traversability.

Peripheral cells are not automatically closed. Safe Dijkstra/A* first minimize the number of residual cells entered, then minimize the existing DF sum; they avoid the residual area whenever a route with fewer residual cells exists, and still use residual cells when a detour is unavoidable. Fastest-by-moves BFS ignores residual DF and may cross the area for a shorter route. Neither behavior allows entry into any forbidden event-origin cell.

If an event closes B, or closures disconnect the allowed grid, the result is an empty new path with a no-route explanation. There is no fallback through forbidden cells.

## 10. Traveler placement and map interpretation

Enable Place traveler on current path before pressing the event button. Use the waypoint slider or Pick waypoint on map. Click near a path cell center; map selection uses an approximately 18-pixel tolerance.

- Positions snap to existing path-cell centers, not continuous GPS/sub-cell coordinates.
- The destination cell cannot be selected as the traveler's current position.
- Selection alone does not generate an event or recalculate a route.
- The next event originates on the remaining entered path after the traveler, not behind them.
- Rerouting starts at the traveler and ends at B.
- Later events retain the moved origin even if the selection checkbox is cleared.
- Without a position ever selected, the original A-to-B scenario behavior is retained.
- Reset restores the baseline grid and original A-to-B route.

Map meanings:

| Symbol / line | Meaning |
| --- | --- |
| A and B dots | Exact clicked endpoints |
| Gold diamond | Selected traveler waypoint |
| Cream diamond | Effective moved reroute origin |
| Solid blue line | New/current modeled route |
| Dashed amber line | Historical pre-event path; now infeasible, not walking instructions |
| Dark red event cells | All forbidden origins accumulated so far |
| Dashed purple neighbor cells | Latest event's passable residual changes |
| Dotted endpoint links | Schematic, uncosted connections to exact dots |

The event panel compares the pre-event path cost with the new valid route cost. Once the old path contains a forbidden origin, its after-event cost is marked forbidden/unavailable, rather than displaying a finite sum as a feasible alternative. In traveler mode comparisons cover only the remaining journey.

## 11. Data, CRS, units and scientific limits

Primary source: USGS Scientific Investigations Map 3292, https://doi.org/10.3133/sim3292.

| Source / locator | Current use |
| --- | --- |
| SIM3292_Global_Geology.shp, layer SIM3292_Global_Geology, Unit and UnitDesc | Exact midpoint coverage and T category derivation |
| SIM3292_Global_Structure.shp, layer SIM3292_Global_Structure, Interpreta | Exact rectangle intersection and M category derivation |
| SIM3292_Global_Contacts.shp | Context display; not a numeric hazard |
| SIM3292_Global_Landing_sites.shp | Context display; proximity does not establish safety |
| sim3292_map.pdf, page 1 | Published map context |
| sim3292_pamphlet.pdf, physical pages 7 and 10 | Mapping scale/detail context; not model calibration |

The application's main geographic display uses Mars spherical longitude/latitude coordinates, radius 3,396,190 m. Coordinates and cell dimensions are degrees; derived distances are km and event cell areas are km^2. These coordinates must not be interpreted as Earth WGS84.

The broader source catalog includes projected GDB layers in meters and a map-footprint layer on a different Mars ellipsoid. Do not silently merge these with the displayed spherical layers. Unresolved polar raster CRS differences remain ambiguous; they do not supply routing measurements.

Display vectors are simplified with topology-preserving tolerance 0.025 degrees. Risk spatial queries use separate full unsimplified geometry. Geology boundaries can yield multiple covering polygons; the highest category score is used, not an area-weighted estimate.

The hillshade display is reprojected from its declared Robinson CRS to the Mars sphere, bilinearly resampled to 1800 by 900 pixels. Brightness is intensity, **not elevation or slope**. Ninety-two contact records have null source geometry and cannot be drawn; no coordinates are invented.

The published map scale is 1:20,000,000. It cannot resolve local rover obstacles. Grid refinement and exact coordinate rendering do not overcome that limitation.

No supported local DEM, slope, radiation, temperature, weather, wheel-scale rocks or soil-bearing-strength input is available to this model. The PDFs provide context, not a complete numerical hazard raster. No DF score, simulated closure or route is certified for real Mars exploration.

Original source values remain separate from derived risk values and hypothetical events. The original prototype ComputeDF and random generator remain in compatibility source but are **not** used to populate the geographic risk grid; the implemented equation is the weighted DF formula in section 7.

## 12. API and reproducibility reference

Local API prefix: http://localhost:18220/mars-pathfinder/api/mars.

| Method and suffix | Purpose |
| --- | --- |
| GET /summary | Catalog, model definitions and capabilities |
| GET /layers/{id}/features | Display GeoJSON for layer-02 through layer-05 |
| GET /inspect?latitude=0&longitude=0 | Location evidence and unknown inputs |
| POST /grid | Generate source-derived grid |
| POST /route | Route with optional replayed events |
| POST /event | Apply event and return old/new routes and updated grid |
| POST /lab | Run supported synthetic algorithm fixture |

Example event request:

```json
{
  "route": {
    "algorithm": "astar",
    "startLat": -5,
    "startLng": -10,
    "endLat": 5,
    "endLng": 10,
    "grid": {
      "startLat": -10, "endLat": 10,
      "startLng": -20, "endLng": 20,
      "rows": 10, "columns": 10
    },
    "events": []
  },
  "seed": 42,
  "travelerPathIndex": 3
}
```

travelerPathIndex is optional and indexes the reconstructed current route, starting at zero. It must be before the destination. Omit it for no new traveler placement. After movement, later requests must use the moved cell center as route.startLat/startLng and include the returned event history; the UI does this automatically.

The response contains grid, oldRoute, newRoute, event and events. Each stored event has row, col, factor and delta. An optional seed supports repeatable sampling for the same inputs on a compatible runtime. Exact replay should retain event increments, bounds/resolution, algorithm, effective origin, destination and matching source data; a seed alone is insufficient across changed data or runtime implementations.

The server rebuilds the baseline and replays events, including closures. It does not accept arbitrary replacements for source evidence. A maximum of 50 events is allowed. There is no scenario save/import UI or persistent scenario database; reload loses page state.

## 13. Developer checks and maintenance

Run from the workspace root:

```powershell
dotnet run --project ".\artifacts\mars-pathfinder\tests\Mars.Checks.csproj"
pnpm.cmd --filter @workspace/mars-pathfinder run typecheck
pnpm.cmd --filter @workspace/scripts exec tsx --test ../artifacts/mars-pathfinder/src/lib/scenario.test.ts
```

Optional live API checks require Python and a running API. Use its direct local port:

```powershell
$env:MARS_TEST_BASE_URL = "http://localhost:18220/mars-pathfinder/api/mars"
python ".\artifacts\mars-pathfinder\tests\scenario_api_checks.py"
```

Checks cover prototype behavior, factor formulas, residual bounds, immutable baseline evidence, forbidden origins, detours, blocked endpoints, disconnected routes, traveler suffixes and cumulative replay. Passing tests establish implementation consistency, not scientific validity.

If the API contract changes, update lib/api-spec/openapi.yaml and regenerate shared clients:

```powershell
pnpm.cmd --filter @workspace/api-spec run codegen
```

Keep original observations separate from derived risk and simulated events. Do not substitute a different algorithm or objective without documenting the change. Large source/derived data and generated documentation exports are excluded from Git; retain or regenerate them separately.

## 14. Scope of local operation

The two-process procedure above runs the Mars map and API locally. It does not automatically start the separate Source Explorer, regenerate missing export archives, or publish the app.

The current runtime scientific assets are local files excluded from deployment. A production release additionally needs durable source storage and an appropriate production C# build/run arrangement. Do not treat a static frontend build alone as the complete software.

This guide, the application README, in-app Methods & limits, and executable model definitions should be updated together whenever factor rules, event behavior or startup requirements change.
