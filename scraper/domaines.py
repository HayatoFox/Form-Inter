"""Classification des sessions en domaines homogènes inter-organismes.

Chaque site a sa propre nomenclature (« Levage et Manutention », « R.482 »,
« Formations habilitation électrique »…) : `classer()` la ramène à une liste
courte de domaines communs, utilisée par la colonne `domaine` de la base.
La colonne `type_formation` conserve le libellé d'origine du site.

L'ordre des règles compte (ex. « EPI antichute » doit tomber en Travail en
hauteur avant que « EPI » seul ne tombe en Incendie).
"""

import re
import unicodedata

REGLES = [
    ("Formation de formateur", r"formateur|formatrice"),
    ("Secourisme", r"\bsst\b|secouris|premiers secours|defibrill"),
    ("AIPR", r"\baipr\b"),
    ("CACES / Conduite d'engins", r"\br\.?4\d{2}\b|caces|gerbeur|nacelle|chariot|"
     r"ponts? roulants?|grue|engins? de chantier|levage|manutention|\bpemp\b|"
     r"elingage|\bvgp\b"),
    ("Espaces confinés (CATEC)", r"catec|espaces? confine"),
    ("Ferroviaire", r"ferroviaire|secufer|\brfn\b"),
    ("Travail en hauteur", r"hauteur|harnais|echafaud|antichute|cordiste"),
    ("Incendie", r"incendie|ssiap|extincteur|evacuation|guide.file|serre.file|"
     r"\bepi\b|permis feu"),
    # les intitulés en codes purs (« B1v-B2v-BR-BC-BE », « Complément BS-BE ») :
    ("Habilitations électriques", r"habilitation|electri|photovolta|\birve\b|"
     r"nf.?c.?18|\bb[012]v?l?\b|\bbrl?\b|\bbcl?\b|\bbs\b|\bbel?\b|\bh[012]v?\b|\bhc\b"),
    ("Gestes et postures / Ergonomie", r"gestes (et|&) postures|ergonomi|\btms\b|"
     r"travail sur ecran"),
    ("Risques psychosociaux / Conflits", r"psychosocia|\brps\b|incivilit|conflit|"
     r"braquage|harcele"),
    ("CSE / CSSCT", r"\bcse\b|cssct|\bcst\b"),
    ("Risques chimiques", r"chimique"),
    ("Hygiène alimentaire", r"hygiene alimentaire|haccp"),
]

_COMPILEES = [(domaine, re.compile(motif, re.I)) for domaine, motif in REGLES]

AUTRE = "Autre"


def _normaliser(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn").lower()


def classer(formation: str | None, type_formation: str | None = None) -> str:
    """Domaine commun d'une session : l'intitulé prime, la catégorie du site
    sert de repli."""
    for texte in (formation, type_formation):
        if not texte:
            continue
        texte = _normaliser(texte)
        for domaine, motif in _COMPILEES:
            if motif.search(texte):
                return domaine
    return AUTRE
