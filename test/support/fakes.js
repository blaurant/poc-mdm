// Test doubles for the domain ports. They live in the tests, not in the infrastructure.
import { creerRegleQualite, creerValeurSourcee } from '../../src/domain/index.js';

export class FauxDepotValeursSourcees {
  valeurs = [];

  async enregistrerTout(valeurs) {
    this.valeurs.push(...valeurs);
  }

  async existe(id) {
    return this.valeurs.some((valeur) => valeur.id === id);
  }

  async trouverParPatient(identifiantPatient) {
    return this.valeurs.filter((valeur) => valeur.identifiantPatient === identifiantPatient);
  }
}

export class FauxDepotReglesQualite {
  regles = [];

  async enregistrer(regle) {
    this.regles.push(regle);
  }

  async trouverTout() {
    return [...this.regles];
  }

  async trouverVersions(identifiant) {
    return this.regles.filter((regle) => regle.identifiant === identifiant);
  }
}

export function fausseHorloge(maintenant) {
  return { maintenant: () => maintenant };
}

/** Builds a sourced value with sensible defaults for tests. */
export function uneValeur(surcharges = {}) {
  const { provenance, ...reste } = surcharges;
  return creerValeurSourcee({
    identifiantPatient: 'P1',
    attribut: 'statutOms',
    valeur: 1,
    valeurBrute: '1',
    dateValeur: '2026-09-12',
    dateEnregistrement: '2026-09-12T10:00:00',
    dateIntegration: '2026-10-01T08:00:00',
    ...reste,
    provenance: {
      source: 'dxcare',
      table: 'c_quest',
      champ: 'VALEUR',
      identifiantEnregistrement: `E-${Math.random().toString(36).slice(2, 8)}`,
      mode: 'saisie-structuree',
      auteur: 'MED-1',
      ...provenance,
    },
  });
}

/** Builds a quality rule with sensible defaults for tests. */
export function uneRegle(surcharges = {}) {
  return creerRegleQualite({
    identifiant: 'OMS-INTERVALLE',
    version: 1,
    attribut: 'statutOms',
    dimension: 'conformite',
    typeControle: 'intervalle',
    parametres: { min: 0, max: 5 },
    severite: 'bloquante',
    auteur: 'bureau-donnees',
    dateEffet: '2026-01-01',
    definieLe: '2026-01-01T00:00:00',
    ...surcharges,
  });
}

/** A freshness rule for the RCP usage, used by several tests. */
export function uneRegleFraicheurRcp(surcharges = {}) {
  return uneRegle({
    identifiant: 'OMS-FRAICHEUR-RCP',
    dimension: 'fraicheur',
    typeControle: 'anciennete-max-jours',
    parametres: { jours: 15 },
    severite: 'avertissement',
    usages: ['rcp'],
    ...surcharges,
  });
}
