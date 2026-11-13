"""Portable, read-only dataset verifier. Uses only the Python standard library."""
import argparse, hashlib, json, sqlite3, sys, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "w":"http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

def digest_file(p):
    h=hashlib.sha256()
    with p.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024),b""):h.update(chunk)
    return h.hexdigest()

def canonical(v):
    return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False)

def verify(root):
    root=Path(root)
    manifest=json.loads((root/"manifest.json").read_text())
    checked=0
    for f in manifest["files"]:
        p=root/f["path"]
        if not p.is_file():raise ValueError("Missing required file: "+f["path"])
        if p.stat().st_size!=f["bytes"]:raise ValueError("Size mismatch: "+f["path"])
        if digest_file(p)!=f["sha256"]:raise ValueError("SHA-256 mismatch: "+f["path"])
        checked+=1
    # Recompute every workbook logical-cell digest, independent of Excel or openpyxl.
    with zipfile.ZipFile(root/"NASA_Dataset.xlsx") as z:
        for sheet in manifest["workbookSheets"]:
            h=hashlib.sha256();count=0
            with z.open(sheet["xmlPath"]) as stream:
                for _,node in ET.iterparse(stream,events=["end"]):
                    if node.tag.endswith("}row"):
                        values={}
                        for c in node.findall("m:c",NS):
                            if c.get("t")!="inlineStr":
                                raise ValueError("Unexpected non-text Excel cell "+c.get("r",""))
                            values[c.get("r")]="".join(c.itertext())
                        h.update((canonical(values)+"\n").encode())
                        count+=1
                        node.clear()
            if count!=sheet["rows"] or h.hexdigest()!=sheet["logicalSha256"]:
                raise ValueError("Workbook round-trip mismatch: "+sheet["name"])
    con=sqlite3.connect("file:"+str((root/"NASA_Dataset.sqlite").resolve())+"?mode=ro",uri=True)
    if con.execute("PRAGMA integrity_check").fetchone()[0]!="ok":raise ValueError("SQLite integrity failure")
    rows=0;document_rows=0
    for spec in manifest["layers"]:
        h=hashlib.sha256();n=0
        with (root/spec["jsonl"]).open() as stream:
            for line in stream:
                row=json.loads(line);text=canonical(row)
                h.update((text+"\n").encode());n+=1
                saved=con.execute("SELECT record_json FROM records WHERE layer_id=? AND ordinal=?",(spec["id"],n-1)).fetchone()
                if saved is None or saved[0]!=text:raise ValueError("SQLite/JSONL disagreement: "+spec["id"])
        if n!=spec["records"] or h.hexdigest()!=spec["recordsSha256"]:raise ValueError("Record coverage mismatch: "+spec["id"])
        # DOCX appendix contains one complete JSON record per paragraph.
        with zipfile.ZipFile(root/spec["document"]) as z:
            xml=ET.fromstring(z.read("word/document.xml"))
            texts=["".join(p.itertext()) for p in xml.findall(".//w:p",NS)]
            records=[t[len("RECORD_JSON: "):] for t in texts if t.startswith("RECORD_JSON: ")]
            dh=hashlib.sha256()
            for text in records:dh.update((text+"\n").encode())
            if len(records)!=n or dh.hexdigest()!=spec["recordsSha256"]:
                raise ValueError("Document/JSONL disagreement: "+spec["id"])
            document_rows+=len(records)
        rows+=n
    pages=con.execute("SELECT COUNT(*) FROM pdf_pages").fetchone()[0]
    if rows!=manifest["coverage"]["recordCount"] or pages!=manifest["coverage"]["pdfPages"]:
        raise ValueError("Global coverage mismatch")
    con.close()
    return {"status":"PASS","filesChecked":checked,"gisRecordsChecked":rows,
            "documentRecordsChecked":document_rows,"pdfPagesChecked":pages,
            "workbookSheetsChecked":len(manifest["workbookSheets"]),
            "limits":"Checks integrity and cross-format equality, not scientific interpretation or correctness of the original publications."}

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("directory",nargs="?",default=".")
    args=parser.parse_args()
    try:print(json.dumps(verify(args.directory),indent=2))
    except Exception as e:
        print(json.dumps({"status":"FAIL","error":str(e)},indent=2),file=sys.stderr)
        sys.exit(1)
