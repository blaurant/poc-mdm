import { creerRegleQualite } from '../domain/index.js';

/**
 * Scenario "définir une règle qualité": adds a rule, or a new version of an existing rule, at runtime.
 * Previous versions are kept, so past evaluations remain explainable.
 *
 * @param {object} definition - rule fields except `version` and `definieLe`
 * @param {{ depotReglesQualite: import('../domain/ports.js').DepotReglesQualite,
 *           horloge: import('../domain/ports.js').Horloge }} dependances
 */
export async function definirRegleQualite(definition, { depotReglesQualite, horloge }) {
  const versions = await depotReglesQualite.trouverVersions(definition?.identifiant);
  const regle = creerRegleQualite({ ...definition, version: versions.length + 1, definieLe: horloge.maintenant() });
  await depotReglesQualite.enregistrer(regle);
  return regle;
}
