"""Create exact-value XLSX, DOCX volumes, CSV/JSONL and a portable SQLite dataset."""
from pathlib import Path
import csv, gzip, hashlib, json, shutil, sqlite3, sys, zipfile, platform
import importlib.metadata as packages
import xlsxwriter
from xlsxwriter.utility import xl_rowcol_to_cell
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from verify_dataset import canonical, digest_file, verify

BASE=Path(__file__).resolve().parents[1]
DATA=BASE/"artifacts/nasa-data-explorer/public/data"
RAW=BASE/"generated-artifacts/nasa-originals"
OUT=BASE/"generated-artifacts/NASA_Canonical_Dataset"
OUT.mkdir(parents=True,exist_ok=True)
for folder in ["documents","jsonl","csv","dbf_lexical","pdf","metadata","geometry","reproducibility"]:
    (OUT/folder).mkdir(exist_ok=True)
C=json.loads((DATA/"catalog.json").read_text())

# Pin the exact input snapshot and reject absent or changed raw sources.
for f in C["inventory"]:
    if not f.get("size"):continue
    p=RAW/f["path"]
    if not p.is_file() or p.stat().st_size!=int(f["size"]) or digest_file(p)!=f["sha256"]:
        raise RuntimeError("Original source missing or changed: "+f["path"])
print("Verified all original source hashes",flush=True)

SCHEMA={
 "version":"1.0","encoding":"UTF-8",
 "cellEncoding":"Every data cell is a JSON literal stored as Excel text, except headers. Decode with JSON to recover its exact type. Quoted strings remain distinct from numbers, null, booleans and empty strings.",
 "longCells":"JSON literals longer than 30000 characters are stored as @CELL:id references. Concatenate Cell_Chunks rows ordered by part, then JSON-decode. No value is silently truncated.",
 "numericPrecision":"Typed values retain the collected JSON reader representation. Original DBF fixed-width strings retain original spelling and padding separately. Excel performs no numeric coercion or automatic formulas.",
 "geometry":"Original-coordinate WKB hexadecimal records are retained separately in geometry/*.jsonl.gz. Neither WKB nor raw raster pixels fit meaningfully into Excel or Word; source files and indexed companions are authoritative.",
 "pdf":"Page text, source words and bounding boxes are retained; no claim of verified semantic table reconstruction or graph digitization.",
 "locations":"Physical PDF page numbers are 1-based. Word coordinates are PDF points (72 points/inch). Features retain source-local IDs.",
 "missing":"JSON null is missing; JSON empty string is present but empty. Neither is silently replaced by zero.",
 "overlap":"Shapefile and geodatabase source versions remain separate. Summed record counts are not unique feature counts.",
 "validation":"verify_dataset.py fails with nonzero exit on missing/changed files, record-count mismatch, SQLite integrity problems, or workbook/document round-trip mismatch.",
 "scope":"All collected data are retained. Unsupported ArcMap semantic content, unresolved raster CRS and ambiguous PDF layouts remain explicitly flagged; software cannot promise never to fail."
}
(OUT/"schema.json").write_text(json.dumps(SCHEMA,ensure_ascii=False,indent=2))
(OUT/"catalog.json").write_text(json.dumps(C,ensure_ascii=False))

con=sqlite3.connect(OUT/"NASA_Dataset.sqlite")
con.executescript("""
DROP TABLE IF EXISTS sources; DROP TABLE IF EXISTS layers; DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS pdf_pages; DROP TABLE IF EXISTS pdf_words; DROP TABLE IF EXISTS raw_dbf;
DROP TABLE IF EXISTS metadata; DROP TABLE IF EXISTS rasters; DROP TABLE IF EXISTS issues;
CREATE TABLE sources(id TEXT PRIMARY KEY, path TEXT, metadata_json TEXT NOT NULL);
CREATE TABLE layers(id TEXT PRIMARY KEY, name TEXT, source TEXT, crs TEXT, units TEXT, descriptor_json TEXT NOT NULL);
CREATE TABLE records(layer_id TEXT, ordinal INTEGER, feature_id TEXT, record_json TEXT NOT NULL, PRIMARY KEY(layer_id,ordinal));
CREATE TABLE pdf_pages(filename TEXT,page INTEGER,text TEXT NOT NULL,metadata_json TEXT,PRIMARY KEY(filename,page));
CREATE TABLE pdf_words(filename TEXT,page INTEGER,ordinal INTEGER,word_json TEXT,PRIMARY KEY(filename,page,ordinal));
CREATE TABLE raw_dbf(layer_id TEXT,ordinal INTEGER,record_json TEXT,PRIMARY KEY(layer_id,ordinal));
CREATE TABLE metadata(name TEXT PRIMARY KEY,text TEXT,descriptor_json TEXT);
CREATE TABLE rasters(name TEXT PRIMARY KEY,descriptor_json TEXT);
CREATE TABLE issues(ordinal INTEGER PRIMARY KEY,descriptor_json TEXT);
""")

wb=xlsxwriter.Workbook(OUT/"NASA_Dataset.xlsx",{"constant_memory":True,"strings_to_formulas":False,"strings_to_urls":False})
header=wb.add_format({"bold":True,"bg_color":"#763B2D","font_color":"#FFFFFF","text_wrap":True})
textfmt=wb.add_format({"num_format":"@","font_name":"Consolas","font_size":10})
sheet_specs=[];chunks=[];next_cell_id=0
def cell_value(v):
    global next_cell_id
    s=canonical(v)
    if len(s)<=30000:return s
    next_cell_id+=1;cid=str(next_cell_id)
    parts=[s[i:i+28000] for i in range(0,len(s),28000)]
    for i,t in enumerate(parts):chunks.append([cid,i+1,len(parts),t])
    return "@CELL:"+cid

def sheet(name,headers,rows,encode=True):
    ws=wb.add_worksheet(name);ws.freeze_panes(1,0);ws.set_row(0,32)
    ws.set_column(0,len(headers)-1,24,textfmt)
    digest=hashlib.sha256();count=0
    for ri,values in enumerate([headers] if rows is None else []):pass
    def write_row(ri,values,heading=False):
        vals={}
        for ci,v in enumerate(values):
            s=str(v) if heading or not encode else cell_value(v)
            rc=ws.write_string(ri,ci,s,header if heading else textfmt)
            if rc:raise RuntimeError(f"Excel write error {rc}: {name}:{ri}:{ci}")
            vals[xl_rowcol_to_cell(ri,ci)]=s
        digest.update((canonical(vals)+"\n").encode())
    write_row(0,headers,True)
    for ri,row in enumerate(rows or [],1):
        if ri>=1048575:raise RuntimeError("Sheet row limit exceeded: "+name)
        write_row(ri,row);count=ri
    ws.autofilter(0,0,count,len(headers)-1)
    sheet_specs.append(dict(name=name,xmlPath=f"xl/worksheets/sheet{len(sheet_specs)+1}.xml",rows=count+1,logicalSha256=digest.hexdigest()))

sheet("Read_Me",["Topic","Rule"],list(SCHEMA.items()))
sheet("Coverage",["Metric","Count"],list(C["summary"].items()))
sheet("Files",["Filename","Path","Format","Drive MIME","Bytes","SHA256","Source URL"],
      [[f["name"],f["path"],f["format"],f["mimeType"],f.get("size"),f.get("sha256"),f["webViewLink"]] for f in C["inventory"]])
sheet("Layer_Index",["Sheet","Layer ID","Layer name","Source","Count","Geometry","Units","CRS WKT","Source URL"],
      [[f"L{i+1:02}",l["id"],l["name"],l["source"],l["count"],l["geometryType"],l["units"],l["crs"],l["sourceUrl"]] for i,l in enumerate(C["layers"])])
sheet("Field_Dictionary",["Layer ID","Source","Layer","Field","Reader type","Units note"],
      [[l["id"],l["source"],l["name"],f["name"],f["type"],"km² (README, GEOLOGIC CONTENT)" if f["name"]=="SphArea_km" else "See source metadata; not automatically inferred from geometry units"] for l in C["layers"] for f in l["fields"]])
layer_specs=[];geometry_index=[]
for i,l in enumerate(C["layers"]):
    rows=json.loads((DATA.parent/l["recordsUrl"]).read_text())
    assert len(rows)==l["count"]
    names=[f["name"] for f in l["fields"]]
    cols=["source_filename","source_layer","source_feature_id"]+names
    sheet(f"L{i+1:02}",cols,[[r["_source"]["filename"],r["_source"]["layer"],r["_source"]["featureId"]]+[r.get(k) for k in names] for r in rows])
    rp=OUT/"jsonl"/(l["id"]+".jsonl")
    d=hashlib.sha256()
    with rp.open("w",encoding="utf-8",newline="\n") as out:
        for ordinal,r in enumerate(rows):
            s=canonical(r);out.write(s+"\n");d.update((s+"\n").encode())
            con.execute("INSERT INTO records VALUES(?,?,?,?)",(l["id"],ordinal,str(r["_source"]["featureId"]),s))
    with (OUT/"csv"/(l["id"]+".csv")).open("w",encoding="utf-8",newline="") as out:
        writer=csv.writer(out);writer.writerow(cols)
        for r in rows:writer.writerow([canonical(r["_source"]["filename"]),canonical(r["_source"]["layer"]),canonical(r["_source"]["featureId"])]+[canonical(r.get(k)) for k in names])
    con.execute("INSERT INTO layers VALUES(?,?,?,?,?,?)",(l["id"],l["name"],l["source"],l["crs"],l["units"],canonical(l)))
    # Complete searchable DOCX appendix, not merely samples.
    doc=Document();sec=doc.sections[0];sec.header.paragraphs[0].text="NASA · SIM3292 | Full attribute dataset"
    sec.left_margin=Inches(.65);sec.right_margin=Inches(.65)
    normal=doc.styles["Normal"];normal.font.name="Calibri";normal.font.size=Pt(8);normal.paragraph_format.space_after=Pt(3)
    doc.add_heading(l["id"]+" — "+l["name"],0)
    doc.add_paragraph("Source: "+l["source"]+"\nLayer: "+l["name"]+"\nOriginal source: "+l["sourceUrl"])
    doc.add_paragraph(f"Records: {l['count']}. Coordinate units: {l['units']}.")
    doc.add_paragraph("CRS WKT: "+l["crs"])
    doc.add_paragraph("Every original attribute is below in exact collected JSON representation. JSON quoting preserves null/empty distinctions and Unicode/control characters. Source-specific fixed-width DBF spellings are separate. No geometry coordinates are printed; complete WKB is supplied in the machine-readable package.")
    for r in rows:
        p=doc.add_paragraph("RECORD_JSON: "+canonical(r))
    docname="documents/"+l["id"]+"_full_records.docx";doc.save(OUT/docname)
    layer_specs.append(dict(id=l["id"],name=l["name"],source=l["source"],records=len(rows),jsonl="jsonl/"+l["id"]+".jsonl",document=docname,recordsSha256=d.hexdigest()))
    lexical=DATA/(l["id"]+"-dbf-lexemes.json")
    if lexical.exists():
        raw=json.loads(lexical.read_text());shutil.copyfile(lexical,OUT/"dbf_lexical"/lexical.name)
        fields=["recordIndex","deletionFlag"]+[x[0] for x in raw["fields"]]
        sheet(f"DBF{i+1:02}",fields,[[r[k] for k in fields] for r in raw["records"]])
        for n,r in enumerate(raw["records"]):con.execute("INSERT INTO raw_dbf VALUES(?,?,?)",(l["id"],n,canonical(r)))
    if l.get("geometryUrl"):
        geom=DATA.parent/l["geometryUrl"];target=OUT/"geometry"/geom.name;shutil.copyfile(geom,target)
        with gzip.open(target,"rt") as stream:
            count=0
            for line in stream:
                g=json.loads(line);geometry_index.append([l["id"],g["filename"],g["layer"],g["featureId"],"geometry/"+geom.name,"WKB hex; no coordinate transformation"]);count+=1
        if count!=len(rows):raise RuntimeError("Geometry count mismatch "+l["id"])
    print("Exported",l["id"],len(rows),"records",flush=True)
sheet("Geometry_Index",["Layer ID","Filename","Layer","Feature ID","Companion path","Encoding"],geometry_index)

pdf_rows=[];word_rows=[]
for d in C["documents"]:
    for p in d["pages"]:
        layout=DATA/f"{Path(d['name']).stem}-p{p['page']}-layout.json"
        info=json.loads(layout.read_text());page_text=p["text"]
        pdf_rows.append([d["name"],p["page"],info.get("pageLabel"),page_text,d["sourceUrl"]+"#page="+str(p["page"]),"Physical 1-based page; original PDF text, not a verified semantic table"])
        con.execute("INSERT INTO pdf_pages VALUES(?,?,?,?)",(d["name"],p["page"],page_text,canonical(info)))
        for n,w in enumerate(info["words"]):
            word_rows.append([d["name"],p["page"],n,w[4],*w[:4],*w[5:],"PDF points (72/inch)"])
            con.execute("INSERT INTO pdf_words VALUES(?,?,?,?)",(d["name"],p["page"],n,canonical(w)))
sheet("PDF_Pages",["Filename","Physical page","Printed label","Complete text","Source URL","Status"],pdf_rows)
sheet("PDF_Words",["Filename","Physical page","Word ordinal","Text","x0","y0","x1","y1","Block","Line","Word","Units"],word_rows)
sheet("Raster_Index",["Filename","Source","Source URL","Metadata and pixel summaries","Notes"],
      [[r["name"],r["source"],r["sourceUrl"],r["metadata"],r["notes"]] for r in C["rasters"]])
sheet("Issues",["Severity","Source","Locator","Message"],
      [[i["severity"],i["source"],i["locator"],i["message"]] for i in C["issues"]])
sheet("Methods",["Number","Method"],[[i+1,v] for i,v in enumerate(C["methods"])])
sheet("Source_Metadata",["Filename","Source URL","Exact decoded text","Encoding"],
      [[m["name"],m["sourceUrl"],m["text"],m.get("encoding")] for m in C["metadata"]])
internal_index=json.loads((DATA/"gdb-internal-tables.json").read_text())
for table in internal_index:
    rs=json.loads((DATA.parent/table["url"]).read_text())
    sheet(table["name"][:31],["Original row JSON"],[[r] for r in rs])
sheet("Cell_Chunks",["Cell ID","Part","Total parts","Literal text fragment"],chunks,encode=False)
wb.close()
for f in C["inventory"]:con.execute("INSERT INTO sources VALUES(?,?,?)",(f["id"],f["path"],canonical(f)))
for m in C["metadata"]:con.execute("INSERT INTO metadata VALUES(?,?,?)",(m["name"],m["text"],canonical(m)))
for r in C["rasters"]:con.execute("INSERT INTO rasters VALUES(?,?)",(r["name"],canonical(r)))
for i,r in enumerate(C["issues"]):con.execute("INSERT INTO issues VALUES(?,?)",(i,canonical(r)))
con.commit();con.close()
print("Workbook and SQLite created",flush=True)

# All collected supplemental files, including layouts, image streams and metadata.
for f in DATA.iterdir():
    if not f.is_file() or f.is_symlink() or f.suffix==".zip" or f.name=="export-index.json":continue
    if "geometry.jsonl" in f.name or "-records.json" in f.name or "-dbf-lexemes" in f.name or f.name=="catalog.json":continue
    target=OUT/("pdf" if f.name.startswith(("sim3292_","Mars_PublishedGeologicMaps_1Mscale_greater-")) and f.suffix not in (".jsonl",) else "metadata")/f.name
    shutil.copyfile(f,target)

# Human-readable master document includes all PDF text and all source metadata.
doc=Document();sec=doc.sections[0];sec.header.paragraphs[0].text="NASA · SIM3292 | Dataset reference"
doc.styles["Normal"].font.name="Calibri";doc.styles["Normal"].font.size=Pt(10)
doc.add_heading("NASA / SIM3292\nSource-preserving dataset",0)
doc.add_paragraph("Document, spreadsheet, SQLite and lossless machine-readable companions")
doc.add_heading("Coverage and interpretation",1)
for k,v in C["summary"].items():doc.add_paragraph(f"{k}: {v}")
doc.add_paragraph("This is the collected snapshot, not a live Drive refresh. The package contains every collected value, with complete GIS attribute records in 23 separate document appendices. Raster pixels and full geometry remain in their native/lossless companions, not flattened into Word or Excel. Original files are provided as a separate unchanged archive.")
doc.add_paragraph("No process can guarantee zero failures. Integrity checks deliberately stop on detected changes or omissions. They validate preservation and consistency, not the scientific correctness of the original publications. PDF layouts/graphs have not been converted into verified semantic tables.")
doc.add_heading("How to read the spreadsheet accurately",1)
for k,v in SCHEMA.items():doc.add_paragraph(str(k)+": "+str(v))
doc.add_heading("Layer and document-volume index",1)
for i,l in enumerate(C["layers"]):
    doc.add_heading(l["id"]+" — "+l["name"],2)
    doc.add_paragraph(f"Source: {l['source']}\nSource URL: {l['sourceUrl']}\nCount: {l['count']}\nSpreadsheet: L{i+1:02}\nFull records: documents/{l['id']}_full_records.docx\nUnits: {l['units']}\nCRS WKT: {l['crs']}")
    doc.add_paragraph("Fields: "+canonical(l["fields"]))
    for n in l["notes"]:doc.add_paragraph(n,style="List Bullet")
doc.add_heading("Ambiguities and unsupported content",1)
for i in C["issues"]:doc.add_paragraph(f"[{i['severity']}] {i['source']} · {i['locator']}: {i['message']}")
doc.add_heading("Original-file inventory",1)
for f in C["inventory"]:doc.add_paragraph(f"{f['path']} | {f['format']} | {f.get('size','folder')} bytes\nSource: {f['webViewLink']}\nSHA256: {f.get('sha256','not applicable')}")
doc.add_heading("Raster metadata and original pixel summaries",1)
for r in C["rasters"]:
    doc.add_heading(r["name"],2);doc.add_paragraph("Source: "+r["source"]+"\n"+r["sourceUrl"])
    doc.add_paragraph(canonical(r["metadata"]))
    for n in r["notes"]:doc.add_paragraph(n)
doc.add_heading("Complete PDF page text",1)
for d in C["documents"]:
    doc.add_heading(d["name"],2)
    for p in d["pages"]:
        doc.add_heading(f"{d['name']} · physical PDF page {p['page']}",3)
        doc.add_paragraph(d["sourceUrl"]+"#page="+str(p["page"]))
        # JSON literal retains every newline and control character without XML loss.
        doc.add_paragraph("PAGE_TEXT_JSON: "+canonical(p["text"]))
doc.add_heading("Complete source metadata text",1)
for m in C["metadata"]:
    doc.add_heading(m["name"],2);doc.add_paragraph(m["sourceUrl"])
    doc.add_paragraph("METADATA_TEXT_JSON: "+canonical(m["text"]))
doc.save(OUT/"NASA_Dataset_Reference.docx")

readme="""NASA SIM3292 CANONICAL DATASET

START HERE
NASA_Dataset_Reference.docx: source-cited guide, complete PDF page text and metadata.
documents/: 23 complete GIS attribute-data DOCX appendices, not samples.
NASA_Dataset.xlsx: exact-text spreadsheet; read Read_Me and Layer_Index first.
NASA_Dataset.sqlite: portable read-only-queryable data, using lossless JSON text for values.
jsonl/ and csv/: separate per-layer records, with JSON literal values in CSV.
dbf_lexical/: exact fixed-width DBF strings, including decimal spelling/padding.
geometry/: complete original-coordinate WKB encoded as hexadecimal JSONL gzip.
pdf/: page layouts/words, original decoded drawing streams, embedded images and previews.
metadata/: collected metadata and internal geodatabase table exports.
originals/NASA-original-sources.zip: 208 unchanged files, including native raster pixels.

VALIDATE AFTER EXTRACTING THE ENTIRE PACKAGE
  python verify_dataset.py .
The verifier uses only standard-library Python. Missing files, changed hashes,
cross-format disagreement or count mismatches produce a FAIL and nonzero exit.
manifest.json is the trusted local checksum baseline, not an external digital signature.
Keep its original copy. A malicious change to both files and manifest is not detected.

REBUILD
The reproducibility folder contains the collection/extraction/build scripts and
the Python version/dependency lock snapshot. Rebuilding the document/spreadsheet
uses collected source JSON without repeating fragile PDF semantic interpretation.
The original Drive download is a snapshot; downloading a new version needs a new
manifest, a reviewed comparison, and explicit handling of changed schemas.

ACCURACY LIMITS
No reprojection, join, deduplication or unit conversion. Source versions remain
separate. Numeric records retain reader precision; DBF lexical strings are the
authority for exact source decimal spelling. Some raster CRS declarations cannot
be resolved. ArcMap display semantics and PDF graph/table interpretation are not
fully parsed. Automated checks never certify a scientific interpretation.
"""
(OUT/"README.txt").write_text(readme)
for name in ["build_dataset.py","verify_dataset.py","extract_nasa.py","finalize_nasa.py"]:
    shutil.copyfile(BASE/"research"/name,OUT/"reproducibility"/name)
shutil.copyfile(BASE/"research/verify_dataset.py",OUT/"verify_dataset.py")
for name in ["pyproject.toml","uv.lock"]:
    if (BASE/name).exists():shutil.copyfile(BASE/name,OUT/"reproducibility"/name)
(OUT/"reproducibility/runtime.json").write_text(json.dumps({"python":platform.python_version(),"packages":{n:packages.version(n) for n in ["xlsxwriter","openpyxl","python-docx","pymupdf","pyogrio","rasterio"]}},indent=2))
# Hard link avoids another 822 MiB workspace copy, while the deliverable archive embeds bytes.
(OUT/"originals").mkdir(exist_ok=True)
original_dest=OUT/"originals/NASA-original-sources.zip"
if not original_dest.exists():
    try:original_dest.hardlink_to(BASE/"generated-artifacts/NASA-original-sources.zip")
    except OSError:shutil.copyfile(BASE/"generated-artifacts/NASA-original-sources.zip",original_dest)

files=[]
for p in sorted(OUT.rglob("*")):
    if not p.is_file() or p.name in ("manifest.json","validation-result.json"):continue
    files.append(dict(path=p.relative_to(OUT).as_posix(),bytes=p.stat().st_size,sha256=digest_file(p)))
manifest=dict(formatVersion="1.0",coverage=C["summary"],files=files,workbookSheets=sheet_specs,layers=layer_specs)
(OUT/"manifest.json").write_text(json.dumps(manifest,indent=2))
result=verify(OUT)
(OUT/"validation-result.json").write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2),flush=True)

# A separate documents-only bundle keeps routine review downloads small.
with zipfile.ZipFile(BASE/"generated-artifacts/NASA_Documents.zip","w",zipfile.ZIP_DEFLATED,compresslevel=1) as z:
    z.write(OUT/"NASA_Dataset_Reference.docx","NASA_Dataset_Reference.docx")
    z.write(OUT/"README.txt","README.txt")
    for p in sorted((OUT/"documents").iterdir()):z.write(p,p.relative_to(OUT))
with zipfile.ZipFile(BASE/"generated-artifacts/NASA_Complete_Dataset.zip","w",zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:
    for p in sorted(OUT.rglob("*")):
        if p.is_file():z.write(p,p.relative_to(OUT),compress_type=zipfile.ZIP_STORED if p.suffix in (".zip",".gz",".jpg",".png",".docx",".xlsx") else zipfile.ZIP_DEFLATED)
print("Complete dataset and document bundle created",flush=True)
