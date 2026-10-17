import { ATTRIBUTS, ENTITES } from './attributs.js';
import { consoliderAttribut } from './consolidation.js';

/**
 * Builds the enriched record of a patient: every attribute consolidated from all its sources,
 * with quality, provenance and history, at `aLaDate` as known at `connuLe` (default `aLaDate`).
 *
 * Assumption of the POC: a patient has a single pathology.
 *
 * @param {object} entree
 * @param {string} entree.identifiantPatient
 * @param {ReadonlyArray<import('./valeur-sourcee.js').ValeurSourcee>} entree.valeurs
 * @param {ReadonlyArray<import('./regles-qualite.js').RegleQualite>} entree.regles
 * @param {string} entree.aLaDate - date or date-time
 * @param {string} [entree.connuLe] - date or date-time, default `aLaDate`
 * @param {string} entree.extraitLe - date-time of the extraction
 */
export function construireDossierPatient({ identifiantPatient, valeurs, regles, aLaDate, connuLe, extraitLe }) {
  const dossier = { identifiantPatient, aLaDate, connuLe: connuLe ?? aLaDate, extraitLe };
  for (const entite of ENTITES) dossier[entite] = {};
  const consolides = Object.values(ATTRIBUTS).map((attribut) =>
    consoliderAttribut({ attribut: attribut.cle, valeurs, regles, aLaDate, connuLe }),
  );
  for (const consolide of consolides) {
    const { entite, ...reste } = consolide;
    dossier[entite][consolide.attribut] = reste;
  }
  dossier.synthese = {
    attributs: consolides.length,
    consolides: consolides.filter((element) => element.statut === 'consolidee').length,
    conflits: consolides.filter((element) => element.statut === 'conflit').length,
    aRevoir: consolides.filter((element) => element.aRevoir).map((element) => element.attribut),
    valeursRejetees: consolides.reduce((total, element) => total + element.rejetees.length, 0),
  };
  return dossier;
}
