---
name: Python native XML compatibility
description: Nix Expat version compatibility when reading GIS data with Python native extensions.
---
Python XML extensions and rasterio can resolve different incompatible Expat shared libraries in this environment. Installing Expat alone may leave an older library ahead of the version Python requires.

**Why:** Native GIS imports first failed with a missing library, then with a missing XML allocation-tracker symbol after an older Expat was found.

**How to apply:** Inspect the actually available library versions and use a current compatible Expat for the extraction process. Do not hardcode a remembered Nix store path: discover the current version. This is a process-scoped native-library compatibility issue, not a reason to rewrite datasets.
