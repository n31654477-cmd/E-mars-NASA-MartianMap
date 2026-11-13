---
name: Mars pathfinder requirements
description: User-required scope and scientific constraints for the Mars Surface Analysis and Safe Path Finder.
---

Inspect the complete supplied prototype before writing application code. Present its functionality, exact algorithms, preservation strategy, scientific-data mapping, proposed architecture, and compatibility issues for user review before implementation.

Preserve the prototype's exact pathfinding behavior, including neighbors, costs, heuristics, obstacles, reconstruction, objectives and tie-breaking. Do not substitute algorithms or introduce a balanced cost function. Ask for approval before any unavoidable behavior change.

Use C# ASP.NET Core Web API and a separate HTML/CSS/JavaScript frontend with an interactive 2D Mars map.

Use only source-supported measurements and danger thresholds. Missing data is neither zero nor safe. Keep originals separate from derivatives, document transformations, and maintain source/CRS/unit traceability.

**Why:** The user explicitly prioritizes prototype algorithm correctness and scientific accuracy over implementation convenience or visual appearance.

**How to apply:** Apply these requirements to the Mars pathfinder development, not merely the existing source-data explorer. Missing prototype source must not be replaced with guessed implementations.
