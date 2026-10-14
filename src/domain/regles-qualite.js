import { ErreurDomaine } from './erreurs.js';
import { ATTRIBUTS } from './attributs.js';
import { datePart, daysBetween } from './dates.js';

/** Quality dimensions (Kahn et al. 2016, completed for the MDM). */
export const DIMENSIONS = Object.freeze([
  'conformite',
  'completude',
  'plausibilite',
  'fiabilite',
  'concordance',
  'fraicheur',
]);

/** Usages for which the fitness of a value is assessed. */
export const USAGES = Object.freeze(['rcp', 'recherche']);

/**
 * Severity of a rule without usages:
 *  - 'bloquante': a failing value is rejected (kept aside, never consolidated);
 *  - 'avertissement': the value is kept but its confidence decreases.
 * A rule with usages only affects the fitness of the value for those usages.
 */
export const SEVERITES = Object.freeze(['bloquante', 'avertissement']);

/**
 * Control types: the generic checks a rule can parameterise.
 * Each check returns `true` (passed), `false` (failed) or `null` (not applicable).
 */
const VERIFICATIONS = Object.freeze({
  intervalle: (valeur, { min, max }) => typeof valeur === 'number' && valeur >= min && valeur <= max,
  motif: (valeur, { expression }) => valeur !== null && new RegExp(expression).test(String(valeur)),
  'intervalle-dates': (valeur, { min, max }, valeurSourcee) =>
    typeof valeur === 'string' && valeur >= min && valeur <= (max ?? datePart(valeurSourcee.dateEnregistrement)),
  'date-valeur-avant-enregistrement': (_valeur, _parametres, valeurSourcee) =>
    valeurSourcee.dateValeur === null ? null : valeurSourcee.dateValeur <= datePart(valeurSourcee.dateEnregistrement),
  'provenance-requise': (_valeur, { champs }, valeurSourcee) =>
    champs.every((champ) => {
      const contenu = valeurSourcee.provenance[champ];
      return contenu !== null && contenu !== undefined && contenu !== '';
    }),
  'anciennete-max-jours': (_valeur, { jours }, valeurSourcee, { dateReference }) =>
    valeurSourcee.dateValeur === null ? null : daysBetween(valeurSourcee.dateValeur, dateReference) <= jours,
});

export const TYPES_CONTROLE = Object.freeze(Object.keys(VERIFICATIONS));

/**
 * @typedef {object} RegleQualite
 * A quality rule is data: it is defined, versioned and changed at runtime, without redeployment.
 * @property {string} identifiant
 * @property {number} version
 * @property {string} attribut - attribute key, or '*' for every attribute
 * @property {string} dimension - one of DIMENSIONS
 * @property {string} typeControle - one of TYPES_CONTROLE
 * @property {object} parametres
 * @property {string} severite - one of SEVERITES
 * @property {string[]} usages - usages affected; empty means the value itself
 * @property {string} description
 * @property {string} auteur - business owner of the rule
 * @property {string} dateEffet - 'YYYY-MM-DD', first date the rule applies to
 * @property {boolean} active
 * @property {string} definieLe - date-time at which this version was defined
 */

/**
 * Creates an immutable quality rule after validating its definition.
 * @param {Partial<RegleQualite>} definition
 * @returns {Readonly<RegleQualite>}
 */
export function creerRegleQualite(definition) {
  const refuser = (message) => {
    throw new ErreurDomaine('REGLE_INVALIDE', `Règle « ${definition?.identifiant ?? '?'} » : ${message}`);
  };
  if (!definition?.identifiant) refuser('un identifiant est obligatoire');
  if (!Number.isInteger(definition.version) || definition.version < 1) refuser('la version doit être un entier positif');
  if (definition.attribut !== '*' && !ATTRIBUTS[definition.attribut]) refuser(`attribut inconnu « ${definition.attribut} »`);
  if (!DIMENSIONS.includes(definition.dimension)) refuser(`dimension inconnue « ${definition.dimension} »`);
  if (!TYPES_CONTROLE.includes(definition.typeControle)) refuser(`type de contrôle inconnu « ${definition.typeControle} »`);
  if (!SEVERITES.includes(definition.severite)) refuser(`sévérité inconnue « ${definition.severite} »`);
  const usages = definition.usages ?? [];
  if (!usages.every((usage) => USAGES.includes(usage))) refuser(`usage inconnu dans [${usages}]`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(definition.dateEffet ?? '')) refuser("la date d'effet doit être au format AAAA-MM-JJ");
  if (!definition.auteur) refuser('un auteur métier est obligatoire');
  if (!definition.definieLe) refuser('la date de définition est obligatoire');
  if (definition.typeControle === 'motif') {
    try {
      new RegExp(definition.parametres?.expression);
    } catch {
      refuser("l'expression régulière est invalide");
    }
  }
  return Object.freeze({
    identifiant: definition.identifiant,
    version: definition.version,
    attribut: definition.attribut,
    dimension: definition.dimension,
    typeControle: definition.typeControle,
    parametres: Object.freeze({ ...(definition.parametres ?? {}) }),
    severite: definition.severite,
    usages: Object.freeze([...usages]),
    description: definition.description ?? '',
    auteur: definition.auteur,
    dateEffet: definition.dateEffet,
    active: definition.active ?? true,
    definieLe: definition.definieLe,
  });
}

/**
 * Keeps, for each rule identifier, the latest version in force at the given date for the attribute.
 * @param {ReadonlyArray<RegleQualite>} regles
 * @param {{ attribut: string, date: string }} criteres - `date` is a 'YYYY-MM-DD' date
 * @returns {RegleQualite[]}
 */
export function selectionnerReglesApplicables(regles, { attribut, date }) {
  const dernieres = new Map();
  for (const regle of regles) {
    if (regle.dateEffet > date) continue;
    const courante = dernieres.get(regle.identifiant);
    if (!courante || regle.version > courante.version) dernieres.set(regle.identifiant, regle);
  }
  return [...dernieres.values()]
    .filter((regle) => regle.active && (regle.attribut === '*' || regle.attribut === attribut))
    .sort((a, b) => a.identifiant.localeCompare(b.identifiant));
}

/**
 * @typedef {object} Controle
 * Result of one rule on one sourced value.
 * @property {string} identifiantRegle
 * @property {number} versionRegle
 * @property {string} dimension
 * @property {string} severite
 * @property {string[]} usages
 * @property {'reussi' | 'echec' | 'non-applicable'} resultat
 * @property {string} description
 */

/**
 * @param {RegleQualite} regle
 * @param {import('./valeur-sourcee.js').ValeurSourcee} valeurSourcee
 * @param {{ dateReference: string }} contexte - date used for freshness checks
 * @returns {Controle}
 */
export function evaluerRegle(regle, valeurSourcee, contexte) {
  const issue = VERIFICATIONS[regle.typeControle](valeurSourcee.valeur, regle.parametres, valeurSourcee, contexte);
  return {
    identifiantRegle: regle.identifiant,
    versionRegle: regle.version,
    dimension: regle.dimension,
    severite: regle.severite,
    usages: [...regle.usages],
    resultat: issue === null ? 'non-applicable' : issue ? 'reussi' : 'echec',
    description: regle.description,
  };
}
