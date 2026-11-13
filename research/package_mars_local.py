"""Package only the runtime assets needed for the local Mars pathfinder preview."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import hashlib, json

root = Path(__file__).resolve().parents[1]
out = root / "generated-artifacts/NASA_Pathfinder_Local_Data.zip"
entries = [
    (root / "generated-artifacts/mars-map", Path("generated-artifacts/mars-map")),
    (root / "artifacts/nasa-data-explorer/public/data/catalog.json", Path("artifacts/nasa-data-explorer/public/data/catalog.json")),
]
files = []
for path, target in entries:
    if path.is_file():
        files.append((path, target))
    else:
        files.extend((p, target / p.relative_to(path)) for p in path.rglob("*") if p.is_file())
for path, _ in files:
    if path.is_symlink():
        raise SystemExit(f"Refusing to package symlink: {path}")
out.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(out, "w", compression=ZIP_DEFLATED, compresslevel=6) as z:
    for path, target in files:
        z.write(path, target.as_posix())
print(json.dumps({"archive": str(out.relative_to(root)), "files": len(files), "bytes": out.stat().st_size,
                  "sha256": hashlib.sha256(out.read_bytes()).hexdigest()}, indent=2))
