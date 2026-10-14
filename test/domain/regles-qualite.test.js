import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluerRegle, selectionnerReglesApplicables, ErreurDomaine } from '../../src/domain/index.js';
import { uneRegle, uneRegleFraicheurRcp, uneValeur } from '../support/fakes.js';

const contexte = { dateReference: '2026-10-01' };

test("un contrôle d'intervalle réussit dans l'intervalle et échoue hors de l'intervalle ou sans valeur", () => {
  const regle = uneRegle();
  assert.equal(evaluerRegle(regle, uneValeur({ valeur: 1 }), contexte).resultat, 'reussi');
  assert.equal(evaluerRegle(regle, uneValeur({ valeur: 6 }), contexte).resultat, 'echec');
  assert.equal(evaluerRegle(regle, uneValeur({ valeur: null }), contexte).resultat, 'echec');
});

test('un contrôle de motif porte sur la valeur canonique', () => {
  const regle = uneRegle({ identifiant: 'LOC', attribut: 'localisationPrimitive', typeControle: 'motif', parametres: { expression: '^C\\d{2}\\.\\d$' } });
  assert.equal(evaluerRegle(regle, uneValeur({ attribut: 'localisationPrimitive', valeur: 'C34.1' }), contexte).resultat, 'reussi');
  assert.equal(evaluerRegle(regle, uneValeur({ attribut: 'localisationPrimitive', valeur: 'C34.10' }), contexte).resultat, 'echec');
});

test('un contrôle de fraîcheur compare la date de valeur à la date de référence', () => {
  const regle = uneRegleFraicheurRcp();
  assert.equal(evaluerRegle(regle, uneValeur({ dateValeur: '2026-09-20' }), contexte).resultat, 'reussi');
  assert.equal(evaluerRegle(regle, uneValeur({ dateValeur: '2026-09-12' }), contexte).resultat, 'echec');
  assert.equal(evaluerRegle(regle, uneValeur({ attribut: 'dateNaissance', valeur: '1955-07-02', dateValeur: null }), contexte).resultat, 'non-applicable');
});

test("un contrôle de provenance vérifie que l'auteur est connu", () => {
  const regle = uneRegle({ identifiant: 'AUTEUR', attribut: '*', typeControle: 'provenance-requise', parametres: { champs: ['auteur'] }, dimension: 'completude', severite: 'avertissement' });
  assert.equal(evaluerRegle(regle, uneValeur(), contexte).resultat, 'reussi');
  assert.equal(evaluerRegle(regle, uneValeur({ provenance: { auteur: null } }), contexte).resultat, 'echec');
});

test('la dernière version en vigueur à la date est retenue, les règles inactives sont ignorées', () => {
  const regles = [
    uneRegle({ version: 1, parametres: { min: 0, max: 5 } }),
    uneRegle({ version: 2, parametres: { min: 0, max: 4 }, dateEffet: '2026-09-01' }),
    uneRegle({ identifiant: 'ANCIENNE', version: 1, active: false }),
    uneRegle({ identifiant: 'AUTRE', attribut: 'categorieT', typeControle: 'motif', parametres: { expression: '.*' } }),
  ];
  assert.deepEqual(selectionnerReglesApplicables(regles, { attribut: 'statutOms', date: '2026-08-01' }).map((r) => r.version), [1]);
  assert.deepEqual(selectionnerReglesApplicables(regles, { attribut: 'statutOms', date: '2026-10-01' }).map((r) => r.version), [2]);
});

test('une définition de règle invalide est refusée', () => {
  assert.throws(() => uneRegle({ dimension: 'beaute' }), (erreur) => erreur instanceof ErreurDomaine && erreur.code === 'REGLE_INVALIDE');
  assert.throws(() => uneRegle({ typeControle: 'motif', parametres: { expression: '(' } }), /expression régulière/);
});
