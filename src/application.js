import { readFile } from 'node:fs/promises';
import { integrerDonnees, extraireDonnees, definirRegleQualite } from './scenarios/index.js';
import { InMemoryDocumentStore } from './infrastructure/document-store/in-memory-document-store.js';
import { DocumentSourcedValueRepository } from './infrastructure/repositories/document-sourced-value-repository.js';
import { DocumentQualityRuleRepository } from './infrastructure/repositories/document-quality-rule-repository.js';
import { createHttpGateway } from './infrastructure/gateway/http-gateway.js';

const DEFAULT_RULES = new URL('../config/regles-qualite-par-defaut.json', import.meta.url);

/**
 * Composition root: wires the infrastructure simulators to the scenarios and the gateway.
 * @param {{ clock: import('./domain/ports.js').Horloge, store?: InMemoryDocumentStore }} options
 */
export async function createApplication({ clock, store = new InMemoryDocumentStore() }) {
  const dependances = {
    depotValeursSourcees: new DocumentSourcedValueRepository(store),
    depotReglesQualite: new DocumentQualityRuleRepository(store),
    horloge: clock,
  };
  const scenarios = {
    integrerDonnees: (extraction) => integrerDonnees(extraction, dependances),
    extraireDonnees: (requete) => extraireDonnees(requete, dependances),
    definirRegleQualite: (definition) => definirRegleQualite(definition, dependances),
  };
  const regles = JSON.parse(await readFile(DEFAULT_RULES, 'utf8'));
  for (const regle of regles) await scenarios.definirRegleQualite(regle);
  return { scenarios, gateway: createHttpGateway(scenarios) };
}
