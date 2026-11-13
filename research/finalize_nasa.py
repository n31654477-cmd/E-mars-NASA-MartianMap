"""Create self-contained report and downloadable bundles after extraction."""
from pathlib import Path
import json, html, zipfile, os

out=Path("artifacts/nasa-data-explorer/public/data")
c=json.loads((out/"catalog.json").read_text())
c["issues"].extend([
    {"severity":"warning","source":"sim3292_pamphlet.pdf","locator":"physical PDF page 7 / Base Data","message":"The pamphlet describes input data registered to a spheroid (equatorial radius 3,396.19 km; polar radius 3,376.2 km), east-increasing longitude and planetocentric latitude. GIS CRS WKT uses a Mars sphere (inverse flattening 0). These descriptions concern different representations and are not silently treated as identical."},
    {"severity":"info","source":"sim3292_map.pdf","locator":"physical PDF page 1 / projection and scale captions","message":"Main map: Robinson pseudocylindrical projection with pole line; scale 1:20,000,000 (1 MM = 20.00 KM) at latitude ±38°. Polar maps: stereographic; 1:20,000,000 (1 MM = 20.00 KM) at ±90°, and 1:21,436,227 (1 MM = 21.44 KM) at ±60°. These are printed map scales, not replacements for GIS coordinate units."},
    {"severity":"warning","source":"web explorer snapshot","locator":"export persistence","message":"App Storage provisioning failed twice. Extracted data and original-source archives are retained locally and excluded from Git/deployment to avoid committing large assets. Download the bundles; publishing requires durable storage setup first."}
])
(out/"catalog.json").write_text(json.dumps(c,ensure_ascii=False))
h=html.escape
def cite(name,url,loc):
    return f'<a href="{h(url,quote=True)}">{h(name)}</a> · {h(loc)}'
parts=['''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>NASA folder — SIM3292 source extraction report</title><style>
body{max-width:1100px;margin:40px auto;padding:0 24px;font:15px/1.6 system-ui;color:#202826;background:#faf8f2}h1,h2,h3{color:#8d351f}table{border-collapse:collapse;width:100%;font-size:13px}th,td{padding:9px;border:1px solid #ccc;text-align:left;vertical-align:top}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f0ede5;padding:16px;font-size:12px}a{color:#1f635e}details{border-bottom:1px solid #ccc;padding:12px 0}.warning{background:#fff0d3;padding:18px}.src{font-size:12px;color:#555}code{overflow-wrap:anywhere}</style>
<h1>NASA folder — SIM3292 source extraction</h1>
<p>Read-only, source-preserving extraction. No datasets joined, no coordinates reprojected, no geometry simplified, and no stored measures recomputed.</p>''']
parts.append("<h2>Scope and coverage</h2><ul>")
for k,v in c["summary"].items():parts.append(f"<li>{h(k)}: <strong>{v}</strong></li>")
parts.append("</ul><p>Counts include both source versions. Record totals are not deduplicated scientific observations. The two requested sibling PDFs contribute 49 pages; the additional PDF inside the database contributes one more.</p>")
parts.append('<div class="warning"><strong>Limits:</strong> readable GIS attributes/geometries, metadata, all PDF text pages, word positions, embedded images, PDF drawing streams, and raster metadata/summaries are extracted. Proprietary ArcMap rendering semantics and graphical map relationships are not fully interpreted. Original files remain authoritative. The web explorer is a local snapshot; persistent App Storage provisioning failed, so it is not ready to publish with its data.</div>')
parts.append("<h2>Coordinate systems and units</h2><p>The README's broad Robinson/meters statement conflicts with the shapefile exports' geographic CRS. Per-layer declarations are retained. No CRS is silently assigned where absent.</p><table><tr><th>Source / layer</th><th>Features</th><th>Coordinate units</th><th>CRS</th></tr>")
for l in c["layers"]:
    parts.append(f'<tr><td>{cite(l["source"],l["sourceUrl"],l["name"])}</td><td>{l["count"]}</td><td>{h(l["units"])}</td><td><details><summary>Full source WKT</summary><pre>{h(l["crs"])}</pre></details></td></tr>')
parts.append("</table><p><strong>Attribute units:</strong> SphArea_km means geodesic area in km² per SIM3292_README.txt, GEOLOGIC CONTENT. Source Shape_Area/Shape_Length are stored measures, not recomputed from geographic exports. Do not infer that an exported attribute's units match geometry coordinates. Hillshade band values are image intensity, not elevation. PDF layout positions use points (72/inch), not geographic coordinates.</p>")
parts.append('<p><strong>Printed map CRS and scales:</strong> Robinson pseudocylindrical projection with pole line, 1:20,000,000 (1 MM = 20.00 KM) at lat ±38°. Polar stereographic maps: 1:20,000,000 (1 MM = 20.00 KM) at ±90°; 1:21,436,227 (1 MM = 21.44 KM) at ±60°. '+cite("sim3292_map.pdf",next(d["sourceUrl"] for d in c["documents"] if d["name"]=="sim3292_map.pdf"),"physical PDF page 1 / projection captions")+'</p>')
parts.append('<p><strong>Coordinate convention and spheroid:</strong> east-increasing longitude, planetocentric latitude; equatorial radius 3,396.19 km, polar radius 3,376.2 km. This source-data description differs from the spherical GIS WKT and is retained rather than reconciled. '+cite("sim3292_pamphlet.pdf",next(d["sourceUrl"] for d in c["documents"] if d["name"]=="sim3292_pamphlet.pdf"),"physical PDF page 7 / Base Data")+'</p>')
parts.append("<h2>Layer schemas and extraction notes</h2>")
for l in c["layers"]:
    parts.append(f'<details><summary>{h(l["source"])} — {h(l["name"])} ({l["count"]})</summary><p>{cite(l["source"],l["sourceUrl"],l["name"])}</p><pre>{h(json.dumps(l["fields"],indent=2))}</pre><ul>'+''.join(f"<li>{h(n)}</li>" for n in l["notes"])+"</ul></details>")
parts.append("<h2>Raster sources</h2>")
for r in c["rasters"]:
    parts.append(f'<details><summary>{h(r["name"])}</summary><p>{cite(r["source"],r["sourceUrl"],"raster header / full-band scan")}</p><pre>{h(json.dumps(r["metadata"],indent=2))}</pre><ul>'+''.join(f'<li>{h(n)}</li>' for n in r["notes"])+"</ul></details>")
parts.append("<h2>Ambiguities and limitations</h2><ul>")
for i in c["issues"]:parts.append(f'<li><strong>{h(i["severity"])} · {h(i["source"])} · {h(i["locator"])}</strong>: {h(i["message"])}</li>')
parts.append("</ul><h2>Methods and explained representation changes</h2><ol>"+''.join(f"<li>{h(m)}</li>" for m in c["methods"])+"</ol>")
parts.append("<h2>Complete recursive file inventory</h2><p>Drive MIME type and identified GIS format are both retained, including misleading MIME labels. SHA-256 identifies downloaded bytes; source sizes were checked.</p><table><tr><th>Path / source</th><th>Format</th><th>Drive MIME</th><th>Bytes</th><th>SHA-256</th></tr>")
for f in c["inventory"]:
    parts.append(f'<tr><td>{cite(f["path"],f["webViewLink"],"file")}</td><td>{h(f["format"])}</td><td>{h(f["mimeType"])}</td><td>{h(str(f.get("size","—")))}</td><td><code>{h(f.get("sha256","—"))}</code></td></tr>')
parts.append("</table><h2>Complete PDF page-text extraction</h2><p>Physical 1-based pages. Reading order is not a verified reconstruction of tables or graphs. All values remain as extracted, with no unit conversion. Word coordinates and original content streams are in the extraction bundle.</p>")
for d in c["documents"]:
    parts.append(f'<h3>{h(d["name"])}</h3>')
    for pg in d["pages"]:
        parts.append(f'<details><summary>{h(d["name"])} · PDF page {pg["page"]}</summary><p>{cite(d["name"],d["sourceUrl"]+"#page="+str(pg["page"]),f"physical PDF page {pg['page']}")}</p><pre>{h(pg["text"])}</pre></details>')
parts.append("<h2>Original metadata text</h2>")
for m in c["metadata"]:
    parts.append(f'<details><summary>{h(m["name"])}</summary><p>{cite(m["name"],m["sourceUrl"],"full text")}</p><pre>{h(m["text"])}</pre></details>')
parts.append("</html>")
report=Path("generated-artifacts/NASA-SIM3292-extraction-report.html")
report.write_text("".join(parts))
# Small persistent outputs kept in research; bulk outputs excluded from Git.
Path("research/extraction-coverage.json").write_text(json.dumps(c["summary"],indent=2))
with zipfile.ZipFile("generated-artifacts/NASA-extracted-data.zip","w",zipfile.ZIP_DEFLATED,compresslevel=1) as z:
    for p in out.rglob("*"):
        if p.is_file() and p.suffix!=".zip" and p.name!="export-index.json":z.write(p,p.relative_to(out))
    z.write(report,report.name)
    z.write("research/extract_nasa.py","reproducibility/extract_nasa.py")
index=[]
for p in sorted(out.iterdir()):
    if p.is_file() and p.name!="export-index.json":
        index.append(dict(name=p.name,url="data/"+p.name,size=p.stat().st_size,description="Extracted source data; filename and layer/page identifiers retained within the file."))
for name,desc in [("NASA-original-sources.zip","All 208 unchanged source files and Drive inventory."),("NASA-extracted-data.zip","Complete machine-readable extraction, report and extraction script."),("NASA-SIM3292-extraction-report.html","Self-contained source-cited inventory, CRS/units, limitations, schemas, raster metadata, and all PDF text.")]:
    dest=out/name
    if dest.exists() or dest.is_symlink():dest.unlink()
    dest.symlink_to((Path("generated-artifacts")/name).resolve())
    index.insert(0,dict(name=name,url="data/"+name,size=dest.stat().st_size,description=desc))
(out/"export-index.json").write_text(json.dumps(index))
print(json.dumps(c["summary"],indent=2))
print("Report, archives and export index created")
