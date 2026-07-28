"""Exports CSV et XLSX du résultat filtré (stdlib uniquement).

Le générateur XLSX écrit directement la structure OOXML minimale (zip
d'XML, chaînes inline, police Arial, en-tête bleu PROINSEC figé avec
autofiltre) — pas de dépendance openpyxl.
"""

import csv
import io
import zipfile
from xml.sax.saxutils import escape

COLONNES = ["organisme", "formation", "domaine", "type_formation", "ville",
            "date_debut", "date_fin", "duree_jours", "tarif", "remarque",
            "disponibilite", "url_programme", "source_url"]
LARGEURS = [16, 55, 26, 28, 26, 11, 11, 8, 30, 34, 22, 45, 45]


def _valeurs(ligne) -> list:
    return [ligne[c] for c in COLONNES]


def generer_csv(lignes) -> bytes:
    """CSV pour Excel FR : séparateur ';', BOM utf-8, garde anti-injection
    de formule (cellules commençant par = + - @)."""
    tampon = io.StringIO()
    ecrivain = csv.writer(tampon, delimiter=";", lineterminator="\r\n")
    ecrivain.writerow(COLONNES)
    for ligne in lignes:
        rangee = []
        for v in _valeurs(ligne):
            if isinstance(v, str) and v[:1] in ("=", "+", "-", "@"):
                v = "'" + v
            rangee.append(v)
        ecrivain.writerow(rangee)
    return tampon.getvalue().encode("utf-8-sig")


def _ref(col: int, ligne: int) -> str:
    lettres = ""
    col += 1
    while col:
        col, reste = divmod(col - 1, 26)
        lettres = chr(65 + reste) + lettres
    return f"{lettres}{ligne}"


def _cellule(col: int, ligne: int, valeur, style: int) -> str:
    if valeur is None:
        return ""
    r = _ref(col, ligne)
    if isinstance(valeur, (int, float)):
        return f'<c r="{r}" s="{style}"><v>{valeur}</v></c>'
    return (f'<c r="{r}" s="{style}" t="inlineStr"><is><t xml:space="preserve">'
            f'{escape(str(valeur))}</t></is></c>')


_STYLES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0072B1"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="2"><xf fontId="0" fillId="0" borderId="0"/>
<xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>'''

_WORKBOOK = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="sessions" sheetId="1" r:id="rId1"/></sheets></workbook>'''

_WB_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>'''

_CONTENT_TYPES = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>'''

_RELS = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>'''


def generer_xlsx(lignes) -> bytes:
    xml_lignes = ["<row r=\"1\">"
                  + "".join(_cellule(i, 1, nom, 1) for i, nom in enumerate(COLONNES))
                  + "</row>"]
    for n, ligne in enumerate(lignes, start=2):
        cellules = "".join(_cellule(i, n, v, 0)
                           for i, v in enumerate(_valeurs(ligne)))
        xml_lignes.append(f'<row r="{n}">{cellules}</row>')

    derniere = _ref(len(COLONNES) - 1, len(xml_lignes))
    cols = "".join(
        f'<col min="{i+1}" max="{i+1}" width="{w}" customWidth="1"/>'
        for i, w in enumerate(LARGEURS))
    feuille = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetViews><sheetView workbookViewId="0">'
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
        '</sheetView></sheetViews>'
        f'<cols>{cols}</cols>'
        f'<sheetData>{"".join(xml_lignes)}</sheetData>'
        f'<autoFilter ref="A1:{derniere}"/>'
        '</worksheet>')

    tampon = io.BytesIO()
    with zipfile.ZipFile(tampon, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", _CONTENT_TYPES)
        z.writestr("_rels/.rels", _RELS)
        z.writestr("xl/workbook.xml", _WORKBOOK)
        z.writestr("xl/_rels/workbook.xml.rels", _WB_RELS)
        z.writestr("xl/styles.xml", _STYLES)
        z.writestr("xl/worksheets/sheet1.xml", feuille)
    return tampon.getvalue()
