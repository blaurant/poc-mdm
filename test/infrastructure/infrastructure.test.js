import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { InMemoryDocumentStore } from '../../src/infrastructure/document-store/in-memory-document-store.js';
import { DocumentSourcedValueRepository } from '../../src/infrastructure/repositories/document-sourced-value-repository.js';
import { createHttpGateway } from '../../src/infrastructure/gateway/http-gateway.js';
import { ErreurDomaine } from '../../src/domain/index.js';
import { uneValeur } from '../support/fakes.js';

test('the document store returns copies, never the stored documents', async () => {
  const collection = new InMemoryDocumentStore().collection('things');
  await collection.insertOne({ _id: '1', nested: { tag: 'a' } });
  const found = await collection.findOne({ 'nested.tag': 'a' });
  found.nested.tag = 'changed';
  assert.equal((await collection.findOne({ _id: '1' })).nested.tag, 'a');
  await assert.rejects(collection.insertOne({ _id: '1' }), /Duplicate key/);
});

test('the sourced value repository round-trips domain values through documents', async () => {
  const depot = new DocumentSourcedValueRepository(new InMemoryDocumentStore());
  const valeur = uneValeur();
  await depot.enregistrerTout([valeur]);
  assert.equal(await depot.existe(valeur.id), true);
  assert.deepEqual(await depot.trouverParPatient('P1'), [valeur]);
});

async function withGateway(scenarios, run) {
  const server = createHttpGateway(scenarios);
  server.listen(0);
  await once(server, 'listening');
  try {
    await run(`http://localhost:${server.address().port}`);
  } finally {
    server.close();
  }
}

test('the gateway only translates HTTP calls into scenario calls', async () => {
  const calls = [];
  const scenarios = {
    integrerDonnees: async (extraction) => (calls.push(['integrerDonnees', extraction]), { valeursIntegrees: 1 }),
    extraireDonnees: async (requete) => (calls.push(['extraireDonnees', requete]), { identifiantPatient: requete.identifiantPatient }),
    definirRegleQualite: async (definition) => (calls.push(['definirRegleQualite', definition]), { identifiant: definition.identifiant, version: 1 }),
  };
  await withGateway(scenarios, async (base) => {
    const integrated = await fetch(`${base}/integrer-donnees`, { method: 'POST', body: JSON.stringify({ source: 'dxcare' }) });
    assert.equal(integrated.status, 201);
    const extracted = await fetch(`${base}/extraire-donnees?identifiantPatient=P1&aLaDate=2026-08-01`);
    assert.deepEqual(await extracted.json(), { identifiantPatient: 'P1' });
    const defined = await fetch(`${base}/regles-qualite`, { method: 'POST', body: JSON.stringify({ identifiant: 'R1' }) });
    assert.equal(defined.status, 201);
  });
  assert.deepEqual(calls, [
    ['integrerDonnees', { source: 'dxcare' }],
    ['extraireDonnees', { identifiantPatient: 'P1', aLaDate: '2026-08-01' }],
    ['definirRegleQualite', { identifiant: 'R1' }],
  ]);
});

test('the gateway translates domain errors into HTTP errors', async () => {
  const scenarios = {
    extraireDonnees: async () => {
      throw new ErreurDomaine('PATIENT_INCONNU', 'Aucune donnée');
    },
    integrerDonnees: async () => {
      throw new ErreurDomaine('SOURCE_INCONNUE', 'Aucune correspondance');
    },
  };
  await withGateway(scenarios, async (base) => {
    assert.equal((await fetch(`${base}/extraire-donnees?identifiantPatient=X`)).status, 404);
    assert.equal((await fetch(`${base}/integrer-donnees`, { method: 'POST', body: '{}' })).status, 400);
    assert.equal((await fetch(`${base}/integrer-donnees`, { method: 'POST', body: '{oops' })).status, 400);
    assert.equal((await fetch(`${base}/unknown`)).status, 404);
  });
});
