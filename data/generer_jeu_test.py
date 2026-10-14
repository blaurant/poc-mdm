# Génère un jeu de données de test fictif, au format EDN, simulant des extractions brutes des systèmes sources.
import datetime as dt

class Kw(str): pass
class Inst(str): pass

def edn(v, ind=0):
    p = ' ' * ind
    if v is None: return 'nil'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, Kw): return ':' + v
    if isinstance(v, Inst): return f'#inst "{v}"'
    if isinstance(v, (int, float)): return repr(v)
    if isinstance(v, str): return '"' + v.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n') + '"'
    if isinstance(v, dict):
        items = [f'{edn(Kw(k) if isinstance(k, str) and not isinstance(k, Kw) else k)} {edn(x, ind + 1)}' for k, x in v.items()]
        if all(not isinstance(x, (dict, list)) for x in v.values()):
            return '{' + ', '.join(items) + '}'
        return '{' + ('\n' + p + ' ').join(items) + '}'
    if isinstance(v, list):
        if not v: return '[]'
        if all(not isinstance(x, (dict, list)) for x in v):
            return '[' + ' '.join(edn(x) for x in v) + ']'
        return '[' + ('\n' + p + ' ').join(edn(x, ind + 1) for x in v) + ']'
    raise TypeError(v)

# ---------------------------------------------------------------- DXCare
dx_patient = [
 dict(NIP="99000001", NOM_USAGE="BERNIER", NOM_NAISSANCE="FAURE", PRENOM="Claire", DATE_NAISSANCE="1968-03-14", SEXE="F",
      EMAIL="claire.bernier@exemple.test", ADRESSE="12 rue de l'Exemple", CP="94800", VILLE="VILLEJUIF", TELEPHONE="0600000001",
      ETAB_ORIGINE="CH TEST SUD", MEDECIN_ADRESSEUR="DR ADRESSEUR A", MEDECIN_TRAITANT="DR TRAITANT A", DATE_CREATION="2026-04-02T09:12:00", DATE_MAJ="2026-09-12T10:30:00"),
 dict(NIP="99000002", NOM_USAGE="GARNIER", NOM_NAISSANCE="GARNIER", PRENOM="Michel", DATE_NAISSANCE="1955-07-02", SEXE="M",
      EMAIL=None, ADRESSE="3 avenue du Test", CP="75013", VILLE="PARIS", TELEPHONE="0600000002",
      ETAB_ORIGINE="HOPITAL FICTIF NORD", MEDECIN_ADRESSEUR="DR ADRESSEUR B", MEDECIN_TRAITANT="DR TRAITANT B", DATE_CREATION="2026-04-02T09:15:00", DATE_MAJ="2026-05-10T14:02:00"),
 dict(NIP="99000003", NOM_USAGE="LEFEVRE", NOM_NAISSANCE="DUBOIS", PRENOM="Anne-Marie", DATE_NAISSANCE="1972-11-30", SEXE="F",
      EMAIL="am.lefevre@exemple.test", ADRESSE="8 impasse Fictive", CP="92160", VILLE="ANTONY", TELEPHONE="0600000003",
      ETAB_ORIGINE=None, MEDECIN_ADRESSEUR="DR ADRESSEUR C", MEDECIN_TRAITANT="DR TRAITANT C", DATE_CREATION="2026-04-02T09:20:00", DATE_MAJ="2026-08-20T11:00:00"),
 # Doublon créé aux urgences : orthographe et date de naissance différentes
 dict(NIP="99000103", NOM_USAGE="LEFEBVRE", NOM_NAISSANCE=None, PRENOM="ANNE MARIE", DATE_NAISSANCE="1972-11-03", SEXE="F",
      EMAIL=None, ADRESSE=None, CP=None, VILLE=None, TELEPHONE="0600000003",
      ETAB_ORIGINE=None, MEDECIN_ADRESSEUR=None, MEDECIN_TRAITANT=None, DATE_CREATION="2026-07-14T23:41:00", DATE_MAJ="2026-07-14T23:41:00"),
 dict(NIP="99000004", NOM_USAGE="ROUSSEAU", NOM_NAISSANCE="ROUSSEAU", PRENOM="Jean", DATE_NAISSANCE="1941-01-25", SEXE="M",
      EMAIL=None, ADRESSE="21 chemin des Essais", CP="94400", VILLE="VITRY-SUR-SEINE", TELEPHONE="0100000004",
      ETAB_ORIGINE="CLINIQUE EXEMPLE", MEDECIN_ADRESSEUR="DR ADRESSEUR D", MEDECIN_TRAITANT="DR TRAITANT D", DATE_CREATION="2026-04-02T09:25:00", DATE_MAJ="2026-08-18T08:05:00"),
 dict(NIP="99000005", NOM_USAGE="NGUYEN", NOM_NAISSANCE="NGUYEN", PRENOM="Thi Lan", DATE_NAISSANCE="1980-09-09", SEXE="F",
      EMAIL="nguyen.tl@exemple", ADRESSE="5 place du Jeu de Données", CP="94270", VILLE="LE KREMLIN-BICETRE", TELEPHONE="0600000005",
      ETAB_ORIGINE="CH TEST SUD", MEDECIN_ADRESSEUR="DR ADRESSEUR A", MEDECIN_TRAITANT="DR TRAITANT E", DATE_CREATION="2026-05-03T10:00:00", DATE_MAJ="2026-07-01T16:45:00"),
 dict(NIP="99000006", NOM_USAGE="MOREL", NOM_NAISSANCE="MOREL", PRENOM="Henri", DATE_NAISSANCE="1938-04-30", SEXE="M",
      EMAIL=None, ADRESSE="40 boulevard Synthétique", CP="94000", VILLE="CRETEIL", TELEPHONE="+33 6 00 00 00 06",
      ETAB_ORIGINE="HOPITAL FICTIF NORD", MEDECIN_ADRESSEUR="DR ADRESSEUR B", MEDECIN_TRAITANT=None, DATE_CREATION="2026-04-02T09:30:00", DATE_MAJ="2026-09-01T09:10:00"),
]

dx_deces = [dict(NIP="99000004", DATE_DECES="2026-08-17", ORIGINE_INFO="Appel famille", DATE_SAISIE="2026-08-18T08:05:00", AUTEUR="SEC-0031")]

LIB = dict(ATCD_FAM="Antécédents familiaux", ATCD_CHIR="Antécédents chirurgicaux", ATCD_MED="Antécédents médicaux",
  ATCD_CARCINO="Antécédents carcinologiques", ATCD_GYNECO="Antécédents gynécologiques", OMS="Etat général OMS",
  POIDS="Poids (kg)", TAILLE="Taille (cm)", TABAC="Tabagisme", ALCOOL="Alcool", STUPEFIANTS="Stupéfiants", G8="Score G8",
  OCCURRENCE_CANCER="Occurrence du cancer", DATE_DIAG="Date du diagnostic", HISTOLOGIE="Histologie",
  HISTOIRE_MALADIE="Histoire de la maladie", HISTOIRE_PEC="Histoire de la prise en charge",
  LOCALISATION_PRIMITIVE="Localisation de la tumeur primitive", LATERALITE="Latéralité", PREFIXE_STADE="Préfixe stade",
  T="T", N="N", M="M", STADE_META_INITIAL="Stade métastatique initial", STADE_META_ACTUEL="Stade métastatique actuel",
  SITES_META="Sites des métastases", ANOMALIES_MOLECULAIRES="Anomalies moléculaires", TRAITEMENT_ACTUEL="Traitement actuel",
  LIGNES_TRAITEMENT="Lignes de traitement", ESSAI_CLINIQUE="Essai clinique / protocole")

cq = []
def q(nip, venue, form, date_evt, saisie, auteur, **answers):
    for code, val in answers.items():
        cq.append(dict(ID_REPONSE=f"CQ-{len(cq)+1:05d}", NIP=nip, ID_VENUE=venue, FORMULAIRE=form, CODE_QUESTION=code,
                       LIBELLE_QUESTION=LIB[code], VALEUR=val, DATE_EVT=date_evt, DATE_SAISIE=saisie, AUTEUR=auteur))

# P1 - sein : données propres, OMS en évolution (2 dans Simbad en mars, 1 en septembre)
q("99000001","V-1001","FICHE_RCP_SEIN","2026-04-08","2026-04-08T11:02:00","MED-0412",
  OCCURRENCE_CANCER="1", DATE_DIAG="2025-11-20", HISTOLOGIE="8500/3 - Carcinome canalaire infiltrant",
  LOCALISATION_PRIMITIVE="C50.4 - Quadrant supéro-externe du sein", LATERALITE="Gauche", PREFIXE_STADE="c", T="2", N="1", M="0",
  STADE_META_INITIAL="Non", STADE_META_ACTUEL="Non", ATCD_FAM="Mère : cancer du sein à 52 ans", ATCD_GYNECO="G2P2, ménopausée",
  ESSAI_CLINIQUE="Non")
q("99000001","V-1042","CONSULT_ONCO","2026-09-12","2026-09-12T10:32:00","MED-0412",
  OMS="1", POIDS="64", TAILLE="165", TABAC="Non-fumeuse", ALCOOL="Occasionnel", STUPEFIANTS="Non",
  TRAITEMENT_ACTUEL="Paclitaxel hebdomadaire", LIGNES_TRAITEMENT="L1 : EC puis paclitaxel (néoadjuvant) depuis 12/2025",
  ANOMALIES_MOLECULAIRES="HER2 1+ ; RE 90 %")

# P2 - poumon : conflit sur T à la même date de valeur que le CR Simbad ; poids saisi en grammes
q("99000002","V-2001","FICHE_RCP_THORAX","2026-03-28","2026-04-15T09:47:00","MED-0233",
  OCCURRENCE_CANCER="1", DATE_DIAG="2026-03-20", HISTOLOGIE="8140/3 - Adénocarcinome",
  LOCALISATION_PRIMITIVE="C34.1 - Lobe supérieur du poumon", LATERALITE="Droite", PREFIXE_STADE="c", T="2a", N="2", M="0",
  STADE_META_INITIAL="Non", STADE_META_ACTUEL="Non", ANOMALIES_MOLECULAIRES="EGFR exon 21 L858R")
q("99000002","V-2017","CONSULT_ONCO","2026-05-10","2026-05-10T14:00:00","MED-0233",
  OMS="1", POIDS="71500", TAILLE="176", TABAC="Ancien fumeur 40 PA, sevré 2015", ALCOOL="Non",
  TRAITEMENT_ACTUEL="Osimertinib 80 mg/j", LIGNES_TRAITEMENT="L1 : osimertinib depuis 04/2026",
  ESSAI_CLINIQUE="Oui - PROTO-LUNG-2026-03")

# P3 - ovaire : identité en double (DXCare + numéro Simbad différent), stade pathologique
q("99000003","V-3001","FICHE_RCP_GYNECO","2026-04-20","2026-04-20T16:10:00","MED-0518",
  OCCURRENCE_CANCER="1", DATE_DIAG="2026-01-15", HISTOLOGIE="8461/3 - Carcinome séreux de haut grade",
  LOCALISATION_PRIMITIVE="C56.9 - Ovaire", LATERALITE="Bilatérale", PREFIXE_STADE="p", T="3c", N="1", M="0",
  STADE_META_INITIAL="Non", STADE_META_ACTUEL="Non", ATCD_FAM="Mère : cancer du sein ; tante maternelle : cancer de l'ovaire",
  ATCD_CHIR="Appendicectomie 1990", ATCD_GYNECO="G1P1", OMS="0", POIDS="58", TAILLE="162",
  TRAITEMENT_ACTUEL="Olaparib (maintenance)", LIGNES_TRAITEMENT="L1 : carboplatine-paclitaxel 02/2026-06/2026 ; maintenance olaparib depuis 07/2026",
  ESSAI_CLINIQUE="Non")

# P4 - pancréas : patient décédé, TNM manquant, RDV « réalisé » après le décès
q("99000004","V-4003","FICHE_RCP_DIGESTIF","2026-05-06","2026-05-06T10:20:00","MED-0177",
  OCCURRENCE_CANCER="1", DATE_DIAG="2026-04-28", HISTOLOGIE="8500/3 - Adénocarcinome canalaire",
  LOCALISATION_PRIMITIVE="C25.0 - Tête du pancréas", LATERALITE="Sans objet",
  STADE_META_INITIAL="Oui", STADE_META_ACTUEL="Oui", SITES_META="C22.0 - Foie",
  OMS="3", G8="11", POIDS="61", TAILLE="170", ATCD_MED="HTA ; diabète de type 2",
  TRAITEMENT_ACTUEL="Soins de support", LIGNES_TRAITEMENT="L1 : gemcitabine 05/2026-07/2026", ESSAI_CLINIQUE="Non")

# P5 - côlon : progression métastatique, code topographie mal formé, plusieurs lignes, inclusion en essai
q("99000005","V-5001","FICHE_RCP_DIGESTIF","2026-05-12","2026-05-12T09:15:00","MED-0177",
  OCCURRENCE_CANCER="1", DATE_DIAG="2025-01-10", HISTOLOGIE="8140/3 - Adénocarcinome",
  LOCALISATION_PRIMITIVE="C18.70 - Côlon sigmoïde", LATERALITE="Sans objet", PREFIXE_STADE="p", T="3", N="1a", M="0",
  STADE_META_INITIAL="Non", STADE_META_ACTUEL="Oui", SITES_META="C22.0 - Foie ; C34.9 - Poumon",
  ANOMALIES_MOLECULAIRES="KRAS G12C ; MSS")
q("99000005","V-5020","CONSULT_ONCO","2026-07-01","2026-07-01T16:40:00","MED-0177",
  OMS="1", POIDS="52", TAILLE="158", TABAC="Non", ALCOOL="Non", STUPEFIANTS="Non",
  TRAITEMENT_ACTUEL="Traitement expérimental (essai)",
  LIGNES_TRAITEMENT="L1 : FOLFOX-bévacizumab 02/2025-10/2025 ; L2 : FOLFIRI 11/2025-06/2026 ; L3 : essai depuis 07/2026",
  ESSAI_CLINIQUE="Oui - PROTO-CRC-2025-11")

# P6 - prostate : OMS hors bornes, taille en mètres, médecin traitant absent
q("99000006","V-6002","FICHE_RCP_URO","2026-04-22","2026-04-22T13:30:00","MED-0390",
  OCCURRENCE_CANCER="1", DATE_DIAG="2026-03-02", HISTOLOGIE="8140/3 - Adénocarcinome acinaire (Gleason 4+4)",
  LOCALISATION_PRIMITIVE="C61.9 - Prostate", LATERALITE="Sans objet", PREFIXE_STADE="c", T="3a", N="0", M="1b",
  STADE_META_INITIAL="Oui", STADE_META_ACTUEL="Oui", SITES_META="C41.9 - Os")
q("99000006","V-6011","CONSULT_ONCO","2026-09-01","2026-09-01T09:05:00","MED-0390",
  OMS="6", G8="13", POIDS="78", TAILLE="1.72", TABAC="Non", ATCD_MED="Insuffisance cardiaque ; FA anticoagulée",
  TRAITEMENT_ACTUEL="Agoniste LH-RH + enzalutamide", LIGNES_TRAITEMENT="L1 : hormonothérapie depuis 03/2026", ESSAI_CLINIQUE="Non")

# ---------------------------------------------------------------- DXPlanning
rdv = []
def r(nip, date, acte, statut, service):
    rdv.append(dict(ID_RDV=f"RDV-{len(rdv)+1:05d}", NIP=nip, DATE_RDV=date, TYPE_ACTE=acte, STATUT=statut, SERVICE=service))
r("99000001","2026-09-12T10:00:00","CONSULTATION","REALISE","SENOLOGIE")
r("99000001","2026-09-19T09:00:00","HDJ CHIMIOTHERAPIE","REALISE","HDJ")
r("99000001","2026-10-20T10:00:00","CONSULTATION","PLANIFIE","SENOLOGIE")
r("99000002","2026-05-10T14:00:00","CONSULTATION","REALISE","THORAX")
r("99000002","2026-08-28T11:00:00","SCANNER","ANNULE","IMAGERIE")
r("99000003","2026-08-20T10:30:00","CONSULTATION","REALISE","GYNECOLOGIE")
r("99000004","2026-07-21T15:00:00","CONSULTATION","REALISE","DIGESTIF")
r("99000004","2026-09-02T09:30:00","CONSULTATION","REALISE","DIGESTIF")
r("99000005","2026-07-01T16:00:00","CONSULTATION","REALISE","DIGESTIF")
r("99000005","2026-09-30T08:30:00","HDJ ESSAI","REALISE","ESSAIS PRECOCES")
r("99000006","2026-09-01T09:00:00","CONSULTATION","REALISE","UROLOGIE")

# ---------------------------------------------------------------- SIMBAD (historique, avant avril 2026)
sb_patient = [
 dict(NUM_PATIENT="99000001", NOM="BERNIER", NOM_JF="FAURE", PRENOM="CLAIRE", DT_NAIS="14/03/1968", SEXE="2", DT_DECES=None, DT_MAJ="05/03/2026"),
 dict(NUM_PATIENT="99000002", NOM="GARNIER", NOM_JF=None, PRENOM="MICHEL", DT_NAIS="02/07/1955", SEXE="1", DT_DECES=None, DT_MAJ="28/03/2026"),
 dict(NUM_PATIENT="99000033", NOM="DUBOIS", NOM_JF=None, PRENOM="ANNE MARIE", DT_NAIS="30/11/1972", SEXE="2", DT_DECES=None, DT_MAJ="20/02/2026"),
 dict(NUM_PATIENT="99000004", NOM="ROUSSEAU", NOM_JF=None, PRENOM="JEAN", DT_NAIS="25/01/1941", SEXE="1", DT_DECES=None, DT_MAJ="30/01/2026"),
 dict(NUM_PATIENT="99000006", NOM="MOREL", NOM_JF=None, PRENOM="HENRI", DT_NAIS="30/04/1939", SEXE="1", DT_DECES=None, DT_MAJ="10/03/2026"),
]

sb_docs = [
 dict(ID_DOC="SB-DOC-0001", NUM_PATIENT="99000001", TYPE_DOC="CR_CONSULT", DT_DOC="05/03/2026", AUTEUR="DR ONCO SEIN", FORMAT="PDF_SCAN",
      TEXTE="Consultation d'oncologie du 05/03/2026. Patiente de 57 ans suivie pour un carcinome canalaire infiltrant du sein gauche, QSE, cT2 cN1 M0, diagnostiqué le 20/11/2025. RH+ (RE 90 %), HER2 1+. Chimiothérapie néoadjuvante par EC en cours. Etat général : OMS 2, asthénie marquée. Poids 66 kg. Pas d'antécédent chirurgical notable. Mère : cancer du sein."),
 dict(ID_DOC="SB-DOC-0002", NUM_PATIENT="99000002", TYPE_DOC="CR_CONSULT", DT_DOC="28/03/2026", AUTEUR="DR ONCO THORAX", FORMAT="PDF_NATIF",
      TEXTE="Consultation du 28/03/2026. Adénocarcinome pulmonaire du lobe supérieur droit, découvert le 20/03/2026. Bilan d'extension : cT3 cN2 M0. Recherche moléculaire en cours. PS 1. Poids 72 kg pour 1m76. Tabagisme sevré, 40 PA."),
 dict(ID_DOC="SB-DOC-0003", NUM_PATIENT="99000033", TYPE_DOC="CR_CONSULT", DT_DOC="20/02/2026", AUTEUR="DR ONCO GYNECO", FORMAT="PDF_SCAN",
      TEXTE="Mme DUBOIS Anne Marie, née le 30/11/1972. Carcinome séreux de haut grade de l'ovaire, diagnostic 15/01/2026. Chirurgie de cytoréduction complète. Mutation BRCA1 constitutionnelle. Début carboplatine-paclitaxel. OMS 0."),
 dict(ID_DOC="SB-DOC-0004", NUM_PATIENT="99000006", TYPE_DOC="CR_CONSULT", DT_DOC="10/03/2026", AUTEUR="DR ONCO URO", FORMAT="PDF_SCAN",
      TEXTE="Patient de 87 ans. Adénocarcinome prostatique Gleason 8 (4+4), PSA 86 ng/ml, métastases osseuses multiples. OMS 2. Score G8 à 12. Introduction d'une hormonothérapie."),
]

# ---------------------------------------------------------------- DEFGEN / GLIMS
defgen = [
 dict(ID_ANALYSE="DG-0001", NIP="99000002", DATE_PRELEVEMENT="2026-03-22", DATE_VALIDATION="2026-04-09", GENE="EGFR", HGVS_C="c.2573T>G", HGVS_P="p.Leu858Arg", TYPE_ANOMALIE="Mutation ponctuelle", ORIGINE="Somatique", INTERPRETATION="Pathogène"),
 dict(ID_ANALYSE="DG-0002", NIP="99000003", DATE_PRELEVEMENT="2026-01-20", DATE_VALIDATION="2026-02-12", GENE="BRCA1", HGVS_C="c.68_69del", HGVS_P="p.Glu23ValfsTer17", TYPE_ANOMALIE="Délétion (décalage du cadre)", ORIGINE="Constitutionnelle", INTERPRETATION="Pathogène"),
 dict(ID_ANALYSE="DG-0003", NIP="99000005", DATE_PRELEVEMENT="2025-01-15", DATE_VALIDATION="2025-02-03", GENE="KRAS", HGVS_C="c.34G>T", HGVS_P="p.Gly12Cys", TYPE_ANOMALIE="Mutation ponctuelle", ORIGINE="Somatique", INTERPRETATION="Pathogène"),
]
glims = [
 dict(ID_RESULTAT="GL-0001", NIP="99000001", DATE_PRELEVEMENT="2025-11-18", DATE_VALIDATION="2025-11-25", CODE_EXAMEN="RE_IHC", LIBELLE="Récepteurs aux oestrogènes (IHC)", RESULTAT="90", UNITE="%"),
 dict(ID_RESULTAT="GL-0002", NIP="99000001", DATE_PRELEVEMENT="2025-11-18", DATE_VALIDATION="2025-11-25", CODE_EXAMEN="HER2_IHC", LIBELLE="HER2 (IHC)", RESULTAT="1+", UNITE=None),
 dict(ID_RESULTAT="GL-0003", NIP="99000005", DATE_PRELEVEMENT="2025-01-15", DATE_VALIDATION="2025-01-29", CODE_EXAMEN="MSI", LIBELLE="Statut microsatellitaire", RESULTAT="MSS", UNITE=None),
 dict(ID_RESULTAT="GL-0004", NIP="99000006", DATE_PRELEVEMENT="2026-08-25", DATE_VALIDATION="2026-08-26", CODE_EXAMEN="PSA", LIBELLE="Antigène prostatique spécifique", RESULTAT="4.2", UNITE="ng/mL"),
]

def env(source, table, rows, extracted):
    return dict(source=Kw(source), table=table, **{"extrait-le": Inst(extracted)}, lignes=rows)

anomalies = [
 dict(id="ANO-01", patient="99000001", dimension=Kw("concordance"), variable="OMS", attendu="Évolution, pas un conflit : OMS 2 au 05/03/2026 (CR Simbad) puis OMS 1 au 12/09/2026 (DXCare). Valeur courante = 1."),
 dict(id="ANO-02", patient="99000002", dimension=Kw("concordance"), variable="T", attendu="Vrai conflit à la même date de valeur (28/03/2026) : DXCare T2a, CR Simbad cT3. Le stade calculé change (IIIA ou IIIB) selon la valeur retenue."),
 dict(id="ANO-03", patient="99000002", dimension=Kw("plausibilite"), variable="Poids", attendu="71500 : valeur saisie en grammes, à rejeter ou convertir (71,5 kg). CR Simbad : 72 kg."),
 dict(id="ANO-04", patient="99000003", dimension=Kw("plausibilite/unicite"), variable="Identité", attendu="Doublon DXCare 99000103 (LEFEBVRE, DDN 03/11/1972, même téléphone) et numéro Simbad différent 99000033 (DUBOIS, nom de naissance). Les trois fiches désignent la même personne."),
 dict(id="ANO-05", patient="99000004", dimension=Kw("plausibilite"), variable="Date de dernière venue", attendu="RDV « REALISE » le 02/09/2026, après le décès du 17/08/2026 : incohérence temporelle."),
 dict(id="ANO-06", patient="99000004", dimension=Kw("completude"), variable="T / N / M / préfixe", attendu="Absents : stade clinique non calculable."),
 dict(id="ANO-07", patient="99000004", dimension=Kw("concordance"), variable="Date de décès", attendu="Simbad ne connaît pas le décès (dernière mise à jour 30/01/2026) : information plus ancienne, pas un conflit."),
 dict(id="ANO-08", patient="99000005", dimension=Kw("conformite"), variable="Localisation primitive", attendu="C18.70 n'est pas un code CIM-O-3 valide (attendu C18.7)."),
 dict(id="ANO-09", patient="99000005", dimension=Kw("conformite"), variable="E-mail", attendu="nguyen.tl@exemple : adresse sans domaine valide."),
 dict(id="ANO-10", patient="99000006", dimension=Kw("conformite"), variable="OMS", attendu="6 : hors de l'échelle 0-5."),
 dict(id="ANO-11", patient="99000006", dimension=Kw("plausibilite"), variable="Taille", attendu="1.72 : saisie en mètres au lieu de centimètres."),
 dict(id="ANO-12", patient="99000006", dimension=Kw("concordance"), variable="Date de naissance", attendu="DXCare 30/04/1938, Simbad 30/04/1939 : conflit d'identité à arbitrer. Le CR Simbad du 10/03/2026 indique 87 ans, ce qui est cohérent avec 1938."),
 dict(id="ANO-13", patient="99000006", dimension=Kw("completude"), variable="Médecin traitant", attendu="Absent."),
 dict(id="ANO-14", patient="99000006", dimension=Kw("conformite"), variable="Téléphone", attendu="Format international avec espaces, différent des autres fiches."),
 dict(id="ANO-15", patient="tous", dimension=Kw("conformite"), variable="Dates", attendu="DXCare en AAAA-MM-JJ, Simbad en JJ/MM/AAAA ; sexe en F/M (DXCare) ou 2/1 (Simbad)."),
]

calcules = [
 dict(patient="99000001", age=58, stade_clinique="IIB", regle="cT2 cN1 cM0 - UICC 8e éd."),
 dict(patient="99000002", age=71, stade_clinique="IIIA si T2a / IIIB si T3", regle="T? N2 M0 - UICC 8e éd., dépend de ANO-02"),
 dict(patient="99000003", age=53, stade_clinique="IIIC", regle="pT3c pN1 M0 - UICC 8e éd. (FIGO IIIC)"),
 dict(patient="99000004", age=None, age_au_deces=85, stade_clinique=None, regle="TNM absent (ANO-06)"),
 dict(patient="99000005", age=46, stade_clinique="IIIB au diagnostic, métastatique depuis", regle="pT3 pN1a M0 - UICC 8e éd."),
 dict(patient="99000006", age="88 (DXCare) ou 87 (Simbad)", stade_clinique="IVB", regle="cT3a cN0 cM1b - UICC 8e éd., âge dépend de ANO-12"),
]

dataset = {
 "jeu/meta": dict(description="Jeu de données de test FICTIF pour le POC MDM - simule des extractions brutes des systèmes sources.",
   avertissement="Toutes les personnes, identifiants (NIP 99xxxxxx), adresses, médecins et essais sont inventés. Les schémas des tables sources sont des hypothèses : à remplacer par les schémas réels (voir Eric).",
   reference="Data_RCP_09_26 (Données Lot 1 Master Data).csv - 51 variables", date="2026-10-05", version="0.1"),
 "sources": [
   env("dxcare", "patient", dx_patient, "2026-10-05T02:00:00.000-00:00"),
   env("dxcare", "patient_deces", dx_deces, "2026-10-05T02:00:00.000-00:00"),
   env("dxcare", "c_quest", cq, "2026-10-05T02:00:00.000-00:00"),
   env("dxplanning", "acte_rdv", rdv, "2026-10-05T02:05:00.000-00:00"),
   env("simbad", "patient", sb_patient, "2026-03-31T23:00:00.000-00:00"),
   env("simbad", "documents", sb_docs, "2026-03-31T23:00:00.000-00:00"),
   env("defgen", "resultats", defgen, "2026-10-05T02:10:00.000-00:00"),
   env("glims", "resultats", glims, "2026-10-05T02:10:00.000-00:00"),
 ],
 "test/anomalies-attendues": anomalies,
 "test/valeurs-calculees-attendues": calcules,
}

header = """;; ============================================================================
;; Jeu de données de test FICTIF - POC MDM IGR
;; Simule des extractions brutes (avant transformation) des systèmes sources :
;;   DXCare (patient, patient_deces, c_quest), DXPlanning (acte_rdv),
;;   SIMBAD (patient, documents CR avant avril 2026), DEFGEN, GLIMS.
;; Aucune donnée réelle. Schémas des tables = hypothèses à valider.
;; Généré le 2026-10-05.
;; ============================================================================
"""
out = '/Users/bernard/Documents/projets/IGR-MDM/jeu-de-test/sources-poc-lot1.edn'
open(out, 'w', encoding='utf-8').write(header + edn(dataset) + '\n')
print(out, len(cq), 'réponses c_quest')
