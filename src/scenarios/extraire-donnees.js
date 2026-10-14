import { ErreurDomaine, construireDossierPatient } from '../domain/index.js';

/**
 * Scenario "extraire des données": returns the enriched record of a patient, consolidated from all the
 * sources, with quality, provenance and history, as known at `aLaDate` (default: now).
 *
 * Quality rules are evaluated at each extraction, so a rule defined at runtime applies immediately.
 *
 * @param {{ identifiantPatient: string, aLaDate?: string }} requete
 * @param {{ depotValeursSourcees: import('../domain/ports.js').DepotValeursSourcees,
 *           depotReglesQualite: import('../domain/ports.js').DepotReglesQualite,
 *           horloge: import('../domain/ports.js').Horloge }} dependances
 */
export async function extraireDonnees({ identifiantPatient, aLaDate }, { depotValeursSourcees, depotReglesQualite, horloge }) {
  if (!identifiantPatient) throw new ErreurDomaine('REQUETE_INVALIDE', "L'identifiant du patient est obligatoire");
  if (aLaDate !== undefined && !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(aLaDate)) {
    throw new ErreurDomaine('REQUETE_INVALIDE', `« ${aLaDate} » n'est pas une date valide (AAAA-MM-JJ ou AAAA-MM-JJTHH:mm:ss)`);
  }
  const valeurs = await depotValeursSourcees.trouverParPatient(identifiantPatient);
  if (valeurs.length === 0) throw new ErreurDomaine('PATIENT_INCONNU', `Aucune donnée pour le patient « ${identifiantPatient} »`);
  const regles = await depotReglesQualite.trouverTout();
  const extraitLe = horloge.maintenant();
  return construireDossierPatient({ identifiantPatient, valeurs, regles, aLaDate: aLaDate ?? extraitLe, extraitLe });
}
