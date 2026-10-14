import { ErreurDomaine } from './erreurs.js';
import { obtenirAttribut } from './attributs.js';

/** How a value was produced in its source. */
export const MODES_ACQUISITION = Object.freeze(['saisie-structuree', 'reprise', 'extraction-nlp']);

/**
 * @typedef {object} Provenance
 * @property {string} source - source system (e.g. 'dxcare', 'simbad', 'nlp')
 * @property {string} table - table or feed inside the source
 * @property {string} champ - field holding the value
 * @property {string} identifiantEnregistrement - identifier of the record in the source
 * @property {string} mode - one of MODES_ACQUISITION
 * @property {string | null} auteur - who recorded the value in the source
 * @property {number} [confianceExtraction] - confidence of an NLP extraction (0..1)
 * @property {{ identifiant: string, systeme: string, type: string, url: string }} [document] - source document
 */

/**
 * @typedef {object} ValeurSourcee
 * A single value as stated by one source, with its dates and its provenance.
 * @property {string} id
 * @property {string} identifiantPatient
 * @property {string} attribut
 * @property {string | number | null} valeur - canonical value (null when it could not be parsed)
 * @property {unknown} valeurBrute - value as received from the source
 * @property {string | null} erreurAnalyse
 * @property {string | null} dateValeur - date at which the value was true ('YYYY-MM-DD'); null for timeless attributes
 * @property {string} dateEnregistrement - date-time at which the source recorded the value
 * @property {string} dateIntegration - date-time at which the MDM integrated the value
 * @property {Provenance} provenance
 */

/**
 * Creates an immutable sourced value.
 * @param {Omit<ValeurSourcee, 'id'> & { id?: string }} champs
 * @returns {Readonly<ValeurSourcee>}
 */
export function creerValeurSourcee(champs) {
  const { identifiantPatient, attribut, dateEnregistrement, dateIntegration, provenance } = champs;
  const refuser = (message) => {
    throw new ErreurDomaine('VALEUR_SOURCEE_INVALIDE', message);
  };
  if (!identifiantPatient) refuser('Une valeur sourcée doit avoir un identifiant patient');
  obtenirAttribut(attribut);
  if (!dateEnregistrement) refuser("Une valeur sourcée doit avoir une date d'enregistrement");
  if (!dateIntegration) refuser("Une valeur sourcée doit avoir une date d'intégration");
  if (!provenance?.source || !provenance?.identifiantEnregistrement) {
    refuser("Une valeur sourcée doit avoir une source et l'identifiant de l'enregistrement source");
  }
  if (!MODES_ACQUISITION.includes(provenance.mode)) refuser(`Mode d'acquisition inconnu « ${provenance.mode} »`);
  const id =
    champs.id ??
    `${provenance.source}/${provenance.table}/${provenance.identifiantEnregistrement}/${attribut}@${dateEnregistrement}`;
  return Object.freeze({
    id,
    identifiantPatient,
    attribut,
    valeur: champs.valeur ?? null,
    valeurBrute: champs.valeurBrute ?? null,
    erreurAnalyse: champs.erreurAnalyse ?? null,
    dateValeur: champs.dateValeur ?? null,
    dateEnregistrement,
    dateIntegration,
    provenance: Object.freeze({ ...provenance }),
  });
}
