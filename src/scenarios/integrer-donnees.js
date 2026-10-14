import { transcrireExtraction } from '../domain/index.js';

/**
 * Scenario "intégrer des données": receives a raw extraction from a source system, turns each value
 * into a sourced value (canonical value, value date, recording date, provenance) and stores it.
 *
 * Values are appended, never overwritten: the full history is kept.
 * Integrating the same source record twice is idempotent.
 *
 * @param {import('../domain/lignage-sources.js').ExtractionSource} extraction
 * @param {{ depotValeursSourcees: import('../domain/ports.js').DepotValeursSourcees,
 *           horloge: import('../domain/ports.js').Horloge }} dependances
 */
export async function integrerDonnees(extraction, { depotValeursSourcees, horloge }) {
  const dateIntegration = horloge.maintenant();
  const { valeurs, ignores } = transcrireExtraction(extraction, { dateIntegration });

  const nouvelles = [];
  for (const valeur of valeurs) {
    if (!(await depotValeursSourcees.existe(valeur.id))) nouvelles.push(valeur);
  }
  await depotValeursSourcees.enregistrerTout(nouvelles);

  return {
    source: extraction.source,
    table: extraction.table,
    dateIntegration,
    lignesRecues: extraction.lignes.length,
    valeursIntegrees: nouvelles.length,
    doublonsIgnores: valeurs.length - nouvelles.length,
    patients: [...new Set(valeurs.map((valeur) => valeur.identifiantPatient))],
    valeursIllisibles: nouvelles
      .filter((valeur) => valeur.erreurAnalyse)
      .map((valeur) => ({
        identifiantEnregistrement: valeur.provenance.identifiantEnregistrement,
        attribut: valeur.attribut,
        erreur: valeur.erreurAnalyse,
      })),
    ignores,
  };
}
