# Mars Surface Analysis & Path Finder

**Installation, Operation, Calculations, and Technical Reference**

This repository contains an experimental Mars geological map, spherical grid-routing model, and stochastic hazard-event simulator built on USGS Scientific Investigations Map 3292 (`SIM3292`) data.

> **Important Disclaimer:** This is a research and software demonstration, not an operational navigation or astronaut-safety system. A `"safe route"` represents the minimum cost under the application's assumed mathematical model and does not establish real-world physical traversability or astronaut safety.

---

## Table of Contents

1. [What the Project Does](#1-what-the-project-does)
2. [Project Layout and Local Requirements](#2-project-layout-and-local-requirements)
3. [Windows PowerShell: Install and Prepare](#3-windows-powershell-install-and-prepare)
4. [Start the Project Locally](#4-start-the-project-locally)
5. [Using the Interface](#5-using-the-interface)
6. [How a Cell Is Constructed](#6-how-a-cell-is-constructed)
7. [Exact Danger Factor ($DF$) Equation & Factor Rules](#7-exact-danger-factor-df-equation--factor-rules)
8. [Routing Algorithms and Route Cost](#8-routing-algorithms-and-route-cost)
9. [Random Events: Exact Sequence and Equations](#9-random-events-exact-sequence-and-equations)
10. [Traveler Placement and Map Interpretation](#10-traveler-placement-and-map-interpretation)
11. [Data, CRS, Units, and Scientific Limits](#11-data-crs-units-and-scientific-limits)
12. [API and Reproducibility Reference](#12-api-and-reproducibility-reference)
13. [Troubleshooting](#13-troubleshooting)
14. [Developer Checks and Maintenance](#14-developer-checks-and-maintenance)
15. [Scope of Local Operation & Production Notes](#15-scope-of-local-operation--production-notes)

---

## 1. What the Project Does

The application displays Martian geological context, lets you define a rectangular travel area, divides that area into discrete cells, calculates a dimensionless Danger Factor ($DF$) for each cell, and computes a route between start ($A$) and destination ($B$). You can place a traveler on an active route, simulate a hazard event ahead of them, and compare the historical pre-event route with the newly calculated detour.

### Main Capabilities

* Display Martian geologic units, contacts, structural features, historic landing sites, and hillshade relief.
* Inspect any location to view source-linked geological evidence, derived scores, and missing telemetry indicators.
* Select grid bounds by clicking opposite corners on the map or entering numeric geographic coordinates.
* Generate an experimental risk grid with independently chosen rows and columns (up to $80 \times 80$).
* Compare **BFS**, **Dijkstra**, and **$A^*$** routes side by side.
* Place an optional traveler/vehicle on the current route prior to triggering a hazard event.
* Simulate a bounded factor increase, mark the event's central cell strictly forbidden, propagate attenuated residual risk to neighboring cells, and reroute.
* Accumulate up to $50$ sequential events, or reset back to the original baseline grid and route.
* Review in-app **Methods & limits** and benchmark algorithms on synthetic lab fixtures (`POST /lab`).

*Note: The underlying source data come from a local static `SIM3292` snapshot. They are not a live Mars weather, terrain-obstacle, or rover telemetry feed.*

---

## 2. Project Layout and Local Requirements

Run all installation and workspace commands from the **whole project root**, not from the frontend or backend folder alone, because the frontend imports shared packages from this monorepo workspace.

### 2.1 Workspace Directory Structure

| Location Relative to Project Root | Purpose |
| :--- | :--- |
| `artifacts/mars-pathfinder` | React/Vite frontend, interactive map, and local frontend proxy configuration |
| `artifacts/mars-pathfinder/backend` | C# ASP.NET Core (`.NET 9`) API and routing adapter |
| `artifacts/mars-pathfinder/backend/Prototype` | Preserved original prototype algorithm source |
| `artifacts/mars-pathfinder/tests` | C# verification checks and live Python API scenario checks |
| `lib/api-spec/openapi.yaml` | OpenAPI contract specification |
| `lib/api-client-react` | Auto-generated typed React frontend API client |
| `generated-artifacts/mars-map` | Required local map layers and exact-geometry JSON data |
| `artifacts/nasa-data-explorer/public/data/catalog.json` | Required planetary data source catalog |
| `research` | Offline data-preparation utilities; also anchors project data root discovery |

### 2.2 Local Environment Requirements

* **Operating System:** Windows $10/11$ $\text{x64}$ for the commands below. *(Windows ARM requires matching native packages and is not covered by this $\text{x64}$ procedure.)*
* **Node.js & npm:** A supported Node.js LTS release compatible with the workspace's Vite version, plus `npm`.
* **Package Manager:** `pnpm` major version `10`.
* **Backend SDK:** `.NET 9 SDK`, matching the API's `net9.0` target. *(A runtime-only install is insufficient for building.)*
* **Shell Tooling:** Git for Windows (the project's install script invokes `sh`).
* **Network & Assets:** Internet access for initial package installation and NuGet restore, plus the complete workspace source and separate runtime data files.
* **Python (Optional):** Not required to run the frontend and API with prepared runtime data; required only for optional Python API checks and offline data preparation.
* **Zero External Services:** No database, user login, or Google Drive connection is needed to use the prepared local map.
* **Two-Process Architecture:** The frontend and C# API run as separate OS processes; starting Vite alone is insufficient.

---

## 3. Windows PowerShell: Install and Prepare

### 3.1 Install Missing Tools

Open Windows PowerShell, run only the installations you still need, accept installer prompts, and then close and reopen PowerShell:

```powershell
winget install --id OpenJS.NodeJS.LTS --exact --source winget
winget install --id Git.Git --exact --source winget
winget install --id Microsoft.DotNet.SDK.9 --exact --source winget
```

If a package ID is unavailable in your `winget` catalog, install directly from the official Node.js, Git for Windows, or Microsoft `.NET` websites. Install the exact SDK version targeted by the project (`net9.0`); do not silently retarget the code to another `.NET` version.

Configure `PATH` for the current PowerShell session (assuming standard installation locations) and install `pnpm@10`:

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

*Tip: Use `npm.cmd` and `pnpm.cmd` rather than their `.ps1` wrappers if PowerShell script execution is restricted. You do not need to weaken your execution policy.*

### 3.2 Open and Verify the Project Root

Change to your extracted local project directory (enclose paths containing spaces in quotes) and verify the workspace manifests:

```powershell
cd "C:\Users\IP3 SLIM\Downloads\NASAPRO"
Test-Path ".\package.json"
Test-Path ".\pnpm-workspace.yaml"
Test-Path ".\artifacts\mars-pathfinder\backend\Mars.Api.csproj"
```

All three checks must print `True`. Keep the complete workspace structure intact, including `research` and `lib`.

### 3.3 Include the Runtime Data

The source-code archive may exclude large generated planetary datasets. Extract `NASA_Pathfinder_Local_Data.zip` into the project root while preserving internal paths, then verify all eight required runtime files:

```powershell
Expand-Archive -Path "$HOME\Downloads\NASA_Pathfinder_Local_Data.zip" -DestinationPath "." -Force

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

$required | ForEach-Object { "{0}: {1}" -f (Test-Path $_), $_ }
```

Every entry must print `True`. Extraction with `-Force` overwrites files with the same names; ensure you use the matching runtime data package. The larger original-source archive is useful for scientific provenance and regeneration, but is not required to run the packaged map (nor is the runtime package a substitute for the complete original dataset).

### 3.4 Allow Windows x64 Native Dependencies

The Replit-oriented workspace configuration excludes four non-Linux native packages. On Windows $\text{x64}$, back up `pnpm-workspace.yaml`, remove those four exclusions, and install dependencies:

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
$lines | Where-Object { $_.Trim() -notin $remove } | Set-Content ".\pnpm-workspace.yaml" -Encoding UTF8
pnpm.cmd install --no-frozen-lockfile
```

Preserve your working Windows workspace settings when applying future source updates rather than overwriting them with a Linux-oriented copy.

---

## 4. Start the Project Locally

### Window 1: C# ASP.NET Core Backend

Open a PowerShell window and run:

```powershell
cd "C:\Users\IP3 SLIM\Downloads\NASAPRO"
$env:PORT = "18220"
dotnet run --project ".\artifacts\mars-pathfinder\backend\Mars.Api.csproj" --no-launch-profile
```

Keep this window open. Initial NuGet package restore and build take longer than subsequent starts.

### Window 2: Vite Frontend and Local API Proxy

Open a second PowerShell window and run:

```powershell
$env:Path = "C:\Program Files\Git\usr\bin;C:\Program Files\nodejs;$env:Path"
$npmGlobal = (npm.cmd config get prefix).Trim()
$env:Path = "$npmGlobal;$env:Path"

cd "C:\Users\IP3 SLIM\Downloads\NASAPRO"
$env:PORT = "18219"
$env:BASE_PATH = "/mars-pathfinder/"
$env:LOCAL_API_PROXY = "1"
pnpm.cmd --filter @workspace/mars-pathfinder run dev
```

Open **`http://localhost:18219/mars-pathfinder/`** in your browser (the trailing slash is intentional).

* `PORT` selects each process's listening port (`18220` for backend, `18219` for frontend).
* `BASE_PATH` is required by Vite.
* `LOCAL_API_PROXY=1` forwards frontend requests under `/mars-pathfinder/api` to the local backend on port `18220`.
* Keep both PowerShell windows running; press `Ctrl+C` in each to stop. Because `PATH` and environment assignments are session-local, repeat them when opening new terminals.

### Verify Both Services

In a third PowerShell window, confirm both the direct API and the frontend proxy return JSON metadata (expecting $23$ catalog layers):

```powershell
$s = Invoke-RestMethod "http://localhost:18220/mars-pathfinder/api/mars/summary"
"API title: $($s.title)"
"Layer count: $($s.layers.Count)"

$s2 = Invoke-RestMethod "http://localhost:18219/mars-pathfinder/api/mars/summary"
"Through frontend proxy: $($s2.title)"
```

Both calls must return the Mars summary object rather than HTML. *(Note: The Source Explorer is a separate application; its links and downloads require starting that app and having its larger export archives present, which are not prerequisites for Mars map routing.)*

---

## 5. Using the Interface

1. **Toggle Context Layers:** Turn geological units, contacts, structures, landing sites, and hillshade layers on/off as needed. These provide geological context, not measured safe/unsafe boundaries.
2. **Select Bounds:** Choose **Select area** on the map and click two opposite corners, or enter numeric geographic bounds.
3. **Set Grid Resolution:** Enter rows $N$ and columns $K$, each from $1$ to $80$. Bounds must increase monotonically and remain within latitude $-90^\circ$ to $90^\circ$ and longitude $-180^\circ$ to $180^\circ$.
4. **Generate Grid:** Click **Generate grid**. Bounds are rectangular; wrapping across the $\pm 180^\circ$ longitude seam is unsupported.
5. **Set Endpoints:** Use **Set start** and **Set end** to place $A$ and $B$ inside the generated grid.
6. **Calculate Route:** Select `bfs`, `dijkstra`, or `astar` to compute the experimental route.
7. **Inspect Cells:** Click any cell to inspect factor values, linked source evidence, missing inputs, and simulated event changes.
8. **Simulate Events (Optional):** Place a traveler along the active route, then trigger a random hazard event.
9. **Compare Routes:** Compare the dashed amber historical path against the solid blue valid detour, or inspect the no-route explanation if $B$ becomes unreachable.

### State & Resolution Behavior

* Changing grid bounds, resolution, endpoints, or algorithm discards the current scenario; generate a new grid after modifying bounds or resolution.
* Clicking **Reset** in the event panel restores the baseline source-derived grid and original pre-scenario route. Reloading the browser discards all in-memory state.
* Increasing rows/columns produces smaller cells, **not** higher underlying source resolution. At most $6,400$ cells ($80 \times 80$) are generated; exact polygon/rectangle intersections on dense grids can take additional processing time.

---

## 6. How a Cell Is Constructed

For $N$ rows and $K$ columns (zero-based indices $\text{row} \in [0, N-1]$ and $\text{col} \in [0, K-1]$), cell dimensions and centers in degrees are:

$$\text{cellHeight} = \frac{\text{endLat} - \text{startLat}}{N}, \qquad \text{cellWidth} = \frac{\text{endLng} - \text{startLng}}{K}$$

$$\text{centerLat} = \text{startLat} + (\text{row} + 0.5) \cdot \text{cellHeight}, \qquad \text{centerLng} = \text{startLng} + (\text{col} + 0.5) \cdot \text{cellWidth}$$

Rows increase with latitude and columns increase with longitude. For every cell, the backend:

1. Queries full, unsimplified geology polygons covering the cell midpoint.
2. Queries exact mapped structures intersecting the entire cell rectangle.
3. Derives normalized dimensionless factor scores $T$, $M$, and $U$.
4. Computes $R$, $DF$, and `modelSafetyScore`.
5. Retains source filenames, layer IDs, feature IDs, and unknown telemetry flags separately.

### Traversability & `blocked` Semantics

* Missing midpoint geology excludes a cell from routing by data policy; it does not prove a physical obstacle.
* In a baseline source-only grid, `blocked` is `null` (actual physical traversability is unknown).
* In an event scenario, `blocked = true` indicates a simulated operational closure, not a newly observed physical obstacle.

---

## 7. Exact Danger Factor ($DF$) Equation & Factor Rules

The implemented model defines:

$$R = 45T + 35M + 20U$$

$$DF = 1 + \frac{R}{100} = 1 + \frac{45T + 35M + 20U}{100}$$

$$\text{modelSafetyScore} = 100 - R$$

| Symbol | Meaning | Mathematical Bounds / Units |
| :--- | :--- | :--- |
| $T$ | Geological terrain-association score | $0$ to $1$, dimensionless |
| $M$ | Mapped structural-feature score | $0$ to $1$, dimensionless |
| $U$ | Missing-data penalty | $0$ to $1$, dimensionless |
| $R$ | Weighted proxy-risk score | $0$ to $100$, model points |
| $DF$ | Entered-cell movement cost / danger factor | $1$ to $2$, dimensionless |
| $\text{modelSafetyScore}$ | Inverse proxy score (not a probability of safety) | $0$ to $100$, model points |

*(Because of category rules and the missing-data floor, baseline cells do not necessarily attain every theoretical bound value.)*

### 7.1 Factor Weights and Rationale

| Factor | Weight / Max Contribution | Interpretation |
| :--- | :---: | :--- |
| Geological terrain association ($T$) | $45$ | Broad mobility context; not measured roughness or bearing strength |
| Mapped structures ($M$) | $35$ | Potential relief-related context; not measured slope, height, or crossability |
| Missing-data penalty ($U$) | $20$ | Explicit penalty for unavailable field evidence |

The weights sum to $100$. Both the weights and category scores are **analyst-selected assumptions**—NASA, JPL, and `SIM3292` do not establish these numerical weights or validate the category ordering.

### 7.2 Terrain Score ($T$)

Geology descriptions (`UnitDesc`) are matched case-insensitively in the exact priority order below. The **first matching rule wins** for each polygon; if multiple polygons cover a cell midpoint, the **highest** resulting $T$ score is used:

| First Applicable Description Match (`UnitDesc`) | $T$ | Contribution ($45T$) |
| :--- | :---: | :---: |
| Contains `polar` or `dune` | $1.0$ | $45.0$ |
| Contains `apron`, `massif`, or `edifice` | $0.8$ | $36.0$ |
| Contains `highland`, `impact`, or `transition` | $0.6$ | $27.0$ |
| Contains `volcanic` | $0.5$ | $22.5$ |
| Contains `basin` or `lowland` | $0.3$ | $13.5$ |
| Missing or unmatched description | $1.0$ | $45.0$ |

*Example:* A description containing both `volcanic` and `edifice` scores $T = 0.8$ because the `edifice` rule appears earlier in the priority order.

### 7.3 Structural-Feature Score ($M$)

The `Interpreta` attribute uses exact category matching. Only the **single highest score** among all structures intersecting the cell rectangle is used (scores are not summed):

| Mapped Category (`Interpreta`) | $M$ | Contribution ($35M$) |
| :--- | :---: | :---: |
| `Scarp`; `Caldera rim`; `Crater rim`; `Pit crater chain` | $1.0$ | $35.0$ |
| `Graben axis`; `Channel axis`; `Outflow Channel`; `Spiral trough`; `Rille` | $0.8$ | $28.0$ |
| `Wrinkle ridge`; `Ridge`; `Yardangs` | $0.6$ | $21.0$ |
| `Lobate flow` | $0.4$ | $14.0$ |
| Other / unrecognized mapped category | $1.0$ | $35.0$ |
| No mapped structure intersects the cell | $0.0$ | $0.0$ |

*Note: $M = 0$ indicates no mapped intersection in `SIM3292`, not proven absence of local surface hazards.*

### 7.4 Missing-Data Penalty ($U$)

$$U = \frac{7 + g}{8}$$

where $g = 0$ if midpoint geology is present and $g = 1$ if midpoint geology is absent.

The **seven always-missing categories** are:
1. Elevation
2. Slope
3. Radiation
4. Temperature
5. Weather
6. Rock size / wheel interaction
7. Soil-bearing strength

Geological description serves as the eighth category:
* **Geology present ($g = 0$):** $U = \frac{7}{8} = 0.875$, contributing $20U = 17.5$.
* **Geology absent ($g = 1$):** $U = 1.0$, contributing $20U = 20.0$, and the cell is excluded from routing.

Unknown measurements are never presented as measured zero values.

### 7.5 Worked $DF$ Example

For a basin-associated cell ($T = 0.3$) intersected by a mapped scarp ($M = 1.0$) with midpoint geology present ($U = 0.875$):

$$R = 45(0.3) + 35(1.0) + 20(0.875) = 13.5 + 35 + 17.5 = 66$$

$$DF = 1 + \frac{66}{100} = 1.66$$

$$\text{modelSafetyScore} = 100 - 66 = 34$$

*Interpretation:* $DF = 1.66$ is an experimental movement cost, **not** a $66\%$ chance of harm, and $\text{modelSafetyScore} = 34$ is **not** a $34\%$ survival or safety probability.

---

## 8. Routing Algorithms and Route Cost

| Algorithm | Objective | Effect of Residual Risk | Event Origins |
| :--- | :--- | :--- | :--- |
| **BFS** | Fewest four-neighbor moves ($n$) | Ignores $DF$ differences | Always excluded |
| **Dijkstra** | Lowest sum of entered-cell $DF$ | Counts increased neighbor $DF$ | Always excluded |
| **$A^*$** | Same $DF$ objective with admissible heuristic | Counts increased neighbor $DF$ | Always excluded |

*"Fastest" here means fewest grid moves, not modeled travel time; no rover speed, energy consumption, or vehicle dynamics are modeled.*

### 8.1 Route Cost Equations

For a path of cells $c_0, c_1, \dots, c_n$, the starting or current traveler cell $c_0$ is uncharged:

$$\text{totalCost} = \sum_{i=1}^{n} DF(c_i) = n + \frac{1}{100}\sum_{i=1}^{n} R(c_i)$$

* **BFS Cost:** $\text{Cost}_{\text{BFS}} = n$
* **Dijkstra Cost:** $g(c_n) = \sum_{i=1}^{n} DF(c_i)$
* **$A^*$ Evaluation Function:**
  $$h(c) = \left(\lvert \text{row}_c - \text{row}_B \rvert + \lvert \text{col}_c - \text{col}_B \rvert\right) \times DF_{\min,\text{unblocked}}$$
  $$f(c) = g(c) + h(c)$$

### 8.2 Grid Topology, Schematic Links & Distance

* **Neighbor Order:** The preserved prototype expands four orthogonal neighbors in strict order: `row-1`, `col+1`, `row+1`, `col-1`. No diagonal moves or longitude seam wrapping are permitted.
* **Separate Reporting Metrics:** Average and minimum `modelSafetyScore` describe path cells, while $\text{accumulatedRisk} = \sum_{i=1}^{n} R(c_i)$ sums $R$ across entered cells after $c_0$.
* **Endpoint Links:** Exact clicked $A/B$ dots connect to grid-cell centers via dotted schematic links, which are uncosted, excluded from reported distance, and lack sub-cell hazard validation.
* **Reported Distance:** Computed separately from the optimization objective as the sum of spherical great-circle distances between consecutive cell centers using Mars radius $r = 3396.190\text{ km}$.

---

## 9. Random Events: Exact Sequence and Equations

### 9.1 Execution Sequence

1. Rebuild the baseline source-derived grid and replay any existing event history.
2. Reconstruct the current active route.
3. If a traveler was placed beforehand, retain only the exact remaining route suffix from the traveler cell to $B$.
4. Uniformly select an eligible entered path cell after the start/traveler where at least one factor ($T$ or $M$) has headroom below $1$.
5. Uniformly select an eligible unsaturated factor ($T$ or $M$); factor weights and $U$ remain unchanged.
6. Increase the central cell's selected factor by a bounded random increment.
7. Propagate smaller attenuated residual increments to at most eight immediate covered neighbors.
8. Mark the event's central origin cell strictly forbidden (`blocked = true`) for every routing algorithm.
9. Recalculate a valid path from the current origin to $B$ using the active algorithm, updated $DF$ costs, and all accumulated forbidden cells.

*(Simulated events represent hypothetical what-if scenarios, not physical observations or empirically calibrated Mars hazard magnitudes.)*

### 9.2 Central Factor Increase

Let $f \in \{T, M\}$ be the selected normalized factor before the event:

$$\text{headroom} = 1 - f$$

$$\text{lower} = \min(0.05,\; \text{headroom}), \qquad \text{upper} = \min(0.25,\; \text{headroom})$$

$$\Delta_{\text{origin}} \sim \text{Uniform}[\text{lower},\; \text{upper}]$$

$$f_{\text{new}} = f + \Delta_{\text{origin}}, \qquad \Delta DF_{\text{origin}} = \frac{w \cdot \Delta_{\text{origin}}}{100}$$

where $w = 45$ for terrain ($T$) and $w = 35$ for structure ($M$). If a factor is already saturated ($f = 1$), it is never selected; if no entered path cell has an eligible factor, the server returns an error. The origin cell is forbidden independently of its numerical $DF$ value.

*Example:* If terrain increases by $\Delta_{\text{origin}} = 0.2$, then $R$ increases by $9$ and $DF$ increases by $\Delta DF_{\text{origin}} = 0.09$.

### 9.3 Peripheral Residual Effect and Spherical Grid Area

For each immediate neighbor at grid offsets $dr, dc \in \{-1, 0, 1\}$ with $(dr, dc) \neq (0, 0)$, its spherical cell area $A$ in $\text{km}^2$ (with $r = 3396.190\text{ km}$ and angles in radians) is:

$$A = r^2 \cdot \Delta\text{Longitude} \cdot \left\lvert \sin(\phi_{\text{North}}) - \sin(\phi_{\text{South}}) \right\rvert$$

The attenuated residual increment is:

$$\Delta_{\text{neighbor}} = \min\left(1 - f_{\text{neighbor}},\; \frac{\Delta_{\text{origin}} \cdot 0.5}{\left(1 + \frac{A}{10000}\right)\sqrt{dr^2 + dc^2}}\right)$$

$$f_{\text{neighbor, new}} = f_{\text{neighbor}} + \Delta_{\text{neighbor}}, \qquad \Delta DF_{\text{neighbor}} = \frac{w \cdot \Delta_{\text{neighbor}}}{100}$$

* Larger cells receive smaller residual increments; diagonal neighbors receive an additional division by $\sqrt{2}$.
* Missing-geology neighbors are skipped, saturated factors cannot increase, and propagation stops after this single one-cell ring.
* Previously forbidden origin cells remain forbidden even if a subsequent event affects them as neighbors.
* **Worked Example:** For $\Delta_{\text{origin}} = 0.2$ and $A = 10000\text{ km}^2$:
  * Orthogonal neighbor: $\Delta_{\text{neighbor}} = 0.05$ (with terrain weight $45$, $\Delta DF_{\text{neighbor}} = 0.0225$ vs. origin $\Delta DF_{\text{origin}} = 0.09$).
  * Diagonal neighbor: $\Delta_{\text{neighbor}} \approx 0.035355$.
  * *Note:* The mathematical guarantee is that **added** neighbor danger is strictly less than **added** origin danger ($\Delta DF_{\text{neighbor}} < \Delta DF_{\text{origin}}$), not that total neighbor $DF$ is lower than total origin $DF$ (since baseline cell scores differ).

### 9.4 Forbidden Center vs. Passable Neighbors

* Event origins remain closed (`blocked = true`) until the scenario is reset.
* Peripheral neighbor cells remain passable: weighted **Dijkstra** and **$A^*$** account for their increased $DF$ and prefer lower-cost detours when available, while **BFS** ignores residual $DF$ and may traverse a neighbor if doing so yields fewer moves.
* If an event closes $B$, or accumulated closures disconnect the grid, the server returns an empty `newRoute` with a no-route explanation (there is no fallback through forbidden cells).

---

## 10. Traveler Placement and Map Interpretation

Enable **Place traveler on current path** before triggering an event, then use the waypoint slider or **Pick waypoint on map** (snaps to path-cell centers within an $\approx 18$-pixel tolerance):

* Positions snap strictly to existing path-cell centers (not continuous sub-cell coordinates), and the destination cell $B$ cannot be selected as the traveler's position.
* Selecting a traveler position alone does not trigger an event or recalculate a route.
* The next event originates on the remaining entered path *after* the traveler, and rerouting starts from the traveler cell to $B$.
* Subsequent events retain the moved origin even if the selection checkbox is later cleared. Clicking **Reset** restores the baseline grid and original $A$-to-$B$ route.

### Map Symbol & Line Legend

| Symbol / Line | Meaning |
| :--- | :--- |
| **$A$ and $B$ dots** | Exact clicked endpoints |
| **Gold diamond** | Selected traveler waypoint |
| **Cream diamond** | Effective moved reroute origin |
| **Solid blue line** | Current / newly modeled valid route |
| **Dashed amber line** | Historical pre-event path (now infeasible; not walking instructions) |
| **Dark red event cells** | All forbidden event origin cells accumulated so far |
| **Dashed purple neighbor cells** | Latest event's passable residual $DF$ changes |
| **Dotted endpoint links** | Schematic, uncosted connections to exact $A/B$ dots |

Once the historical amber path contains a forbidden origin, its post-event cost is marked forbidden/unavailable rather than displayed as a feasible finite sum. In traveler mode, cost comparisons cover only the remaining journey.

---

## 11. Data, CRS, Units, and Scientific Limits

* **Primary Source:** USGS Scientific Investigations Map 3292 (`https://doi.org/10.3133/sim3292`), published at $1:20,000,000$ global scale.

| Source / Locator | Current Use |
| :--- | :--- |
| `SIM3292_Global_Geology.shp` (`Unit`, `UnitDesc`) | Exact cell-midpoint coverage queries for $T$ score derivation |
| `SIM3292_Global_Structure.shp` (`Interpreta`) | Exact cell-rectangle intersection queries for $M$ score derivation |
| `SIM3292_Global_Contacts.shp` | Visual geological contact overlay ($92$ null-geometry records omitted) |
| `SIM3292_Global_Landing_sites.shp` | Context display (proximity does not establish safety) |
| `sim3292_map.pdf` (page 1) | Published map visual context |
| `sim3292_pamphlet.pdf` (physical pages 7 and 10) | Mapping scale and detail context (not model calibration) |

### Coordinate System & Scientific Caveats

* **Mars Spherical CRS:** Uses Mars spherical longitude/latitude coordinates with radius $r = 3,396,190\text{ m}$ ($3396.190\text{ km}$). Cell dimensions are in degrees, distances in $\text{km}$, and cell areas in $\text{km}^2$. Do not interpret these coordinates as Earth `WGS84`.
* **Catalog Ellipsoid Isolation:** The broader source catalog contains projected GDB layers in meters, a map-footprint layer on a different Mars ellipsoid, and unresolved polar raster CRS definitions—do not silently merge them with the spherical routing layers.
* **Dual-Geometry Pipeline:** Display vectors are simplified using topology-preserving tolerance $0.025^\circ$, whereas backend risk queries use separate full, unsimplified geometries. Overlapping geology polygons resolve to the **highest** category score rather than an area-weighted average.
* **Hillshade Raster:** Reprojected from Robinson CRS to the Mars sphere and bilinearly resampled to $1800 \times 900$ pixels; brightness represents visual shading intensity, not elevation or slope.
* **Scale & Missing Telemetry Limits:** At $1:20,000,000$ scale, the dataset cannot resolve local rover-scale obstacles. No local DEM, slope, radiation, temperature, weather, rock-size, or soil-bearing-strength inputs exist in this model, and no $DF$ score or route is certified for real Mars exploration.
* **Legacy Compatibility Note:** Original source attributes remain isolated from derived risk values and simulated events. The legacy prototype `ComputeDF` and random generator remain in compatibility source (`backend/Prototype`) but are not used to populate the geographic risk grid.

---

## 12. API and Reproducibility Reference

**Local API Prefix:** `http://localhost:18220/mars-pathfinder/api/mars`

| Method & Endpoint | Purpose |
| :--- | :--- |
| `GET /summary` | Catalog metadata, model definitions, and capabilities |
| `GET /layers/{id}/features` | Simplified display GeoJSON for `layer-02` through `layer-05` |
| `GET /inspect?latitude=0&longitude=0` | Location geological evidence, scores, and unknown input flags |
| `POST /grid` | Generate a source-derived risk grid |
| `POST /route` | Compute a route with optional replayed event history |
| `POST /event` | Apply a simulated hazard event and return old/new routes and updated grid |
| `POST /lab` | Run supported synthetic algorithm comparison fixtures |

### Example `POST /event` Request

```json
{
  "route": {
    "algorithm": "astar",
    "startLat": -5,
    "startLng": -10,
    "endLat": 5,
    "endLng": 10,
    "grid": {
      "startLat": -10,
      "endLat": 10,
      "startLng": -20,
      "endLng": 20,
      "rows": 10,
      "columns": 10
    }
  },
  "events": [],
  "seed": 42,
  "travelerPathIndex": 3
}
```

* `travelerPathIndex` is optional (zero-based index along the reconstructed route, strictly before the destination). After traveler movement, subsequent requests must supply the moved cell center as `route.startLat` / `route.startLng` along with the returned `events` history (handled automatically by the UI).
* Responses return `grid`, `oldRoute`, `newRoute`, `event`, and `events` (each stored event records `row`, `col`, `factor`, and `delta`).
* An optional `seed` supports repeatable sampling for identical inputs on a compatible runtime; exact replay requires retaining event increments, bounds/resolution, algorithm, effective origin, destination, and matching source data.
* Up to $50$ events are permitted per session. There is no scenario save/import UI or persistent database; reloading the page resets state.

---

## 13. Troubleshooting

| Symptom | What to Check |
| :--- | :--- |
| `node` is not recognized | Reopen PowerShell after installation and add `C:\Program Files\nodejs` to `$env:Path`. |
| `npm.ps1` cannot be loaded | Use `npm.cmd` and `pnpm.cmd` instead of weakening your PowerShell execution policy. |
| `pnpm.cmd` is not recognized | Add the folder printed by `npm.cmd config get prefix` to `$env:Path`. |
| `sh` is not recognized during install | Install Git for Windows and add `C:\Program Files\Git\usr\bin` to `$env:Path`. |
| Missing `@rollup/rollup-win32-x64-msvc` or native modules | Remove the four Windows $\text{x64}$ exclusions from `pnpm-workspace.yaml` and run `pnpm.cmd install --no-frozen-lockfile`. |
| Vite reports `PORT` or `BASE_PATH` is missing | Set the frontend environment variables in the same PowerShell window that runs Vite. |
| API startup reports missing catalog or geometry files | Restore all eight runtime files from `NASA_Pathfinder_Local_Data.zip` at their exact root-relative paths. |
| Workspace data root unavailable | Retain the complete workspace directory tree, including `research` (do not copy `backend` alone). |
| Map shows an error reading length / API returns HTML | Confirm both processes are running, set `$env:LOCAL_API_PROXY = "1"`, and restart Vite. |
| Proxy works but map remains stale | Refresh the browser and inspect both PowerShell windows for errors. |
| `No route` returned | Check bounds, midpoint geology coverage, and accumulated forbidden event origins ($B$ may be closed). |
| Safe route still enters a purple neighbor | Residuals are passable weighted costs, not closures; only central event cells are strictly forbidden. |
| Amber path crosses red event cells | The amber path is historical and infeasible; follow the solid blue route only. |
| Changing controls removes the active scenario | Expected invalidation behavior whenever grid bounds, resolution, endpoints, or algorithm change. |
| Another process occupies port `18219` or `18220` | Run `Get-NetTCPConnection -LocalPort 18219,18220` and stop only the conflicting process you recognize. |

### Verify Frontend Proxy Content Type

```powershell
$r = Invoke-WebRequest -UseBasicParsing "http://localhost:18219/mars-pathfinder/api/mars/layers/layer-03/features"
$r.Headers["Content-Type"]
```

This must return `application/json`, not `text/html`. Current source includes the conditional proxy in `vite.config.ts`.

---

## 14. Developer Checks and Maintenance

Run verification suites from the workspace root:

```powershell
# C# backend verification checks
dotnet run --project ".\artifacts\mars-pathfinder\tests\Mars.Checks.csproj"

# Frontend TypeScript typechecking
pnpm.cmd --filter @workspace/mars-pathfinder run typecheck

# Frontend scenario unit tests
pnpm.cmd --filter @workspace/scripts exec tsx --test artifacts/mars-pathfinder/src/lib/scenario.test.ts
```

Optional live API integration checks require Python and a running backend on port `18220`:

```powershell
$env:MARS_TEST_BASE_URL = "http://localhost:18220/mars-pathfinder/api/mars"
python ".\artifacts\mars-pathfinder\tests\scenario_api_checks.py"
```

* Automated checks validate prototype parity, factor formulas, residual bounds, immutable baseline evidence, forbidden origins, detours, blocked endpoints, disconnected routes, traveler suffixes, and cumulative replay (passing tests establish implementation consistency, not scientific validity).
* If you modify `lib/api-spec/openapi.yaml`, regenerate the shared React API client:
  ```powershell
  pnpm.cmd --filter @workspace/api-spec run codegen
  ```
* Keep original planetary observations strictly separated from derived risk scores and simulated events, and document any algorithm or objective changes. Large source/derived data archives and generated documentation exports are excluded from Git and must be retained or regenerated separately.

---

## 15. Scope of Local Operation & Production Notes

* The two-process procedure above runs the Mars map and REST API locally; it does not automatically launch the separate Source Explorer, regenerate missing export archives, or publish the application.
* Runtime scientific assets are local files excluded from deployment. A production deployment requires durable object/file storage for the planetary assets and an appropriate production C# hosting configuration (a static frontend build alone is not the complete software).
* Keep this `README.md`, the project technical guide, in-app **Methods & limits**, and executable model definitions synchronized whenever factor rules, event behavior, or startup requirements change.
