// Builds demo/index.html: replays the cases of the POC note through the HTTP gateway
// (on the in-memory document store) and shows, for each case, the input and output JSON
// and the assumptions behind the enrichment.
import { readFile, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createApplication } from '../src/application.js';
import { FixedClock } from '../src/infrastructure/clock/fixed-clock.js';

const NOW = '2026-10-01T08:00:00';
const PATIENT = '99000002';
const fixture = async (name) => JSON.parse(await readFile(new URL(`../demo/fixtures/${name}.json`, import.meta.url), 'utf8'));

const clock = new FixedClock(NOW);
const { gateway } = await createApplication({ clock });
gateway.listen(0);
await once(gateway, 'listening');
const base = `http://localhost:${gateway.address().port}`;
const post = async (path, body) => (await fetch(`${base}${path}`, { method: 'POST', body: JSON.stringify(body) })).json();
const get = async (path) => (await fetch(`${base}${path}`)).json();

// 1. Integration of every raw extraction
const extractions = {};
for (const name of ['dxcare-patient', 'simbad-patient', 'dxcare-c_quest', 'simbad-observations', 'nlp-comptes-rendus-consultation']) {
  extractions[name] = await fixture(name);
}
const reports = [];
for (const [name, extraction] of Object.entries(extractions)) reports.push({ name, report: await post('/integrer-donnees', extraction) });

const pick = (name, ids) => {
  const extraction = extractions[name];
  const idField = Object.keys(extraction.lignes[0]).find((key) => /^(ID_|EXTRACTION_ID|NIP$|NUM_PATIENT$)/.test(key));
  return { ...extraction, lignes: extraction.lignes.filter((row) => ids.includes(row[idField])) };
};
const extract = (aLaDate) => get(`/extraire-donnees?identifiantPatient=${PATIENT}${aLaDate ? `&aLaDate=${aLaDate}` : ''}`);

const today = await extract();
const cases = [];

cases.push({
  title: 'Cas 1 – Deux sources pour le même patient : une évolution, pas un conflit (statut OMS)',
  summary: 'Trois sources donnent un statut OMS à des dates différentes : le MDM reconnaît une évolution et garde l’historique.',
  shows: "Le statut OMS arrive de trois sources. Simbad dit 2 au 03/06 ; DXCare et le compte rendu (NLP) disent 1 au 12/09. Les dates de valeur étant différentes, le MDM y voit une <b>évolution</b> : la valeur courante est 1 (deux sources concordantes, confiance haute) et la valeur 2 passe dans l'historique.",
  inputs: [pick('dxcare-c_quest', ['CQ-00101']), pick('simbad-observations', ['SB-OBS-0007']), pick('nlp-comptes-rendus-consultation', ['NLP-0001'])],
  output: today.patient.statutOms,
  assumptions: [
    'La date de valeur est la date de l’événement clinique : DATE_EVT dans DXCare, DT_EVT dans Simbad, date du document pour le NLP.',
    'Deux valeurs identiques à la même date de valeur sont concordantes : chaque source concordante ajoute +0,1 à la confiance.',
    "Une valeur plus ancienne n'est pas fausse : elle décrit l'état du patient à sa date et reste consultable dans « historique ».",
    'Simbad n’indique pas d’auteur : la règle AUTEUR-CONNU (complétude) échoue en avertissement sur cette valeur, sans la rejeter.',
  ],
});

cases.push({
  title: 'Cas 2 – Un vrai conflit à la même date de valeur (T du TNM)',
  summary: 'Deux sources divergent à la même date : le MDM retient la plus fiable, baisse la confiance et demande une revue.',
  shows: "DXCare indique T2a et le compte rendu Simbad (NLP) cT3, tous deux au 28/03/2026. Même date, valeurs différentes : c'est un <b>conflit</b>. Le MDM retient la valeur de la source la plus fiable (saisie structurée), garde l'autre dans « alternatives », baisse la confiance et demande une revue.",
  inputs: [pick('dxcare-c_quest', ['CQ-00102']), pick('nlp-comptes-rendus-consultation', ['NLP-0002'])],
  output: today.pathologie.categorieT,
  assumptions: [
    'En cas de conflit, la valeur retenue est celle de la source la plus fiable, puis la plus récemment enregistrée.',
    'Un conflit retire 0,3 à la confiance et positionne « aRevoir » : un data steward doit trancher.',
    'Le préfixe c/p/y du TNM n’est pas conservé (cT3 → 3) : à débattre, car il distingue stade clinique et pathologique.',
  ],
});

cases.push({
  title: "Cas 3 – Conflit d'identité sur une donnée intemporelle (date de naissance)",
  summary: 'DXCare et Simbad ne donnent pas la même date de naissance : conflit sur une donnée intemporelle, formats normalisés.',
  shows: "DXCare donne le 02/07/1955, Simbad le 02/07/1956. Une date de naissance n'a pas de date de valeur : toutes les sources parlent de la même chose, donc deux valeurs différentes sont toujours un <b>conflit</b>. Les conventions de format des sources (AAAA-MM-JJ et JJ/MM/AAAA) sont normalisées.",
  inputs: [pick('dxcare-patient', ['99000002']), pick('simbad-patient', ['99000002'])],
  output: today.patient.dateNaissance,
  assumptions: [
    'Les attributs intemporels (date de naissance) n’ont pas de date de valeur : « dateValeur » vaut null.',
    'Le patient est le même dans DXCare et Simbad car le NIP est identique : le rapprochement d’identité (INS, traits) est hors périmètre de ce prototype.',
    'Les colonnes non utilisées par le modèle (nom, prénom, sexe) sont listées comme ignorées dans le rapport d’intégration.',
  ],
});

cases.push({
  title: 'Cas 4 – Contrôle de conformité : une valeur rejetée mais conservée (localisation primitive)',
  summary: 'Un code CIM-O-3 invalide est rejeté par une règle bloquante mais reste visible ; la valeur du compte rendu est retenue.',
  shows: "DXCare saisit « C34.10 », qui n'est pas un code CIM-O-3 valide : la règle bloquante LOCALISATION-CIM-O-3 la <b>rejette</b>. Elle reste visible dans « rejetees » avec le contrôle en échec. Le MDM retient la valeur du compte rendu (C34.1), avec une confiance moyenne puisqu'il s'agit d'une extraction NLP.",
  inputs: [pick('dxcare-c_quest', ['CQ-00103']), pick('nlp-comptes-rendus-consultation', ['NLP-0003'])],
  output: today.pathologie.localisationPrimitive,
  assumptions: [
    'Une règle « bloquante » en échec rejette la valeur : elle n’est jamais consolidée mais reste tracée.',
    'Le libellé ajouté par la source est retiré (« C34.10 - Lobe supérieur du poumon » → « C34.10 ») avant contrôle.',
    'Une extraction NLP a une fiabilité moyenne si sa confiance est ≥ 0,85, faible sinon.',
  ],
});

const freshnessRule = {
  identifiant: 'OMS-FRAICHEUR-RCP',
  attribut: 'statutOms',
  dimension: 'fraicheur',
  typeControle: 'anciennete-max-jours',
  parametres: { jours: 15 },
  severite: 'avertissement',
  usages: ['rcp'],
  description: 'Pour une RCP, le statut OMS doit dater de moins de 15 jours',
  auteur: 'data-steward-oncologie',
  dateEffet: '2026-10-01',
};
const before = today.patient.statutOms.qualite;
const ruleV1 = await post('/regles-qualite', freshnessRule);
const afterV1 = (await extract()).patient.statutOms.qualite;
const ruleV2 = await post('/regles-qualite', { ...freshnessRule, parametres: { jours: 30 }, description: 'Pour une RCP, le statut OMS doit dater de moins de 30 jours' });
const afterV2 = (await extract()).patient.statutOms.qualite;

cases.push({
  title: 'Cas 5 – Une règle ajoutée à chaud par le métier, puis modifiée',
  summary: 'Un data steward ajoute puis modifie une règle de fraîcheur sans redéploiement : l’aptitude à la RCP change aussitôt.',
  shows: "Un data steward ajoute, sans redéploiement, la règle « pour une RCP, l'OMS doit dater de moins de 15 jours ». À la date du jour (01/10/2026), l'OMS du 12/09 a 19 jours : la valeur n'est plus <b>apte à la RCP</b>, mais reste apte à la recherche. La règle passe ensuite à 30 jours (version 2) : la valeur redevient apte, et chaque contrôle indique la version de la règle appliquée.",
  inputs: [{ 'POST /regles-qualite (v1)': freshnessRule }, { 'POST /regles-qualite (v2)': { parametres: { jours: 30 } } }],
  outputs: [
    { label: 'Qualité avant la règle', json: before },
    { label: 'Règle enregistrée (v1)', json: ruleV1 },
    { label: 'Qualité après la règle v1 (15 jours)', json: afterV1 },
    { label: 'Qualité après la règle v2 (30 jours)', json: afterV2 },
  ],
  assumptions: [
    'Une règle est une donnée : identifiant, version, attribut, dimension, type de contrôle, paramètres, sévérité, usages, auteur métier, date d’effet.',
    'Les règles sont réévaluées à chaque extraction : l’effet est immédiat, sans retraitement.',
    'Une règle liée à un usage (ici « rcp ») ne rejette pas la valeur et ne change pas sa confiance : elle change seulement l’aptitude à cet usage.',
    'Redéfinir une règle crée une nouvelle version ; les anciennes sont conservées pour expliquer les évaluations passées.',
    `Les deux versions ont été enregistrées le ${ruleV2.definieLe.replace('T', ' à ')}.`,
  ],
});

const past = await extract('2026-08-01');
cases.push({
  title: 'Cas 6 – Consultation « à une date » (as of)',
  summary: 'La même question posée au 01/08/2026 renvoie ce que l’on savait à cette date.',
  shows: "La même question posée au 01/08/2026 renvoie ce que l'on savait à cette date : seul Simbad avait enregistré un OMS (2, au 03/06). Les valeurs DXCare et NLP, enregistrées en septembre, n'existent pas encore, et la règle de fraîcheur, en vigueur à partir du 01/10, ne s'applique pas.",
  inputs: [{ requete: `GET /extraire-donnees?identifiantPatient=${PATIENT}&aLaDate=2026-08-01` }],
  outputs: [
    { label: 'Statut OMS au 01/08/2026', json: past.patient.statutOms },
    { label: 'Pour comparaison : statut OMS au 01/10/2026', json: { valeur: today.patient.statutOms.valeur, dateValeur: today.patient.statutOms.dateValeur, statut: today.patient.statutOms.statut } },
  ],
  assumptions: [
    '« À une date » filtre sur la date d’enregistrement dans la source (dateEnregistrement) : l’historique Simbad étant importé en masse, la date d’intégration dans le MDM ne reflète pas ce qui était connu.',
    'La date d’intégration (dateIntegration) est conservée pour l’audit du MDM.',
    'Seules les règles en vigueur à la date demandée (dateEffet) et déjà définies à cette date (definieLe) sont appliquées.',
    'Les règles par défaut sont considérées comme définies le 01/01/2026 (config/regles-qualite-par-defaut.json).',
  ],
});

// Case 7: bitemporality of data and rules. Time moves to 05/10: a late entry arrives and a retroactive rule is defined.
clock.set('2026-10-05T09:00:00');
const lateEntry = await fixture('dxcare-c_quest-saisie-tardive');
reports.push({ name: 'dxcare-c_quest-saisie-tardive (cas 7, intégrée le 05/10)', report: await post('/integrer-donnees', lateEntry) });
const retroactiveRule = {
  identifiant: 'OMS-RECENT-RCP',
  attribut: 'statutOms',
  dimension: 'fraicheur',
  typeControle: 'anciennete-max-jours',
  parametres: { jours: 7 },
  severite: 'avertissement',
  usages: ['rcp'],
  description: 'Pour une RCP, le statut OMS doit dater de moins de 7 jours',
  auteur: 'data-steward-oncologie',
  dateEffet: '2026-09-01',
};
const retroactiveRuleSaved = await post('/regles-qualite', retroactiveRule);
const view = (dossier) => ({
  aLaDate: dossier.aLaDate,
  connuLe: dossier.connuLe,
  valeur: dossier.patient.statutOms.valeur,
  dateValeur: dossier.patient.statutOms.dateValeur,
  sources: dossier.patient.statutOms.sources.map((source) => `${source.provenance.source} ${source.provenance.identifiantEnregistrement}, saisi le ${source.dateEnregistrement}`),
  aptitude: dossier.patient.statutOms.qualite.aptitude,
  reglesAppliquees: dossier.patient.statutOms.qualite.controles.map((controle) => `${controle.identifiantRegle} v${controle.versionRegle} : ${controle.resultat}`),
});
const shownAtRcp = await extract('2026-09-20');
const knownToday = await get(`/extraire-donnees?identifiantPatient=${PATIENT}&aLaDate=2026-09-20&connuLe=2026-10-05T09:00:00`);
cases.push({
  title: 'Cas 7 – Bitemporalité : ce que le MDM montrait à la RCP, et ce que l’on sait aujourd’hui',
  summary: 'Une saisie tardive et une règle rétroactive ne réécrivent pas ce que le MDM a fourni à la RCP du 20/09.',
  shows: "Le 20/09, la RCP consulte le MDM : <b>OMS 1</b> (consultation du 12/09), apte à la RCP. Le 02/10, un OMS 2 de la consultation du 18/09 est saisi en retard ; le 05/10, un data steward crée une règle « OMS de moins de 7 jours pour une RCP », en vigueur depuis le 01/09. Deux questions, deux réponses : <b>que montrait le MDM le 20/09 ?</b> (<code>aLaDate=2026-09-20</code>) → OMS 1, sans la nouvelle règle ; <b>que sait-on aujourd'hui du 20/09 ?</b> (<code>&amp;connuLe=2026-10-05T09:00:00</code>) → OMS 2 au 18/09, nouvelle règle appliquée.",
  inputs: [{ 'POST /integrer-donnees (05/10)': lateEntry }, { 'POST /regles-qualite (05/10)': retroactiveRule }],
  outputs: [
    { label: 'Règle enregistrée : en vigueur au 01/09, définie le 05/10', json: { identifiant: retroactiveRuleSaved.identifiant, version: retroactiveRuleSaved.version, dateEffet: retroactiveRuleSaved.dateEffet, definieLe: retroactiveRuleSaved.definieLe } },
    { label: 'Ce que le MDM montrait à la RCP – aLaDate=2026-09-20', json: view(shownAtRcp) },
    { label: 'Ce que l’on sait aujourd’hui du 20/09 – connuLe=2026-10-05T09:00:00', json: view(knownToday) },
  ],
  assumptions: [
    'Deux axes de temps, pour les données comme pour les règles : la validité (dateValeur, dateEffet) répond à « à quelle date ? », la connaissance (dateEnregistrement, definieLe) à « su quand ? ».',
    '« aLaDate » fixe la validité ; « connuLe » fixe la connaissance et vaut aLaDate par défaut : sans connuLe, le MDM rejoue exactement ce qu’il fournissait à cette date.',
    'Une règle définie après « connuLe » est ignorée, même si sa date d’effet est antérieure : sinon l’OMS du 12/09 (8 jours au 20/09) apparaîtrait a posteriori comme non apte, alors que la RCP l’a vu apte.',
    'Rien n’est réécrit : la saisie tardive est une nouvelle valeur sourcée, la règle une nouvelle donnée ; les deux réponses restent disponibles indéfiniment.',
  ],
});

gateway.close();

// ---------------------------------------------------------------- HTML rendering
const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const highlight = (value) =>
  escape(JSON.stringify(value, null, 2)).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g,
    (match, string, colon, literal, number) => {
      if (string) return colon ? `<span class="k">${string}</span>${colon}` : `<span class="s">${string}</span>`;
      if (literal) return `<span class="l">${literal}</span>`;
      return `<span class="n">${number}</span>`;
    },
  );
const block = (label, json) => `<div class="json"><div class="lab">${label}</div><pre>${highlight(json)}</pre></div>`;

const generalAssumptions = [
  ['Identité', 'Un patient est identifié par le même NIP dans toutes les sources. Le rapprochement d’identité (INS, traits, doublons) est hors périmètre.'],
  ['Pathologie', 'Un patient n’a qu’une pathologie dans ce prototype. Le vrai modèle devra porter plusieurs occurrences de cancer.'],
  ['Date de valeur', 'Date à laquelle la valeur était vraie : date de l’événement clinique ou date du document. Absente pour les attributs intemporels.'],
  ['Date d’enregistrement', 'Date de saisie dans la source (dateEnregistrement). Les dates sans fuseau horaire sont en heure locale de l’hôpital.'],
  ['Date d’intégration', 'Date d’entrée dans le MDM (dateIntegration), conservée pour l’audit.'],
  ['Historisation', 'Aucune valeur n’est écrasée : chaque valeur de chaque source est conservée. Réintégrer le même enregistrement source est sans effet.'],
  ['Fiabilité', 'Selon le mode d’acquisition : saisie structurée = élevée (0,9) ; reprise de données = moyenne (0,6) ; extraction NLP = moyenne si confiance ≥ 0,85, sinon faible (0,3).'],
  ['Évolution / conflit', 'Dates de valeur différentes = évolution. Même date de valeur et valeurs identiques = concordance. Même date de valeur et valeurs différentes = conflit.'],
  ['Valeur retenue', 'La plus fiable, puis la plus récemment enregistrée. En cas de conflit, les autres valeurs restent dans « alternatives ».'],
  ['Confiance', 'Fiabilité de la valeur retenue + 0,1 par source concordante − 0,3 en cas de conflit − 0,1 par avertissement. Haute ≥ 0,8 ; moyenne ≥ 0,5 ; faible en dessous.'],
  ['Règles', 'Données versionnées, modifiables à chaud. Bloquante en échec : valeur rejetée (visible dans « rejetees »). Avertissement : confiance réduite. Liée à un usage : aptitude à cet usage seulement.'],
  ['Usages', 'Deux usages évalués : « rcp » et « recherche ».'],
  ['Normalisation', 'Dates JJ/MM/AAAA converties en AAAA-MM-JJ ; libellé retiré des codes CIM-O-3 ; préfixe c/p/y retiré du T.'],
  ['Sources', 'Les noms de tables et de colonnes (DXCare, Simbad, NLP) sont des hypothèses, à remplacer par les schémas réels. Toutes les données sont fictives.'],
];

const debates = [
  'Les poids de fiabilité et la formule de confiance sont arbitraires : ils doivent être fixés avec le métier.',
  'Faut-il évaluer la fraîcheur par rapport à la date du jour ?',
  'Pour la consultation « à une date », faut-il proposer les deux axes (ce que la source savait / ce que le MDM savait) ?',
  'Qui peut créer ou modifier une règle, et avec quelle validation ?',
];

const enrichment = [
  ['valeur', 'Valeur canonique, normalisée depuis la valeur brute de la source'],
  ['valeurBrute', 'Valeur telle que reçue de la source'],
  ['dateValeur', 'Date à laquelle la valeur était vraie'],
  ['dateEnregistrement / dateIntegration', 'Date de saisie dans la source / date d’entrée dans le MDM'],
  ['provenance', 'Source, table, champ, identifiant d’enregistrement, mode d’acquisition, auteur, document et confiance NLP'],
  ['fiabilite', 'Fiabilité de chaque source'],
  ['qualite.controles', 'Chaque règle appliquée, avec sa version et son résultat'],
  ['qualite.confiance', 'Score et niveau de confiance de la valeur retenue, avec l’explication (« motif »)'],
  ['qualite.aptitude', 'Aptitude de la valeur à chaque usage (RCP, recherche)'],
  ['statut / aRevoir', 'consolidee, conflit, sans-valeur-valide, sans-donnee ; revue nécessaire ou non'],
  ['sources / alternatives / rejetees', 'Sources concordantes, valeurs en conflit, valeurs rejetées'],
  ['historique', 'États antérieurs (dates de valeur plus anciennes)'],
];


const architectureSection = `
<h2 id="prototype">Le prototype tel qu'il est codé</h2>
<svg viewBox="0 0 1200 680" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block" font-family="-apple-system, Helvetica Neue, Arial, sans-serif" role="img" aria-label="Architecture concentrique du prototype">
  <defs>
    <marker id="fl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#24507f"/></marker>
    <marker id="flg" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8a96a8"/></marker>
  </defs>
  <ellipse cx="600" cy="335" rx="445" ry="305" fill="#eef1f5" stroke="#8a96a8" stroke-width="2"/>
  <ellipse cx="600" cy="335" rx="330" ry="215" fill="#dde8f5" stroke="#5f86b5" stroke-width="2"/>
  <ellipse cx="600" cy="335" rx="205" ry="130" fill="#0b3d6e"/>

  <text x="600" y="64" text-anchor="middle" font-size="16" font-weight="700" fill="#5b6475" letter-spacing="2">INFRASTRUCTURE</text>
  <text x="600" y="84" text-anchor="middle" font-size="12" fill="#5b6475">src/infrastructure · simulée, noms techniques en anglais</text>
  <text x="600" y="150" text-anchor="middle" font-size="16" font-weight="700" fill="#24507f" letter-spacing="2">SCÉNARIOS</text>
  <text x="600" y="170" text-anchor="middle" font-size="12" fill="#24507f">src/scenarios · ne dépendent que du domaine</text>
  <text x="600" y="234" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" letter-spacing="2">DOMAINE</text>
  <text x="600" y="252" text-anchor="middle" font-size="11.5" fill="#cfe0f5">src/domain · aucune dépendance</text>

  <g font-size="12.5" text-anchor="middle" fill="#fff">
    <text x="600" y="276" font-weight="700" fill="#ffd27a">Modélisation de la donnée enrichie</text>
    <text x="600" y="297">Patient · Pathologie (4 attributs)</text>
    <text x="600" y="317">ValeurSourcee : valeur, valeurBrute,</text>
    <text x="600" y="334">dateValeur, dateEnregistrement, dateIntegration</text>
    <text x="600" y="354">Provenance · Fiabilité · Lignage des sources</text>
    <text x="600" y="374">RegleQualite → Controle</text>
    <text x="600" y="394">Consolidation → Dossier patient</text>
    <text x="600" y="416" font-size="11" fill="#cfe0f5">évolution · conflit · rejet · confiance · aptitude</text>
  </g>

  <g text-anchor="middle">
    <rect x="274" y="300" width="118" height="70" rx="8" fill="#fff" stroke="#24507f" stroke-width="1.5"/>
    <text x="333" y="325" font-size="12.5" font-weight="700" fill="#0b3d6e">integrerDonnees</text>
    <text x="333" y="343" font-size="11" fill="#5b6475">(extraction)</text>
    <text x="333" y="359" font-size="10.5" fill="#5b6475">→ rapport</text>
    <rect x="808" y="300" width="118" height="70" rx="8" fill="#fff" stroke="#24507f" stroke-width="1.5"/>
    <text x="867" y="325" font-size="12.5" font-weight="700" fill="#0b3d6e">extraireDonnees</text>
    <text x="867" y="343" font-size="11" fill="#5b6475">(identifiantPatient,</text>
    <text x="867" y="359" font-size="11" fill="#5b6475">aLaDate, connuLe)</text>
    <text x="586" y="505" text-anchor="end" font-size="11.5" fill="#24507f">+ definirRegleQualite (règles à chaud)</text>
  </g>

  <g text-anchor="middle">
    <rect x="160" y="290" width="106" height="90" rx="8" fill="#fff" stroke="#8a96a8" stroke-width="1.5"/>
    <text x="213" y="313" font-size="13" font-weight="700" fill="#333">Gateway</text>
    <text x="213" y="330" font-size="13" font-weight="700" fill="#333">d'entrée</text>
    <text x="213" y="349" font-size="10.5" fill="#555">POST</text>
    <text x="213" y="364" font-size="10.5" fill="#555">/integrer-donnees</text>
    <rect x="934" y="290" width="106" height="90" rx="8" fill="#fff" stroke="#8a96a8" stroke-width="1.5"/>
    <text x="987" y="313" font-size="13" font-weight="700" fill="#333">Gateway</text>
    <text x="987" y="330" font-size="13" font-weight="700" fill="#333">de sortie</text>
    <text x="987" y="349" font-size="10.5" fill="#555">GET</text>
    <text x="987" y="364" font-size="10.5" fill="#555">/extraire-donnees</text>
    <rect x="470" y="560" width="260" height="52" rx="8" fill="#fff" stroke="#8a96a8" stroke-width="1.5"/>
    <text x="600" y="582" font-size="13" font-weight="700" fill="#333">Base documentaire en mémoire</text>
    <text x="600" y="600" font-size="10.5" fill="#555">dépôts (repositories) · horloge · JSON</text>
  </g>

  <g text-anchor="middle">
    <rect x="0" y="284" width="140" height="102" rx="8" fill="#fff4e0" stroke="#c98a1a" stroke-width="1.5"/>
    <text x="70" y="310" font-size="14" font-weight="700" fill="#7a4d00">Sources</text>
    <text x="70" y="331" font-size="11.5" fill="#7a4d00">DXCare</text>
    <text x="70" y="348" font-size="11.5" fill="#7a4d00">Simbad</text>
    <text x="70" y="365" font-size="11.5" fill="#7a4d00">NLP (comptes rendus)</text>
    <rect x="1060" y="284" width="140" height="102" rx="8" fill="#fff4e0" stroke="#c98a1a" stroke-width="1.5"/>
    <text x="1130" y="310" font-size="14" font-weight="700" fill="#7a4d00">Client</text>
    <text x="1130" y="331" font-size="11.5" fill="#7a4d00">IVDP</text>
    <text x="1130" y="348" font-size="11.5" fill="#7a4d00">démonstration</text>
    <text x="1130" y="365" font-size="11.5" fill="#7a4d00">métier</text>
  </g>

  <g stroke="#24507f" stroke-width="2.5" fill="none" marker-end="url(#fl)">
    <line x1="140" y1="335" x2="158" y2="335"/>
    <line x1="266" y1="335" x2="272" y2="335"/>
    <line x1="392" y1="335" x2="402" y2="335"/>
    <line x1="798" y1="335" x2="806" y2="335"/>
    <line x1="926" y1="335" x2="932" y2="335"/>
    <line x1="1040" y1="335" x2="1058" y2="335"/>
  </g>
  <text x="70" y="404" text-anchor="middle" font-size="11" fill="#24507f">JSON brut (input)</text>
  <text x="1130" y="404" text-anchor="middle" font-size="11" fill="#24507f">JSON enrichi (output)</text>
  <g stroke="#8a96a8" stroke-width="1.8" fill="none" stroke-dasharray="5,4" marker-end="url(#flg)">
    <line x1="600" y1="558" x2="600" y2="468"/>
  </g>
  <text x="612" y="530" font-size="11" fill="#5b6475">implémente les ports du domaine</text>
  <text x="600" y="672" text-anchor="middle" font-size="11.5" fill="#5b6475">Les dépendances vont uniquement vers le centre ; un test automatique (test/architecture.test.js) le vérifie.</text>
</svg>

<h3>Description technique</h3>
<table>
  <tr><th style="width:22%">Sujet</th><th>État actuel</th></tr>
  <tr><td><b>Langage et exécution</b></td><td>JavaScript (modules ES), Node.js 22 ou plus. <b>Aucune dépendance</b> externe : seuls les modules intégrés de Node sont utilisés, et uniquement dans l'infrastructure (<code>node:http</code>), la composition (<code>node:fs</code>) et les tests (<code>node:test</code>).</td></tr>
  <tr><td><b>Type d'architecture</b></td><td>Architecture concentrique de type <b>hexagonale / « clean architecture »</b>, conçue selon le <b>Domain-Driven Design</b> : un domaine au centre, des scénarios (cas d'usage) autour, une infrastructure à l'extérieur. Les échanges avec l'extérieur passent par des <b>ports</b> définis par le domaine (dépôts, horloge) et des <b>adaptateurs</b> fournis par l'infrastructure (pattern « ports et adaptateurs »).</td></tr>
  <tr><td><b>Domaine</b></td><td>11 fichiers, environ 850 lignes. Fonctions pures et objets immuables : modélisation de la donnée enrichie, lignage des sources, fiabilité, règles qualité versionnées, consolidation, dossier patient. Langage du domaine en français.</td></tr>
  <tr><td><b>Scénarios</b></td><td><code>integrerDonnees</code>, <code>extraireDonnees</code> et <code>definirRegleQualite</code> (environ 80 lignes). Ils reçoivent leurs dépendances en paramètre (<b>injection de dépendances</b>) et n'importent que le domaine.</td></tr>
  <tr><td><b>Infrastructure</b></td><td>Entièrement <b>simulée</b> : base documentaire en mémoire au fonctionnement proche de MongoDB (documents sérialisés en JSON), dépôts documentaires, horloge système et horloge fixe, et une <b>gateway HTTP</b> limitée à la traduction requête web → appel de scénario. Une seule gateway (<code>http-gateway.js</code>) porte l'entrée et la sortie.</td></tr>
  <tr><td><b>API</b></td><td>REST / JSON : <code>POST /integrer-donnees</code>, <code>GET /extraire-donnees?identifiantPatient=&amp;aLaDate=&amp;connuLe=</code>, <code>POST /regles-qualite</code>, <code>GET /health</code>. Les erreurs du domaine deviennent des erreurs HTTP 400 ou 404.</td></tr>
  <tr><td><b>Composition</b></td><td><code>src/application.js</code> relie l'infrastructure aux scénarios (« composition root ») et charge les règles qualité par défaut depuis <code>config/regles-qualite-par-defaut.json</code>. <code>src/main.js</code> démarre la gateway.</td></tr>
  <tr><td><b>Tests</b></td><td>30 tests (<code>npm test</code>) : domaine, scénarios avec des doublures (faux dépôts, fausse horloge), infrastructure simulée, gateway avec de faux scénarios, et un test d'architecture qui vérifie la règle de dépendance.</td></tr>
  <tr><td><b>Démonstration</b></td><td>Cette page est générée par <code>npm run demo</code> : le script démarre la vraie gateway sur l'infrastructure simulée et rejoue les cas par des appels HTTP.</td></tr>
  <tr><td><b>Ce qui n'existe pas encore</b></td><td>Pas de persistance (tout est perdu à l'arrêt), pas d'authentification ni de gestion des droits, pas de connexion aux vraies sources (extractions fictives), pas de rapprochement d'identité, une seule pathologie par patient, 4 attributs seulement.</td></tr>
</table>
`;

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>POC MDM – Démonstration de l'enrichissement</title>
<style>
:root{--bleu:#0b3d6e;--bleu2:#24507f;--gris:#5b6475;--trait:#c9d3e0;--fond:#f2f5fa;--vert:#1d6b40}
*{box-sizing:border-box}
body{margin:0;font:15px/1.5 -apple-system,'Helvetica Neue',Arial,sans-serif;color:#1d2433;background:#fff}
header{background:var(--bleu);color:#fff;padding:22px 32px}
header h1{margin:0 0 6px;font-size:24px}
header p{margin:0;opacity:.9}
header code{background:rgba(255,255,255,.15);color:#fff}
main{max-width:1400px;margin:0 auto;padding:16px 32px 60px}
h2{color:var(--bleu);border-bottom:2px solid var(--trait);padding-bottom:4px;margin-top:40px}
h3{color:var(--bleu2);margin:18px 0 6px}
.case{border:1px solid var(--trait);border-radius:8px;padding:16px 20px;margin:22px 0;background:#fff}
.case h2{margin-top:0;border:none}
.shows{background:var(--fond);border-left:4px solid var(--bleu2);padding:8px 12px;margin:8px 0 14px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
.col{min-width:0}
.col h3{margin-top:0}
.json{margin-bottom:12px}
.lab{font-size:12px;font-weight:700;color:var(--gris);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}
pre{margin:0;background:#0f1b2b;color:#dfe7f2;padding:12px;border-radius:6px;overflow:auto;max-height:900px;white-space:pre-wrap;word-break:break-word;font:12.5px/1.45 Menlo,Consolas,monospace}
.k{color:#8cc4ff}.s{color:#b9e3a1}.n{color:#ffd27a}.l{color:#f5a3c7}
ul.hyp{margin:6px 0 0;padding-left:20px}
ul.hyp li{margin:3px 0}
table{border-collapse:collapse;width:100%;margin:8px 0;font-size:14px}
th,td{border:1px solid var(--trait);padding:6px 9px;text-align:left;vertical-align:top}
th{background:#e8eef6;color:var(--bleu)}
code{font-family:Menlo,Consolas,monospace;font-size:13px;background:var(--fond);padding:0 3px;border-radius:3px}
details summary{cursor:pointer;color:var(--bleu2);font-weight:600}
.toc{background:var(--fond);border:1px solid var(--trait);border-radius:8px;padding:6px 22px 14px;margin-top:20px}
.toc h2{border:none}
.toc ol>li{margin:6px 0}
.toc ul.cases{margin:6px 0 0;padding-left:18px}
.toc ul.cases li{margin:7px 0}
.toc ul.cases span{color:var(--gris);font-size:14px}
.toc a{color:var(--bleu2);text-decoration:none}
.toc a:hover{text-decoration:underline}
html{scroll-behavior:smooth}
@media (max-width:900px){.cols{grid-template-columns:minmax(0,1fr)}main{padding:12px 16px}}
</style>
</head>
<body>
<header>
  <h1>POC MDM – Démonstration de l'enrichissement des données</h1>
  <p>Patient fictif ${PATIENT} · Date de la démonstration : ${NOW.replace('T', ' ')} · Chaque résultat ci-dessous est produit par le prototype, appelé via la gateway HTTP (<code>integrer-donnees</code>, <code>extraire-donnees</code>, <code>regles-qualite</code>).</p>
</header>
<main>
<nav class="toc">
<h2 style="margin-top:8px">Sommaire</h2>
<ol>
  <li><a href="#prototype">Le prototype tel qu'il est codé</a> (schéma et description technique)</li>
  <li><a href="#enrichissement">Ce que le MDM ajoute à chaque donnée</a></li>
  <li><a href="#integration">Étape 0 – Intégration des extractions sources</a></li>
  <li>Les cas de la note :
    <ul class="cases">
${cases.map((item, index) => `      <li><a href="#cas-${index + 1}"><b>${item.title}</b></a><br><span>${item.summary}</span></li>`).join('\n')}
    </ul>
  </li>
  <li><a href="#hypotheses">Hypothèses prises pour l'enrichissement</a> et points à débattre</li>
  <li><a href="#annexe">Annexe – Dossier complet du patient</a></li>
</ol>
</nav>
${architectureSection}
<h2 id="enrichissement">Ce que le MDM ajoute à chaque donnée</h2>
<p>Une source fournit une valeur brute. Le MDM la transforme en une <b>valeur enrichie</b> : on sait d'où elle vient, quand elle était vraie, si on peut s'y fier et pour quel usage. C'est sur cette description que s'appuieront plus tard le catalogue et l'annuaire de données.</p>
<table><tr><th>Champ du JSON final</th><th>Ce qu'il apporte</th></tr>
${enrichment.map(([field, text]) => `<tr><td><code>${field}</code></td><td>${text}</td></tr>`).join('\n')}
</table>

<h2 id="integration">Étape 0 – Intégration des extractions sources</h2>
<p>Les cinq extractions brutes ont été envoyées à <code>POST /integrer-donnees</code>. Rapports renvoyés :</p>
<table><tr><th>Extraction</th><th>Lignes reçues</th><th>Valeurs intégrées</th><th>Champs ou codes ignorés</th></tr>
${reports.map(({ name, report }) => `<tr><td><code>${report.source}/${report.table}</code></td><td>${report.lignesRecues}</td><td>${report.valeursIntegrees}</td><td>${report.ignores.map((item) => `<code>${escape(item.champ)}</code>`).join(' ') || '—'}</td></tr>`).join('\n')}
</table>

${cases.map((item, index) => `<section class="case" id="cas-${index + 1}">
<h2>${item.title}</h2>
<div class="shows">${item.shows}</div>
<div class="cols">
  <div class="col"><h3>JSON initial (sources)</h3>${item.inputs.map((input, index) => block(`Entrée ${index + 1}`, input)).join('')}</div>
  <div class="col"><h3>JSON final (MDM)</h3>${(item.outputs ?? [{ label: 'GET /extraire-donnees → attribut', json: item.output }]).map((output) => block(output.label, output.json)).join('')}</div>
</div>
<h3>Hypothèses de ce cas</h3>
<ul class="hyp">${item.assumptions.map((text) => `<li>${text}</li>`).join('')}</ul>
</section>`).join('\n')}

<h2 id="hypotheses">Hypothèses prises pour l'enrichissement</h2>
<table><tr><th style="width:18%">Sujet</th><th>Hypothèse</th></tr>
${generalAssumptions.map(([topic, text]) => `<tr><td><b>${topic}</b></td><td>${text}</td></tr>`).join('\n')}
</table>

<h3>Points à débattre avec le métier</h3>
<ul class="hyp">${debates.map((text) => `<li>${text}</li>`).join('')}</ul>

<h2 id="annexe">Annexe – Dossier complet du patient au ${NOW.slice(0, 10)}</h2>
<details><summary>Afficher le JSON complet renvoyé par GET /extraire-donnees?identifiantPatient=${PATIENT}</summary>${block('Dossier enrichi', today)}</details>
</main>
</body>
</html>
`;

await writeFile(new URL('../demo/index.html', import.meta.url), html);
console.log('demo/index.html written');
