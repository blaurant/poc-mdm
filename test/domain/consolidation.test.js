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
    attribut: 'poids',
    valeurs: [simbad({ valeur: 72, dateValeur: '2026-06-03', dateEnregistrement: '2026-07-01T00:00:00' }), dxcare({ valeur: 68 })],
    regles,
    aLaDate,
  });
  assert.equal(resultat.statut, 'consolidee');
  assert.equal(resultat.valeur, 68);
  assert.equal(resultat.dateValeur, '2026-09-12');
  assert.deepEqual(resultat.historique.map((entree) => [entree.valeur, entree.dateValeur]), [[72, '2026-06-03']]);
  assert.equal(resultat.aRevoir, false);
});

test('des valeurs identiques à la même date de valeur sont concordantes et augmentent la confiance', () => {
  const resultat = consoliderAttribut({
    attribut: 'poids',
    valeurs: [dxcare({ valeur: 68 }), nlp({ valeur: 68, dateEnregistrement: '2026-09-13T02:00:00' })],
    regles,
    aLaDate,
  });
  assert.equal(resultat.sources.length, 2);
  assert.deepEqual(resultat.qualite.confiance, { score: 1, niveau: 'haute' });
});

test('des valeurs différentes à la même date de valeur sont un conflit : la source la plus fiable gagne et une revue est demandée', () => {
  const resultat = consoliderAttribut({
    attribut: 'poids',
    valeurs: [nlp({ valeur: 74 }, 0.91), dxcare({ valeur: 70 })],
    regles,
    aLaDate,
  });
  assert.equal(resultat.statut, 'conflit');
  assert.equal(resultat.valeur, 70);
  assert.deepEqual(resultat.alternatives.map((alternative) => alternative.valeur), [74]);
  assert.equal(resultat.aRevoir, true);
  assert.deepEqual(resultat.qualite.confiance, { score: 0.6, niveau: 'moyenne' });
});

test('une valeur en échec sur une règle bloquante est rejetée mais reste visible', () => {
  const resultat = consoliderAttribut({
    attribut: 'poids',
    valeurs: [dxcare({ valeur: 680 }), nlp({ valeur: 68 })],
    regles,
    aLaDate,
  });
  assert.equal(resultat.valeur, 68);
  assert.deepEqual(resultat.rejetees.map((rejetee) => rejetee.valeur), [680]);
  assert.equal(resultat.aRevoir, true);
});

test("une règle liée à un usage ne change que l'aptitude à cet usage", () => {
  const resultat = consoliderAttribut({ attribut: 'poids', valeurs: [dxcare({ valeur: 68 })], regles: [...regles, uneRegleFraicheurRcp()], aLaDate });
  assert.deepEqual(resultat.qualite.aptitude, { rcp: false, recherche: true });
  assert.deepEqual(resultat.qualite.confiance, { score: 0.9, niveau: 'haute' });
});

test('à une date passée, seules les valeurs enregistrées et les règles en vigueur à cette date sont utilisées', () => {
  const resultat = consoliderAttribut({
    attribut: 'poids',
    valeurs: [simbad({ valeur: 72, dateValeur: '2026-06-03', dateEnregistrement: '2026-07-01T00:00:00' }), dxcare({ valeur: 68 })],
    regles: [...regles, uneRegleFraicheurRcp({ dateEffet: '2026-10-01' })],
    aLaDate: '2026-08-01',
  });
  assert.equal(resultat.valeur, 72);
  assert.ok(!resultat.qualite.controles.some((controle) => controle.identifiantRegle === 'POIDS-FRAICHEUR-RCP'));
});

test('bitemporalité : ce que le MDM montrait à une date diffère de ce que l’on sait aujourd’hui de cette date', () => {
  const valeurs = [
    dxcare({ valeur: 68, dateValeur: '2026-09-12', dateEnregistrement: '2026-09-12T10:32:00' }),
    // late entry: a consultation of 18/09 typed on 25/09
    dxcare({ valeur: 62, dateValeur: '2026-09-18', dateEnregistrement: '2026-09-25T14:00:00' }),
  ];
  // retroactive rule: defined on 05/10, in force from 01/09
  const regleTardive = uneRegleFraicheurRcp({ parametres: { jours: 7 }, dateEffet: '2026-09-01', definieLe: '2026-10-05T09:00:00' });
  const consulter = (connuLe) => consoliderAttribut({ attribut: 'poids', valeurs, regles: [...regles, regleTardive], aLaDate: '2026-09-20', connuLe });

  const montre = consulter();
  assert.equal(montre.valeur, 68);
  assert.equal(montre.qualite.aptitude.rcp, true);
  assert.ok(!montre.qualite.controles.some((controle) => controle.identifiantRegle === 'POIDS-FRAICHEUR-RCP'));

  const suAujourdhui = consulter('2026-10-05T09:00:00');
  assert.equal(suAujourdhui.valeur, 62);
  assert.equal(suAujourdhui.dateValeur, '2026-09-18');
  assert.ok(suAujourdhui.qualite.controles.some((controle) => controle.identifiantRegle === 'POIDS-FRAICHEUR-RCP'));
});

test('une valeur dont la date de valeur est postérieure à aLaDate est ignorée', () => {
  const resultat = consoliderAttribut({
    attribut: 'poids',
    valeurs: [dxcare({ valeur: 68, dateValeur: '2026-09-12' }), dxcare({ valeur: 62, dateValeur: '2026-09-30', dateEnregistrement: '2026-09-30T10:00:00' })],
    regles,
    aLaDate: '2026-09-20',
    connuLe: '2026-10-01',
  });
  assert.equal(resultat.valeur, 68);
});

test('un dossier patient regroupe les attributs par entité et résume ce qui est à revoir', () => {
  const dossier = construireDossierPatient({
    identifiantPatient: 'P1',
    valeurs: [dxcare({ valeur: 68 }), nlp({ valeur: 74 }, 0.9), dxcare({ attribut: 'categorieT', valeur: '2a', valeurBrute: '2a' })],
    regles,
    aLaDate,
    extraitLe: '2026-10-01T08:00:00',
  });
  assert.equal(dossier.patient.poids.statut, 'conflit');
  assert.equal(dossier.pathologie.categorieT.valeur, '2a');
  assert.equal(dossier.patient.dateNaissance.statut, 'sans-donnee');
  assert.deepEqual(dossier.synthese.aRevoir, ['poids']);
});
