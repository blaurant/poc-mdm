import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrerDonnees, extraireDonnees, definirRegleQualite } from '../../src/scenarios/index.js';
import { ErreurDomaine } from '../../src/domain/index.js';
import { FauxDepotReglesQualite, FauxDepotValeursSourcees, fausseHorloge } from '../support/fakes.js';

const extraction = {
  source: 'dxcare',
  table: 'c_quest',
  lignes: [{ ID_REPONSE: 'CQ-1', NIP: 'P1', CODE_QUESTION: 'OMS', VALEUR: '1', DATE_EVT: '2026-09-12', DATE_SAISIE: '2026-09-12T10:32:00', AUTEUR: 'MED-1' }],
};

const regleFraicheur = {
  identifiant: 'OMS-FRAICHEUR-RCP', attribut: 'statutOms', dimension: 'fraicheur', typeControle: 'anciennete-max-jours',
  parametres: { jours: 15 }, severite: 'avertissement', usages: ['rcp'], auteur: 'data-steward', dateEffet: '2026-10-01',
};

function preparer(maintenant = '2026-10-01T08:00:00') {
  return {
    depotValeursSourcees: new FauxDepotValeursSourcees(),
    depotReglesQualite: new FauxDepotReglesQualite(),
    horloge: fausseHorloge(maintenant),
  };
}

test('integrerDonnees enregistre les valeurs sourcées et est idempotent', async () => {
  const dependances = preparer();
  const premier = await integrerDonnees(extraction, dependances);
  const second = await integrerDonnees(extraction, dependances);
  assert.equal(premier.valeursIntegrees, 1);
  assert.equal(second.valeursIntegrees, 0);
  assert.equal(second.doublonsIgnores, 1);
  assert.equal(dependances.depotValeursSourcees.valeurs[0].dateIntegration, '2026-10-01T08:00:00');
});

test('definirRegleQualite crée une nouvelle version à chaque redéfinition', async () => {
  const dependances = preparer();
  const v1 = await definirRegleQualite(regleFraicheur, dependances);
  const v2 = await definirRegleQualite({ ...regleFraicheur, parametres: { jours: 30 } }, dependances);
  assert.equal(v1.version, 1);
  assert.equal(v2.version, 2);
  assert.equal(v2.definieLe, '2026-10-01T08:00:00');
});

test('extraireDonnees applique immédiatement une règle définie à chaud', async () => {
  const dependances = preparer();
  await integrerDonnees(extraction, dependances);
  const avant = await extraireDonnees({ identifiantPatient: 'P1' }, dependances);
  await definirRegleQualite(regleFraicheur, dependances);
  const apres = await extraireDonnees({ identifiantPatient: 'P1' }, dependances);
  assert.equal(avant.patient.statutOms.qualite.aptitude.rcp, true);
  assert.equal(apres.patient.statutOms.qualite.aptitude.rcp, false);
});

test('extraireDonnees refuse un patient inconnu et une date invalide', async () => {
  const dependances = preparer();
  await assert.rejects(extraireDonnees({ identifiantPatient: 'PERSONNE' }, dependances), (erreur) => erreur instanceof ErreurDomaine && erreur.code === 'PATIENT_INCONNU');
  await assert.rejects(extraireDonnees({ identifiantPatient: 'P1', aLaDate: '01/08/2026' }, dependances), (erreur) => erreur.code === 'REQUETE_INVALIDE');
  await integrerDonnees(extraction, dependances);
  await assert.rejects(extraireDonnees({ identifiantPatient: 'P1', connuLe: 'hier' }, dependances), (erreur) => erreur.code === 'REQUETE_INVALIDE');
});

test('extraireDonnees : connuLe vaut aLaDate par défaut et peut être fourni', async () => {
  const dependances = preparer();
  await integrerDonnees(extraction, dependances);
  const parDefaut = await extraireDonnees({ identifiantPatient: 'P1', aLaDate: '2026-09-20' }, dependances);
  const fourni = await extraireDonnees({ identifiantPatient: 'P1', aLaDate: '2026-09-20', connuLe: '2026-10-01T08:00:00' }, dependances);
  assert.equal(parDefaut.connuLe, '2026-09-20');
  assert.equal(fourni.connuLe, '2026-10-01T08:00:00');
});
