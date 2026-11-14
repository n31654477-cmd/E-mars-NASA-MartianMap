"""Export PROJECT_GUIDE.md to Word/PDF without changing the documentation source.

Requires python-docx and reportlab, for document generation only.
From workspace root: python artifacts/mars-pathfinder/docs/export_guide.py
Outputs are excluded from Git under generated-artifacts/documentation.
"""
from pathlib import Path
from html import escape
import re
import textwrap

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Preformatted, Table, TableStyle,
)


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = HERE / "PROJECT_GUIDE.md"
OUT = ROOT / "generated-artifacts" / "documentation"
OUT.mkdir(parents=True, exist_ok=True)


def blocks(text):
    """Parse only the documented Markdown subset used in this manual."""
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(lines[i])
                i += 1
            yield "code", "\n".join(code)
            i += 1
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in cells):
                    rows.append(cells)
                i += 1
            yield "table", rows
        elif line.startswith("#"):
            level = len(line) - len(line.lstrip("#"))
            yield f"h{level}", line[level:].strip()
            i += 1
        elif line.strip():
            if line.startswith("- "):
                yield "bullet", line[2:]
            else:
                yield "p", line
            i += 1
        else:
            i += 1


def plain(s):
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)
    return s.replace("**", "").replace("`", "")


content = list(blocks(SOURCE.read_text(encoding="utf-8")))

# Word output retains editable text and copyable PowerShell commands.
doc = Document()
section = doc.sections[0]
section.page_height, section.page_width = Inches(11.69), Inches(8.27)
section.top_margin = section.bottom_margin = Inches(.65)
section.left_margin = section.right_margin = Inches(.7)
normal = doc.styles["Normal"]
normal.font.name, normal.font.size = "Calibri", Pt(10)
normal.paragraph_format.space_after = Pt(6)
for name in ("Title", "Heading 1", "Heading 2", "Heading 3"):
    doc.styles[name].font.color.rgb = RGBColor.from_string("993D28")
footer = section.footer.paragraphs[0]
footer.text = "Mars Surface Analysis & Path Finder | Experimental model, not operational navigation"
footer.style = doc.styles["Caption"]
for kind, value in content:
    if kind.startswith("h"):
        level = int(kind[1:])
        doc.add_heading(plain(value), level=min(level, 3))
    elif kind == "table":
        table = doc.add_table(rows=0, cols=len(value[0]))
        table.style = "Light Shading Accent 1"
        for row in value:
            cells = table.add_row().cells
            for cell, text in zip(cells, row):
                cell.text = plain(text)
                for p in cell.paragraphs:
                    for run in p.runs:
                        run.font.size = Pt(9)
        doc.add_paragraph()
    elif kind == "code":
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(8)
        run = p.add_run(value)
        run.font.name, run.font.size = "Consolas", Pt(8)
    else:
        p = doc.add_paragraph(plain(value), style="List Bullet" if kind == "bullet" else None)
docx_path = OUT / "Mars_Pathfinder_Project_Guide.docx"
doc.save(docx_path)

# Embedded Unicode font avoids missing glyphs on exported PDF pages.
font_candidates = [
    Path("/usr/share/fonts/truetype/dejavu"),
    Path("/usr/share/fonts/dejavu"),
]
font_root = next((p for p in font_candidates if (p / "DejaVuSans.ttf").exists()), None)
if font_root:
    pdfmetrics.registerFont(TTFont("Guide", str(font_root / "DejaVuSans.ttf")))
    pdfmetrics.registerFont(TTFont("GuideBold", str(font_root / "DejaVuSans-Bold.ttf")))
    pdfmetrics.registerFontFamily("Guide", normal="Guide", bold="GuideBold",
                                  italic="Guide", boldItalic="GuideBold")
    font = "Guide"
else:
    font = "Helvetica"

styles = getSampleStyleSheet()
body = ParagraphStyle("GuideBody", fontName=font, fontSize=9, leading=13, spaceAfter=7,
                      splitLongWords=True)
headings = {
    1: ParagraphStyle("GuideH1", parent=body, fontSize=19, leading=24,
                      textColor=colors.HexColor("#993d28"), spaceBefore=16, spaceAfter=10, keepWithNext=True),
    2: ParagraphStyle("GuideH2", parent=body, fontSize=13, leading=18,
                      textColor=colors.HexColor("#993d28"), spaceBefore=14, keepWithNext=True),
    3: ParagraphStyle("GuideH3", parent=body, fontSize=10.5, leading=15,
                      spaceBefore=10, keepWithNext=True),
}
cell_style = ParagraphStyle("GuideCell", parent=body, fontSize=7.8, leading=11, spaceAfter=0)
code_style = ParagraphStyle("GuideCode", fontName="Courier", fontSize=7.3, leading=10,
                           leftIndent=5, spaceAfter=9)


def markup(s):
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", s)
    s = escape(s).replace("`", "")
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)


story = []
width = A4[0] - 84
for kind, value in content:
    if kind.startswith("h"):
        story.append(Paragraph(markup(value), headings.get(int(kind[1:]), headings[3])))
    elif kind == "code":
        # Wrap visually for PDF width; editable DOCX keeps original command text.
        wrapped = "\n".join(
            "\n".join(textwrap.wrap(line, width=106, replace_whitespace=False,
                                    drop_whitespace=False)) if line else ""
            for line in value.splitlines()
        )
        story.append(Preformatted(wrapped, code_style))
    elif kind == "table":
        cols = len(value[0])
        fractions = {2: [.40, .60], 3: [.43, .22, .35], 4: [.22, .30, .30, .18]}.get(cols)
        col_widths = [width*x for x in fractions] if fractions else [width/cols]*cols
        data = [[Paragraph(markup(cell), cell_style) for cell in row] for row in value]
        table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
        table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e9ded1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
            ("LINEBELOW", (0, 0), (-1, 0), .5, colors.HexColor("#993d28")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.extend([table, Spacer(1, 10)])
    else:
        text = ("• " if kind == "bullet" else "") + value
        story.append(Paragraph(markup(text), body))


def page_footer(canvas, document):
    canvas.saveState()
    canvas.setFont(font, 7)
    canvas.setFillColor(colors.HexColor("#555555"))
    canvas.drawString(42, 24, "Mars Pathfinder | Experimental model; not operational navigation")
    canvas.drawRightString(A4[0]-42, 24, str(document.page))
    canvas.restoreState()


pdf_path = OUT / "Mars_Pathfinder_Project_Guide.pdf"
SimpleDocTemplate(str(pdf_path), pagesize=A4, leftMargin=42, rightMargin=42,
                  topMargin=38, bottomMargin=42,
                  title="Mars Surface Analysis & Path Finder — Project Guide",
                  author="Mars Pathfinder project").build(
                      story, onFirstPage=page_footer, onLaterPages=page_footer)
for path in (docx_path, pdf_path):
    print(f"{path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")
