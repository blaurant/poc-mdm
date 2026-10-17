import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliserValeur, transcrireExtraction, ErreurDomaine } from '../../src/domain/index.js';

const contexte = { dateIntegration: '2026-10-01T08:00:00' };

test('normalise les valeurs des sources en valeurs canoniques', () => {
  assert.deepEqual(normaliserValeur('dateNaissance', '02/07/1956', { formatDate: 'date-francaise' }), { valeur: '1956-07-02', erreurAnalyse: null });
  assert.deepEqual(normaliserValeur('poids', ' 68,5 kg '), { valeur: 68.5, erreurAnalyse: null });
  assert.deepEqual(normaliserValeur('localisationPrimitive', 'c34.1 - Lobe supérieur'), { valeur: 'C34.1', erreurAnalyse: null });
  assert.deepEqual(normaliserValeur('categorieT', 'cT2a'), { valeur: '2a', erreurAnalyse: null });
});

test("garde une valeur illisible avec son erreur d'analyse au lieu d'échouer", () => {
  assert.deepEqual(normaliserValeur('poids', 'soixante'), { valeur: null, erreurAnalyse: "« soixante » n'est pas un poids en kg" });
  assert.equal(normaliserValeur('dateNaissance', '31/02/1956', { formatDate: 'date-francaise' }).valeur, null);
});

test('transcrit une extraction en disposition longue avec ses dates et sa provenance', () => {
  const { valeurs, ignores } = transcrireExtraction(
    {
      source: 'dxcare',
      table: 'c_quest',
      lignes: [
        { ID_REPONSE: 'CQ-1', NIP: 'P1', CODE_QUESTION: 'POIDS', VALEUR: '68', DATE_EVT: '2026-09-12', DATE_SAISIE: '2026-09-12T10:32:00', AUTEUR: 'MED-1' },
        { ID_REPONSE: 'CQ-2', NIP: 'P1', CODE_QUESTION: 'TABAC', VALEUR: 'Non', DATE_EVT: '2026-09-12', DATE_SAISIE: '2026-09-12T10:32:00', AUTEUR: 'MED-1' },
      ],
    },
    contexte,
  );
  assert.equal(valeurs.length, 1);
  assert.equal(valeurs[0].attribut, 'poids');
  assert.equal(valeurs[0].valeur, 68);
  assert.equal(valeurs[0].dateValeur, '2026-09-12');
  assert.equal(valeurs[0].dateEnregistrement, '2026-09-12T10:32:00');
  assert.equal(valeurs[0].dateIntegration, '2026-10-01T08:00:00');
  assert.deepEqual(valeurs[0].provenance, {
    source: 'dxcare', table: 'c_quest', champ: 'VALEUR', identifiantEnregistrement: 'CQ-1', mode: 'saisie-structuree', auteur: 'MED-1',
  });
  assert.deepEqual(ignores, [{ identifiantEnregistrement: 'CQ-2', champ: 'CODE_QUESTION=TABAC', motif: 'code non rattaché à un attribut' }]);
});

test("transcrit une extraction en disposition large ; un attribut intemporel n'a pas de date de valeur", () => {
  const { valeurs } = transcrireExtraction(
    { source: 'simbad', table: 'patient', lignes: [{ NUM_PATIENT: 'P1', DT_NAIS: '02/07/1956', DT_MAJ: '28/03/2026' }] },
    contexte,
  );
  assert.equal(valeurs[0].valeur, '1956-07-02');
  assert.equal(valeurs[0].dateValeur, null);
  assert.equal(valeurs[0].dateEnregistrement, '2026-03-28T00:00:00');
  assert.equal(valeurs[0].provenance.mode, 'reprise');
});

test("garde le document source et la confiance d'une extraction NLP", () => {
  const { valeurs } = transcrireExtraction(
    {
      source: 'nlp',
      table: 'comptes_rendus_consultation',
      lignes: [{
        EXTRACTION_ID: 'N1', PATIENT_ID: 'P1', ENTITY: 't_stage', TEXT_SPAN: 'cT3 cN2', VALUE: 'cT3', CONFIDENCE: 0.91,
        DOCUMENT_ID: 'D1', DOCUMENT_SYSTEM: 'simbad', DOCUMENT_TYPE: 'consultation-report', DOCUMENT_URL: 'https://x.test/D1',
        DOCUMENT_DATE: '2026-03-28', DOCUMENT_AUTHOR: 'MED-2', EXTRACTED_AT: '2026-03-29T02:00:00',
      }],
    },
    contexte,
  );
  assert.equal(valeurs[0].valeur, '3');
  assert.equal(valeurs[0].valeurBrute, 'cT3 cN2');
  assert.equal(valeurs[0].provenance.confianceExtraction, 0.91);
  assert.deepEqual(valeurs[0].provenance.document, { identifiant: 'D1', systeme: 'simbad', type: 'consultation-report', url: 'https://x.test/D1' });
});

test("refuse une extraction d'une source inconnue", () => {
  assert.throws(
    () => transcrireExtraction({ source: 'inconnue', table: 't', lignes: [] }, contexte),
    (erreur) => erreur instanceof ErreurDomaine && erreur.code === 'SOURCE_INCONNUE',
  );
});
