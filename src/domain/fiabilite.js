/**
 * Reliability of a source value, derived from how it was acquired.
 * Scores are working assumptions to be discussed with the business.
 */
export const NIVEAUX_FIABILITE = Object.freeze({
  haute: 0.9,
  moyenne: 0.6,
  faible: 0.3,
});

/** Minimal NLP extraction confidence for a 'moyenne' reliability. */
export const SEUIL_CONFIANCE_NLP = 0.85;

/**
 * @param {import('./valeur-sourcee.js').ValeurSourcee} valeurSourcee
 * @returns {{ niveau: 'haute' | 'moyenne' | 'faible', score: number }}
 */
export function fiabiliteDe(valeurSourcee) {
  const { mode, confianceExtraction } = valeurSourcee.provenance;
  let niveau;
  if (mode === 'saisie-structuree') niveau = 'haute';
  else if (mode === 'reprise') niveau = 'moyenne';
  else niveau = (confianceExtraction ?? 0) >= SEUIL_CONFIANCE_NLP ? 'moyenne' : 'faible';
  return { niveau, score: NIVEAUX_FIABILITE[niveau] };
}
