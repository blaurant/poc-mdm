import { ErreurDomaine } from './erreurs.js';
import { normaliserValeur } from './attributs.js';
import { parseDate, parseDateTime } from './dates.js';
import { creerValeurSourcee } from './valeur-sourcee.js';

/**
 * Lineage knowledge: where each attribute is found in each source extraction.
 *
 * Two layouts exist:
 *  - 'large' (wide): one row per patient, one column per attribute (e.g. a patient table);
 *  - 'longue' (long): one row per value, a code column tells which attribute it is (e.g. a questionnaire table).
 *
 * Source table and column names (NIP, VALEUR...) belong to the sources and are kept as is.
 * They are assumptions until the real source schemas are known.
 */
export const CORRESPONDANCES_SOURCES = Object.freeze({
  'dxcare/patient': {
    source: 'dxcare',
    table: 'patient',
    disposition: 'large',
    mode: 'saisie-structuree',
    champIdentifiantPatient: 'NIP',
    champIdentifiantEnregistrement: 'NIP',
    dateEnregistrement: { champ: 'DATE_MAJ', format: 'date-heure-iso' },
    champAuteur: null,
    colonnes: { DATE_NAISSANCE: { attribut: 'dateNaissance', formatDate: 'date-iso' } },
  },
  'dxcare/c_quest': {
    source: 'dxcare',
    table: 'c_quest',
    disposition: 'longue',
    mode: 'saisie-structuree',
    champIdentifiantPatient: 'NIP',
    champIdentifiantEnregistrement: 'ID_REPONSE',
    champCode: 'CODE_QUESTION',
    champValeur: 'VALEUR',
    dateValeur: { champ: 'DATE_EVT', format: 'date-iso' },
    dateEnregistrement: { champ: 'DATE_SAISIE', format: 'date-heure-iso' },
    champAuteur: 'AUTEUR',
    codes: { POIDS: 'poids', T: 'categorieT', LOCALISATION_PRIMITIVE: 'localisationPrimitive' },
  },
  'simbad/patient': {
    source: 'simbad',
    table: 'patient',
    disposition: 'large',
    mode: 'reprise',
    champIdentifiantPatient: 'NUM_PATIENT',
    champIdentifiantEnregistrement: 'NUM_PATIENT',
    dateEnregistrement: { champ: 'DT_MAJ', format: 'date-francaise' },
    champAuteur: null,
    colonnes: { DT_NAIS: { attribut: 'dateNaissance', formatDate: 'date-francaise' } },
  },
  'simbad/observations': {
    source: 'simbad',
    table: 'observations',
    disposition: 'longue',
    mode: 'reprise',
    champIdentifiantPatient: 'NUM_PATIENT',
    champIdentifiantEnregistrement: 'ID_OBS',
    champCode: 'CODE',
    champValeur: 'VALEUR',
    dateValeur: { champ: 'DT_EVT', format: 'date-francaise' },
    dateEnregistrement: { champ: 'DT_SAISIE', format: 'date-francaise' },
    champAuteur: 'AUTEUR',
    codes: { POIDS: 'poids' },
  },
  'nlp/comptes_rendus_consultation': {
    source: 'nlp',
    table: 'comptes_rendus_consultation',
    disposition: 'longue',
    mode: 'extraction-nlp',
    champIdentifiantPatient: 'PATIENT_ID',
    champIdentifiantEnregistrement: 'EXTRACTION_ID',
    champCode: 'ENTITY',
    champValeur: 'VALUE',
    champValeurBrute: 'TEXT_SPAN',
    dateValeur: { champ: 'DOCUMENT_DATE', format: 'date-iso' },
    dateEnregistrement: { champ: 'EXTRACTED_AT', format: 'date-heure-iso' },
    champAuteur: 'DOCUMENT_AUTHOR',
    champConfiance: 'CONFIDENCE',
    champsDocument: { identifiant: 'DOCUMENT_ID', systeme: 'DOCUMENT_SYSTEM', type: 'DOCUMENT_TYPE', url: 'DOCUMENT_URL' },
    codes: { body_weight: 'poids', t_stage: 'categorieT', primary_site: 'localisationPrimitive' },
  },
});

/**
 * @param {string} source
 * @param {string} table
 */
export function obtenirCorrespondance(source, table) {
  const correspondance = CORRESPONDANCES_SOURCES[`${source}/${table}`];
  if (!correspondance) {
    throw new ErreurDomaine('SOURCE_INCONNUE', `Aucune correspondance pour la source « ${source} », table « ${table} »`);
  }
  return correspondance;
}

/**
 * @typedef {object} ExtractionSource
 * A raw extraction as delivered by a source system.
 * @property {string} source
 * @property {string} table
 * @property {string} [extraitLe]
 * @property {Record<string, unknown>[]} lignes
 */

/**
 * Turns a raw source extraction into sourced values.
 * @param {ExtractionSource} extraction
 * @param {{ dateIntegration: string }} contexte
 * @returns {{ valeurs: ReadonlyArray<import('./valeur-sourcee.js').ValeurSourcee>,
 *             ignores: { identifiantEnregistrement: string, champ: string, motif: string }[] }}
 */
export function transcrireExtraction(extraction, { dateIntegration }) {
  if (!extraction || !Array.isArray(extraction.lignes)) {
    throw new ErreurDomaine('EXTRACTION_INVALIDE', 'Une extraction doit avoir une source, une table et une liste de lignes');
  }
  const correspondance = obtenirCorrespondance(extraction.source, extraction.table);
  const valeurs = [];
  const ignores = [];
  for (const ligne of extraction.lignes) {
    const cellules =
      correspondance.disposition === 'large'
        ? cellulesLarges(correspondance, ligne, ignores)
        : cellulesLongues(correspondance, ligne, ignores);
    for (const cellule of cellules) valeurs.push(versValeurSourcee(correspondance, ligne, cellule, dateIntegration));
  }
  return { valeurs, ignores };
}

function cellulesLarges(correspondance, ligne, ignores) {
  const cellules = [];
  for (const [champ, brute] of Object.entries(ligne)) {
    if (champ === correspondance.champIdentifiantPatient || champ === correspondance.dateEnregistrement.champ) continue;
    const colonne = correspondance.colonnes[champ];
    if (colonne) cellules.push({ attribut: colonne.attribut, champ, brute, valeurBrute: brute, formatDate: colonne.formatDate });
    else ignores.push({ identifiantEnregistrement: String(ligne[correspondance.champIdentifiantEnregistrement]), champ, motif: 'colonne non rattachée à un attribut' });
  }
  return cellules;
}

function cellulesLongues(correspondance, ligne, ignores) {
  const code = ligne[correspondance.champCode];
  const attribut = correspondance.codes[code];
  if (!attribut) {
    ignores.push({
      identifiantEnregistrement: String(ligne[correspondance.champIdentifiantEnregistrement]),
      champ: `${correspondance.champCode}=${code}`,
      motif: 'code non rattaché à un attribut',
    });
    return [];
  }
  return [{
    attribut,
    champ: correspondance.champValeur,
    brute: ligne[correspondance.champValeur],
    valeurBrute: correspondance.champValeurBrute ? ligne[correspondance.champValeurBrute] : ligne[correspondance.champValeur],
  }];
}

function versValeurSourcee(correspondance, ligne, cellule, dateIntegration) {
  const identifiantEnregistrement = String(ligne[correspondance.champIdentifiantEnregistrement]);
  const dateEnregistrement = parseDateTime(ligne[correspondance.dateEnregistrement.champ], correspondance.dateEnregistrement.format);
  if (!dateEnregistrement) {
    throw new ErreurDomaine(
      'EXTRACTION_INVALIDE',
      `Enregistrement ${identifiantEnregistrement} : date d'enregistrement « ${ligne[correspondance.dateEnregistrement.champ]} » illisible`,
    );
  }
  const { valeur, erreurAnalyse } = normaliserValeur(cellule.attribut, cellule.brute, { formatDate: cellule.formatDate });
  const provenance = {
    source: correspondance.source,
    table: correspondance.table,
    champ: cellule.champ,
    identifiantEnregistrement,
    mode: correspondance.mode,
    auteur: correspondance.champAuteur ? (ligne[correspondance.champAuteur] ?? null) : null,
  };
  if (correspondance.champConfiance) provenance.confianceExtraction = Number(ligne[correspondance.champConfiance]);
  if (correspondance.champsDocument) {
    provenance.document = Object.fromEntries(
      Object.entries(correspondance.champsDocument).map(([cle, champ]) => [cle, ligne[champ] ?? null]),
    );
  }
  return creerValeurSourcee({
    identifiantPatient: String(ligne[correspondance.champIdentifiantPatient]),
    attribut: cellule.attribut,
    valeur,
    valeurBrute: cellule.valeurBrute ?? null,
    erreurAnalyse,
    dateValeur: correspondance.dateValeur ? parseDate(ligne[correspondance.dateValeur.champ], correspondance.dateValeur.format) : null,
    dateEnregistrement,
    dateIntegration,
    provenance,
  });
}
