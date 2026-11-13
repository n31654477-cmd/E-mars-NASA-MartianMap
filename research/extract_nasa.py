"""Read-only extraction; source values remain separate, no CRS transformations."""
from pathlib import Path
import json, hashlib, re, gzip, base64, math, warnings
import numpy as np
import pyogrio, pyogrio.raw, shapefile, rasterio, pymupdf

ROOT = Path("generated-artifacts/nasa-originals")
OUT = Path("artifacts/nasa-data-explorer/public/data")
OUT.mkdir(parents=True, exist_ok=True)
INV = json.loads(Path("research/nasa-inventory.json").read_text())
BY_PATH = {f.get("path", f["name"]): f for f in INV}
catalog = dict(title="Mars · SIM 3292", description="Source-preserving extraction of the NASA Drive archive: Geologic Map of Mars, USGS SIM 3292.", folderUrl="https://drive.google.com/drive/folders/1_YTdDoegkGlp1WNHcIaHYWgwGUJmchQv",
               inventory=[], layers=[], documents=[], rasters=[], metadata=[], issues=[], methods=[])

def clean(v):
    if isinstance(v, bytes): return {"encoding":"base64","value":base64.b64encode(v).decode()}
    if isinstance(v, np.ndarray): return [clean(x) for x in v]
    if isinstance(v, np.generic): return clean(v.item())
    if isinstance(v, float) and not math.isfinite(v): return None
    if isinstance(v, dict): return {str(k):clean(x) for k,x in v.items()}
    if isinstance(v, (list,tuple)): return [clean(x) for x in v]
    if v is None or isinstance(v,(str,int,float,bool)): return v
    return str(v)

def write(name, data):
    (OUT/name).write_text(json.dumps(clean(data),ensure_ascii=False,allow_nan=False),encoding="utf-8")

def issue(source, locator, message, severity="warning"):
    catalog["issues"].append(dict(source=source,locator=locator,message=message,severity=severity))

def source(p): return BY_PATH[p.relative_to(ROOT).as_posix()]

def decode(b):
    try: return b.decode("utf-8"), "UTF-8"
    except UnicodeDecodeError: return b.decode("cp1252"), "Windows-1252 (fallback; no encoding declaration)"

def fmt(f):
    n=f["name"].lower()
    if "folder" in f["mimeType"]: return "Esri File Geodatabase" if n.endswith(".gdb") else "Folder"
    ext=n.split(".")[-1]
    return {"shp":"Esri Shapefile geometry","dbf":"dBASE attributes","prj":"CRS WKT","shx":"Shapefile index","sbn":"Spatial index","sbx":"Spatial index","mxd":"Esri ArcMap document","lyr":"Esri layer symbology","spx":"Geodatabase spatial index","atx":"Geodatabase attribute index","gdbtable":"Geodatabase table","gdbtablx":"Geodatabase table index","gdbindexes":"Geodatabase indexes","freelist":"Geodatabase free-space list","pdf":"PDF","xml":"XML metadata","txt":"Plain text","tif":"GeoTIFF raster","jpg":"JPEG raster","ovr":"Raster overview TIFF","rrd":"Raster overview","aux":"Raster auxiliary metadata","jgw":"JPEG world file","tfw":"TIFF world file"}.get(ext,"Geodatabase internal file")

for f in INV:
    entry={**f,"path":f.get("path",f["name"]),"format":fmt(f),"status":"Folder" if "folder" in f["mimeType"] else "Downloaded; byte count verified"}
    if f.get("size"):
        p=ROOT/entry["path"]
        h=hashlib.sha256()
        with p.open("rb") as s:
            for chunk in iter(lambda:s.read(1024*1024),b""): h.update(chunk)
        entry["sha256"]=h.hexdigest()
        assert p.stat().st_size==int(f["size"]), p
    catalog["inventory"].append(entry)
write("inventory.json",catalog["inventory"])

# Text metadata and world-file values, untouched except decoding to Unicode.
for p in sorted(ROOT.rglob("*")):
    if p.suffix.lower() in (".txt",".xml",".prj",".tfw",".jgw"):
        text,encoding=decode(p.read_bytes())
        catalog["metadata"].append(dict(name=p.relative_to(ROOT).as_posix(),sourceUrl=source(p)["webViewLink"],text=text,encoding=encoding))

# Every shapefile remains separate from every GDB layer, including auxiliary annotations.
sources=[(p,None) for p in sorted(ROOT.rglob("*.shp"))]
gdb=next(ROOT.rglob("*.gdb"))
sources += [(gdb,str(n)) for n,_ in pyogrio.list_layers(gdb)]
for idx,(p,layer) in enumerate(sources):
    label=layer or p.stem
    inf=pyogrio.read_info(p,layer=layer)
    meta,fids,geoms,arrays=pyogrio.raw.read(p,layer=layer,return_fids=True)
    fields=[str(n) for n in meta["fields"]]
    rows=[]
    for i,fid in enumerate(fids):
        rows.append({"_source":{"filename":p.name,"layer":label,"featureId":int(fid)},**{k:clean(a[i]) for k,a in zip(fields,arrays)}})
    lid=f"layer-{idx+1:02}"
    write(lid+"-records.json",rows)
    geometry_url=None
    if geoms is not None:
        geometry_url="data/"+lid+"-geometry.jsonl.gz"
        with gzip.open(OUT/(lid+"-geometry.jsonl.gz"),"wt",encoding="utf-8") as out:
            for fid,geom in zip(fids,geoms):
                out.write(json.dumps({"filename":p.name,"layer":label,"featureId":int(fid),"wkbHex":None if geom is None else geom.hex()})+"\n")
    crs=inf["crs"] or "Not applicable: nonspatial table"
    is_geo=crs.startswith("GEOGCS") or crs.startswith("GEOGCRS")
    units="degrees (angular)" if is_geo else ("meters (projected)" if inf["crs"] else "Not applicable")
    notes=["Original source retained separately; no reprojection, dissolve, join, deduplication, or geometry simplification.",
           "Feature IDs are source-local; shapefile FIDs are zero-based reader identifiers, GDB OBJECTIDs retain source IDs.",
           "Geometry serialized as WKB hexadecimal in gzip JSON Lines, retaining coordinates and source CRS; WKB serialization does not preserve storage-level topology or ArcGIS rendering."]
    if "SphArea_km" in fields: notes.append("SphArea_km is geodesic area in km² according to SIM3292_README.txt, GEOLOGIC CONTENT. Original field values retained; not recomputed.")
    if "Shape_Area" in fields: notes.append("Shape_Area and Shape_Length are stored attributes. Do not recalculate or assume their units follow the exported geometry CRS; projected GDB values are in m²/m, geographic exports can retain legacy measures.")
    if p.suffix==".shp":
        # Preserve fixed-width dBASE numeric lexemes, including decimal precision.
        dbf=p.with_suffix(".dbf")
        b=dbf.read_bytes(); count=int.from_bytes(b[4:8],"little"); start=int.from_bytes(b[8:10],"little"); width=int.from_bytes(b[10:12],"little")
        cols=[]; off=32
        while b[off]!=13:
            d=b[off:off+32];cols.append((d[:11].split(b"\0")[0].decode("ascii"),chr(d[11]),d[16],d[17]));off+=32
        lexical=[]
        for i in range(count):
            rec=b[start+i*width:start+(i+1)*width]; pos=1; row={"recordIndex":i,"deletionFlag":rec[:1].decode("ascii")}
            for name,typ,length,precision in cols:
                row[name]=rec[pos:pos+length].decode("cp1252");pos+=length
            lexical.append(row)
        write(lid+"-dbf-lexemes.json",{"source":dbf.name,"fields":cols,"records":lexical})
        notes.append(f"Exact fixed-width dBASE lexical values retained separately in data/{lid}-dbf-lexemes.json; Unicode strings use reader decoding, which may trim field padding.")
        issue(dbf.name,label,"DBF has no .cpg encoding sidecar. Reader decoding is "+str(inf["encoding"])+". Fixed-width raw DBF text retained separately; original file is authoritative.","info")
    catalog["layers"].append(dict(id=lid,name=label,source=p.relative_to(ROOT).as_posix(),sourceUrl=source(p)["webViewLink"],format=inf["driver"],count=len(rows),geometryType=inf["geometry_type"] or "Nonspatial table",crs=crs,units=units,fields=[{"name":n,"type":str(t)} for n,t in zip(fields,meta["dtypes"])],extent=clean(inf["total_bounds"]) if inf["total_bounds"] else [],recordsUrl="data/"+lid+"-records.json",geometryUrl=geometry_url,notes=notes,sample=rows[:3]))
    print("LAYER",label,len(rows),units,flush=True)

# Extract XML definitions/domains and all readable internal tables.
internal=[]
for n in ["GDB_Items","GDB_ItemTypes","GDB_ItemRelationships","GDB_ItemRelationshipTypes","GDB_SpatialRefs"]:
    try:
        m,f,g,a=pyogrio.raw.read(gdb,layer=n,return_fids=True)
        records=[{"fid":int(fid),**{str(k):clean(v[i]) for k,v in zip(m["fields"],a)}} for i,fid in enumerate(f)]
        write(n+".json",records);internal.append({"name":n,"records":len(records),"url":"data/"+n+".json"})
    except Exception as e: issue(gdb.name,n,"Internal table not exposed by the reader: "+str(e),"info")
write("gdb-internal-tables.json",internal)
catalog["metadata"].append(dict(name="SIM3292_geodatabase.gdb / extracted internal tables",sourceUrl=source(gdb)["webViewLink"],text=json.dumps(internal,indent=2)))

# All PDF text, words with page coordinates, graphics, embedded images and page previews.
for p in sorted(ROOT.rglob("*.pdf")):
    d=pymupdf.open(p); pages=[]; key=p.stem
    for i,page in enumerate(d):
        text=page.get_text("text",sort=False)
        image_name=f"{key}-p{i+1}.jpg"
        scale=min(1.3,1800/max(page.rect.width,page.rect.height))
        page.get_pixmap(matrix=pymupdf.Matrix(scale,scale),alpha=False).save(OUT/image_name)
        streams=[]
        for xref in page.get_contents():
            stream_name=f"{key}-p{i+1}-content-{xref}.bin.gz"
            with gzip.open(OUT/stream_name,"wb") as stream_file:
                stream_file.write(d.xref_stream(xref))
            streams.append({"xref":xref,"url":"data/"+stream_name})
        detail={"filename":p.name,"page":i+1,"pageLabel":page.get_label(),"pageBoundsPoints":list(page.rect),"text":text,"words":page.get_text("words"),"contentStreams":streams,"links":page.get_links(),"images":[]}
        for im in page.get_images(full=True):
            xref=im[0]
            try:
                image=d.extract_image(xref);name=f"{key}-image-{xref}.{image['ext']}"
                (OUT/name).write_bytes(image["image"])
                detail["images"].append({"xref":xref,"url":"data/"+name,"metadata":{k:v for k,v in image.items() if k!="image"}})
            except Exception as e: issue(p.name,f"page {i+1}, image {xref}",str(e))
        # pymupdf Point/Rect/Quad need explicit coordinate arrays.
        def convert(v):
            if isinstance(v,(pymupdf.Point,pymupdf.Rect,pymupdf.Quad)):return list(v)
            if isinstance(v,dict):return {k:convert(x) for k,x in v.items()}
            if isinstance(v,(list,tuple)):return [convert(x) for x in v]
            return clean(v)
        write(f"{key}-p{i+1}-layout.json",convert(detail))
        pages.append(dict(page=i+1,text=text,imageUrl="data/"+image_name))
    catalog["documents"].append(dict(name=p.name,sourceUrl=source(p)["webViewLink"],pageCount=len(d),pages=pages,notes=["Page citations use physical 1-based PDF pages; printed page numbers may differ.","Text extraction retains source strings, but reading order, line breaks, superscripts, ligatures and table alignment can be ambiguous. Page images and original PDF remain authoritative.","Layout JSON for each page includes words with bounding boxes in PDF points (72 points/inch), decoded PDF content streams, image references and links. Content streams retain vector commands but are not semantic map-feature datasets. Preview images are downsampled for viewing, not numerical data."]))
    write(key+"-pages.json",pages)
    issue(p.name,"all pages","Text layout is not a semantic table reconstruction. Map symbology, graphical correlations and plotted relationships require visual reading; not interpreted as new numeric datasets.","warning")
    print("PDF",p.name,len(d),flush=True)

# Read every raster band blockwise; do not materialize a >1 GB float array.
for p in sorted(ROOT.rglob("*")):
    if p.suffix.lower() not in (".tif",".jpg",".ovr",".rrd"):continue
    try:
        with rasterio.open(p) as r:
            bands=[]
            for band in range(1,r.count+1):
                minimum=None;maximum=None;valid=0;hist={}
                for _,window in r.block_windows(band):
                    a=r.read(band,window=window,masked=True).compressed()
                    if not a.size:continue
                    lo=clean(a.min());hi=clean(a.max());minimum=lo if minimum is None else min(minimum,lo);maximum=hi if maximum is None else max(maximum,hi);valid+=int(a.size)
                    if r.dtypes[band-1]=="uint8":
                        values,counts=np.unique(a,return_counts=True)
                        for v,c in zip(values,counts):hist[str(int(v))]=hist.get(str(int(v)),0)+int(c)
                bands.append(dict(band=band,dtype=r.dtypes[band-1],unit=r.units[band-1],description=r.descriptions[band-1],scale=r.scales[band-1],offset=r.offsets[band-1],nodata=clean(r.nodatavals[band-1]),colorInterpretation=r.colorinterp[band-1].name,observedMinimum=minimum,observedMaximum=maximum,validPixelCount=valid,histogram=hist))
            md=dict(driver=r.driver,width=r.width,height=r.height,count=r.count,crsWkt=r.crs.to_wkt() if r.crs else None,affineTransform=list(r.transform),bounds=list(r.bounds),resolution=list(r.res),tags=r.tags(),bandTags={str(b):r.tags(b) for b in range(1,r.count+1)},bands=bands,overviews=r.overviews(1),files=[Path(f).name for f in r.files])
            catalog["rasters"].append(dict(name=p.name,source=p.relative_to(ROOT).as_posix(),sourceUrl=source(p)["webViewLink"],metadata=md,notes=["No raster resampling, reprojection or pixel-value conversion performed. Pixel min/max/histogram are derived summaries from a complete band scan, not source metadata.","Hillshade pixels represent image intensity, not elevation. Band physical units are unspecified unless explicitly declared.","All pixel values are retained in the unchanged source raster in the original-file export. Overviews are identified separately and not treated as independent observations."]))
            if not r.crs:issue(p.name,"raster CRS","No embedded CRS resolved; world files supply placement only and do not by themselves identify the CRS.")
            print("RASTER",p.name,r.width,r.height,flush=True)
    except Exception as e:issue(p.name,"raster reader",str(e))

issue("SIM3292_README.txt","INTRODUCTION / Shapefiles","The general statement 'All GIS data are in Robinson ... meters' is not true of shapefile geometry. Per-file .prj declares geographic degrees. No harmonization applied.")
issue("SIM3292_geodatabase.gdb","annotation layers","Annotation polygons/attributes are readable, but ArcGIS-specific font, rendering, relationship and symbol semantics may not round-trip through GDAL. Original binary files and internal XML retained.")
issue("ArcMap .mxd / .lyr files","all documents and layer symbols","Proprietary ArcMap display documents cannot be fully interpreted here. Original bytes preserved; format is not Word despite Drive MIME labels. No claim of complete extraction of ArcGIS rendering or layout semantics.")
issue("Google Drive inventory","MIME types","Drive labels .spx as audio/ogg and .mxd as application/msword. In this archive these are GIS spatial indexes and ArcMap documents, respectively. Supplied MIME and inferred formats both retained.","info")
catalog["methods"]=[
    "Read-only Drive traversal, including all pages of each folder listing. Inventory includes the sim3292_database folder, all descendants and both sibling PDFs.",
    "Downloaded 208 files; checked local byte counts against Drive size metadata and calculated SHA-256. These hashes identify downloaded bytes; Drive MD5 was not requested.",
    "Original sources remain unchanged. GIS sources, source versions, tables, annotations, rasters and PDF pages are kept separate. No joins, reprojection, dissolve, deduplication, unit conversions or geometry simplification.",
    "GIS extraction uses GDAL/OpenFileGDB via pyogrio. All readable 18 geodatabase layers/tables and five shapefiles exported, including nonspatial Unit_Description. WKB encoding changes serialization only, not CRS or coordinates.",
    "JSON numbers use native reader precision and round-trippable serialization, without display rounding. Nulls are explicit; binary fields use labeled base64. DBF fixed-width source lexical values are separately retained to preserve padding/decimal spellings.",
    "Read text/XML/world files as UTF-8 when valid, otherwise Windows-1252 with encoding identified. Original source bytes remain authoritative.",
    "PDF extraction preserves text per physical page, words/bounds, decoded original PDF drawing content streams, links and available embedded image streams. Vector commands remain PDF syntax, not interpreted polygons or digitized scientific data. Preview JPEGs are downsampled for display. No OCR guesses or numerical digitization from map graphics.",
    "Raster metadata and complete-band min/max, pixel counts and uint8 histograms extracted blockwise. Original pixels remain in the unchanged source files; they are not converted to elevation.",
    "Large raw sources and complete exports are held separately from application code. This web report is a snapshot, not an automatic Drive sync.",
    "Scope limitation: all available files are preserved and readable data extracted; proprietary ArcMap rendering semantics and graphical scientific interpretation are not claimed as fully parsed."
]
catalog["summary"]=dict(fileCount=sum(bool(f.get("size")) for f in INV),folderCount=sum("folder" in f["mimeType"] for f in INV),totalBytes=sum(int(f.get("size",0)) for f in INV),layerCount=len(catalog["layers"]),recordCount=sum(l["count"] for l in catalog["layers"]),pdfPages=sum(d["pageCount"] for d in catalog["documents"]))
write("catalog.json",catalog)
Path("research/extraction-summary.json").write_text(json.dumps(clean({"summary":catalog["summary"],"layers":[{k:v for k,v in l.items() if k not in ("sample","fields","notes","crs")} for l in catalog["layers"]],"rasters":[{"name":r["name"],"metadata":r["metadata"]} for r in catalog["rasters"]],"issues":catalog["issues"]}),indent=2))
print("SUMMARY",catalog["summary"],flush=True)
