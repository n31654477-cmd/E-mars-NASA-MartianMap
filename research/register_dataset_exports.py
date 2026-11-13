"""Register generated file deliverables in the existing export index."""
import json
from pathlib import Path

base=Path(__file__).resolve().parents[1]
out=base/"artifacts/nasa-data-explorer/public/data"
entries=[
    ("NASA_Dataset.xlsx","NASA_Canonical_Dataset/NASA_Dataset.xlsx","46-sheet exact-value spreadsheet; read Read_Me first."),
    ("NASA_Dataset_Reference.docx","NASA_Canonical_Dataset/NASA_Dataset_Reference.docx","Dataset guide, complete PDF page text, source metadata, CRS/units and document-volume index."),
    ("NASA_Documents.zip","NASA_Documents.zip","Reference document plus 23 full-record GIS attribute document appendices."),
    ("NASA_Dataset.sqlite","NASA_Canonical_Dataset/NASA_Dataset.sqlite","Portable SQLite dataset retaining exact JSON values and source/page identifiers."),
    ("NASA_Complete_Dataset.zip","NASA_Complete_Dataset.zip","Complete package with Word documents, workbook, SQLite, CSV/JSONL, geometry, PDFs, originals and portable validation."),
    ("NASA_validation_result.json","NASA_Canonical_Dataset/validation-result.json","Integrity and cross-format validation result."),
]
names={e[0] for e in entries}
index=json.loads((out/"export-index.json").read_text())
index=[e for e in index if e["name"] not in names]
for name,rel,desc in reversed(entries):
    source=base/"generated-artifacts"/rel
    if not source.is_file():raise RuntimeError("Missing deliverable "+str(source))
    target=out/name
    if target.exists() or target.is_symlink():target.unlink()
    target.symlink_to(source)
    index.insert(0,dict(name=name,url="data/"+name,size=source.stat().st_size,description=desc))
(out/"export-index.json").write_text(json.dumps(index,indent=2))
print("Registered",len(entries),"dataset deliverables")
