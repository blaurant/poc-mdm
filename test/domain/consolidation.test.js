import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consoliderAttribut, construireDossierPatient } from '../../src/domain/index.js';
import { uneRegle, uneRegleFraicheurRcp, uneValeur } from '../support/fakes.js';

const regles = [uneRegle()];
const aLaDate = '2026-10-01';

const dxcare = (champs) => uneValeur(champs);
const simbad = (champs) => uneValeur({ ...champs, provenance: { source: 'simbad', table: 'observations', mode: 'reprise', auteur: null } });
const nlp = (champs, confiance = 0.87) =>
  uneValeur({ ...champs, provenance: { source: 'nlp', table: 'comptes_rendus_consultation', mode: 'extraction-nlp', confianceExtraction: confiance } });

test("des dates de valeur différentes sont une évolution : la plus récente est courante, les autres sont l'historique", () => {
  const resultat = consoliderAttribut({
    attribut: 'statutOms',
    valeurs: [simbad({ valeur: 2, dateValeur: '2026-06-03', dateEnregistrement: '2026-07-01T00:00:00' }), dxcare({ valeur: 1 })],
    regles,
    aLaDate,
  });
  assert.equal(resultat.statut, 'consolidee');
  assert.equal(resultat.valeur, 1);
  assert.equal(resultat.dateValeur, '2026-09-12');
  assert.deepEqual(resultat.historique.map((entree) => [entree.valeur, entree.dateValeur]), [[2, '2026-06-03']]);
  assert.equal(resultat.aRevoir, false);
});

test('des valeurs identiques à la même date de valeur sont concordantes et augmentent la confiance', () => {
  const resultat = consoliderAttribut({
    attribut: 'statutOms',
    valeurs: [dxcare({ valeur: 1 }), nlp({ valeur: 1, dateEnregistrement: '2026-09-13T02:00:00' })],
    regles,
    aLaDate,
  });
  assert.equal(resultat.sources.length, 2);
  assert.deepEqual(resultat.qualite.confiance, { score: 1, niveau: 'haute' });
});

test('des valeurs différentes à la même date de valeur sont un conflit : la source la plus fiable gagne et une revue est demandée', () => {
  const resultat = consoliderAttribut({
    attribut: 'statutOms',
    valeurs: [nlp({ valeur: 3 }, 0.91), dxcare({ valeur: 2 })],
    regles,
    aLaDate,
  });
  assert.equal(resultat.statut, 'conflit');
  assert.equal(resultat.valeur, 2);
  assert.deepEqual(resultat.alternatives.map((alternative) => alternative.valeur), [3]);
  assert.equal(resultat.aRevoir, true);
  assert.deepEqual(resultat.qualite.confiance, { score: 0.6, niveau: 'moyenne' });
});

test('une valeur en échec sur une règle bloquante est rejetée mais reste visible', () => {
  const resultat = consoliderAttribut({
    attribut: 'statutOms',
    valeurs: [dxcare({ valeur: 6 }), nlp({ valeur: 1 })],
    regles,
    aLaDate,
  });
  assert.equal(resultat.valeur, 1);
  assert.deepEqual(resultat.rejetees.map((rejetee) => rejetee.valeur), [6]);
  assert.equal(resultat.aRevoir, true);
});

test("une règle liée à un usage ne change que l'aptitude à cet usage", () => {
  const resultat = consoliderAttribut({ attribut: 'statutOms', valeurs: [dxcare({ valeur: 1 })], regles: [...regles, uneRegleFraicheurRcp()], aLaDate });
  assert.deepEqual(resultat.qualite.aptitude, { rcp: false, recherche: true });
  assert.deepEqual(resultat.qualite.confiance, { score: 0.9, niveau: 'haute' });
});

test('à une date passée, seules les valeurs enregistrées et les règles en vigueur à cette date sont utilisées', () => {
  const resultat = consoliderAttribut({
    attribut: 'statutOms',
    valeurs: [simbad({ valeur: 2, dateValeur: '2026-06-03', dateEnregistrement: '2026-07-01T00:00:00' }), dxcare({ valeur: 1 })],
    regles: [...regles, uneRegleFraicheurRcp({ dateEffet: '2026-10-01' })],
    aLaDate: '2026-08-01',
  });
  assert.equal(resultat.valeur, 2);
  assert.ok(!resultat.qualite.controles.some((controle) => controle.identifiantRegle === 'OMS-FRAICHEUR-RCP'));
});

test('un dossier patient regroupe les attributs par entité et résume ce qui est à revoir', () => {
  const dossier = construireDossierPatient({
    identifiantPatient: 'P1',
    valeurs: [dxcare({ valeur: 1 }), nlp({ valeur: 3 }, 0.9), dxcare({ attribut: 'categorieT', valeur: '2a', valeurBrute: '2a' })],
    regles,
    aLaDate,
    extraitLe: '2026-10-01T08:00:00',
  });
  assert.equal(dossier.patient.statutOms.statut, 'conflit');
  assert.equal(dossier.pathologie.categorieT.valeur, '2a');
  assert.equal(dossier.patient.dateNaissance.statut, 'sans-donnee');
  assert.deepEqual(dossier.synthese.aRevoir, ['statutOms']);
});
