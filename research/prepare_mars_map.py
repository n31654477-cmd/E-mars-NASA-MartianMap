"""Explicit display derivatives; originals and exact query geometry remain unchanged."""
import json, pathlib, gzip
import shapely
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds
import numpy as np
import shapefile
import pyogrio
from PIL import Image

root = pathlib.Path(__file__).resolve().parents[1]
source = root / "artifacts/nasa-data-explorer/public/data"
out = root / "generated-artifacts/mars-map"
out.mkdir(parents=True, exist_ok=True)
catalog = json.loads((source / "catalog.json").read_text())
for lid in ["layer-02", "layer-03", "layer-04", "layer-05"]:
    records = json.loads((source / f"{lid}-records.json").read_text())
    print(lid, type(records), flush=True)
    if isinstance(records, dict):
        records = records["records"]
    byid = {r["_source"]["featureId"]: r for r in records}
    features, exact = [], []
    layer = next(l for l in catalog["layers"] if l["id"] == lid)
    _, fids, geometries, _ = pyogrio.raw.read(str(root / "generated-artifacts/nasa-originals" / layer["source"]), return_fids=True)
    for fid, wkb in zip(fids, geometries):
            fid = int(fid)
            geom = shapely.from_wkb(wkb)
            props = byid[fid]
            features.append({"type": "Feature", "id": fid, "properties": props,
                             "geometry": shapely.geometry.mapping(geom.simplify(0.025, preserve_topology=True)) if geom is not None else None})
            if lid in ["layer-03", "layer-05"]:
                exact.append({"wkb": geom.wkb_hex, "properties": props})
    (out / f"{lid}.json").write_text(json.dumps({"type": "FeatureCollection", "features": features}))
    if exact:
        (out / ("geology-exact.json" if lid == "layer-03" else "structures-exact.json")).write_text(json.dumps(exact))
hill = next(x for x in catalog["rasters"] if x["name"] == "MOLA_Hillshade_Robinson_128ppd.tif")
with rasterio.open(root / "generated-artifacts/nasa-originals" / hill["source"]) as src:
    image = np.zeros((900, 1800), dtype="uint8")
    reproject(rasterio.band(src, 1), image, src_transform=src.transform, src_crs=src.crs,
              dst_transform=from_bounds(-180,-90,180,90,1800,900),
              dst_crs="+proj=longlat +R=3396190 +no_defs", resampling=Resampling.bilinear)
    Image.fromarray(image).save(out / "hillshade.png")
print("Created display-only 0.025-degree simplified vectors and bilinear hillshade; exact geology WKB retained for queries.")
