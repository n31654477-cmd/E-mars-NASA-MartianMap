---
name: Mars pathfinder requirements
description: User-required scope and scientific constraints for the Mars Surface Analysis and Safe Path Finder.
---

Inspect the complete supplied prototype before writing application code. Present its functionality, exact algorithms, preservation strategy, scientific-data mapping, proposed architecture, and compatibility issues for user review before implementation.

Preserve the prototype's exact pathfinding behavior, including neighbors, costs, heuristics, obstacles, reconstruction, objectives and tie-breaking. Do not substitute algorithms or introduce a balanced cost function. Ask for approval before any unavoidable behavior change.

Use C# ASP.NET Core Web API and a separate HTML/CSS/JavaScript frontend with an interactive 2D Mars map.

Use only source-supported measurements and danger thresholds. Missing data is neither zero nor safe. Keep originals separate from derivatives, document transformations, and maintain source/CRS/unit traceability.

The user subsequently requested an explicit weighted per-cell risk formula and safety function from the current data, with all factors and scores documented in Methods & limits. Experimental proxy costs and routes are allowed when clearly distinguished from measured or scientifically validated safety. Preserve the algorithm implementations; label analyst-chosen weights as assumptions, keep missing physical measurements unknown, and document assumed traversability. Synthetic test fixtures remain separate from the geographic map.

The user's “D-value increase” means increasing one existing factor at a cell, not changing factor weights or adding an unrelated penalty. Random-event scenarios must support manual map-area selection, area-dependent residual increases in at most eight neighboring cells, automatic rerouting, and differently colored old/new paths. Treat these as hypothetical changes to derived factors, never edited source observations.

The user requires route graphics to connect to the exact plotted endpoint dots. Preserve center-based routing accuracy by identifying any within-cell display connectors as schematic and uncosted rather than implying measured sub-cell safety.

The user also requires optional traveler placement on the current path **before** triggering a random event; rerouting then begins at that position and ends at B. With no position provided, preserve full-route event behavior. Once moved, later events must not return the traveler to A unless the scenario is reset.

Event-origin cells must be forbidden to every routing algorithm, not merely assigned a higher cost. Peripheral cells remain passable, but safe routing should prefer avoiding their increased risk. Closures accumulate until reset and represent hypothetical operational exclusions, not measured physical obstacles.

**Why:** The user rejected routes that entered the event's central cell and explicitly required it to be forbidden, while allowing peripheral cells for both fast and safe routes.

**Why:** The user explicitly defined D-value changes this way in the screenshot-based feature request and prioritizes prototype algorithm correctness and scientific accuracy over implementation convenience or visual appearance.

**How to apply:** Apply these requirements to the Mars pathfinder development, not merely the existing source-data explorer. Missing prototype source must not be replaced with guessed implementations.
