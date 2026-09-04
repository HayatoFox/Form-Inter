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
    # FORMA-SO n'écrit jamais le sigle : ses 90 sessions s'intitulent
    # « Autorisation d'intervention à proximité des réseaux (opérateur) »,
    # « Encadrement de chantiers de travaux (Encadrant) »… d'où la forme
    # développée, qui est le libellé réglementaire.
    ("AIPR", r"\baipr\b|proximite des reseaux"),
    ("CACES / Conduite d'engins", r"\br\.?4\d{2}\b|caces|gerbeur|nacelle|chariot|"
     r"ponts? roulants?|grue|engins? de chantier|levage|manutention|\bpemp\b|"
     r"elingage|\bvgp\b"),
    ("Espaces confinés (CATEC)", r"catec|espaces? confine"),
    ("Ferroviaire", r"ferroviaire|secufer|\brfn\b"),
    ("Travail en hauteur", r"hauteur|harnais|echafaud|antichute|cordiste"),
    ("Incendie", r"incendie|ssiap|extincteur|evacuation|guide.file|serre.file|"
     r"\bepi\b|permis feu"),
    # ATEX passe AVANT les habilitations électriques, et ce n'est pas un détail :
    # 63 des 71 sessions « ATEX - CERTIFICATION ISM-ATEX … ÉLECTRIQUE » tombaient
    # en habilitation électrique sur le seul mot « électrique ». Or une
    # certification ISM-ATEX porte sur le risque d'EXPLOSION ; « électrique » n'y
    # désigne que la famille de matériel couverte, pas un titre NF C 18-510.
    ("ATEX / Atmosphères explosives", r"\batex\b|atmosphere.{0,3}explosi|explosi"),
    # les intitulés en codes purs (« B1v-B2v-BR-BC-BE », « Complément BS-BE ») :
    ("Habilitations électriques", r"habilitation|electri|photovolta|\birve\b|"
     r"nf.?c.?18|\bb[012]v?l?\b|\bbrl?\b|\bbcl?\b|\bbs\b|\bbel?\b|\bh[012]v?\b|\bhc\b"),
    ("Gestes et postures / Ergonomie", r"gestes (et|&) postures|ergonomi|\btms\b|"
     r"travail sur ecran"),
    ("Risques psychosociaux / Conflits", r"psychosocia|\brps\b|incivilit|conflit|"
     r"braquage|harcele"),
    ("CSE / CSSCT", r"\bcse\b|cssct|\bcst\b"),
    ("Risques chimiques", r"chimique|\bari\b|appareil respiratoire"),
    ("Hygiène alimentaire", r"hygiene alimentaire|haccp"),
    # Arrivés avec INTERFORA IFAIP : la formation à la sécurité des salariés
    # des entreprises extérieures (référentiel DT40 / GIES) est le gros du
    # catalogue d'un centre de site chimique, et 578 sessions tombaient en
    # « Autre » faute de règle.
    ("Sécurité des entreprises extérieures (FSSEE)",
     r"\bfssee\b|\bgies\b|entreprises? exterieures?|plan de prevention"),
    # Arrivés avec SI Groupe : la sécurité privée a sa propre nomenclature de
    # sigles (titres à finalité professionnelle), qu'aucune règle ne couvrait.
    # SSIAP n'y figure pas : il est déjà pris plus haut par « Incendie », qui
    # est sa place — le SSIAP est un service de sécurité INCENDIE.
    ("Sécurité privée", r"\baps\b|\bassp\b|\bd2sp\b|\ba3p\b|"
     r"agent de prevention et de securite|surveillance humaine|"
     r"securite privee|palpation"),
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
