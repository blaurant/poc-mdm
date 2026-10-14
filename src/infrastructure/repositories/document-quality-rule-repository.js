import { creerRegleQualite } from '../../domain/index.js';

/**
 * Quality rules stored as documents, one document per rule version.
 * Implements the DepotReglesQualite port of the domain.
 */
export class DocumentQualityRuleRepository {
  #collection;

  /** @param {{ collection: (name: string) => any }} store */
  constructor(store) {
    this.#collection = store.collection('reglesQualite');
  }

  async enregistrer(regle) {
    await this.#collection.insertOne({ _id: `${regle.identifiant}@v${regle.version}`, ...regle });
  }

  async trouverTout() {
    return (await this.#collection.find()).map(toRule);
  }

  async trouverVersions(identifiant) {
    return (await this.#collection.find({ identifiant })).map(toRule);
  }
}

function toRule({ _id, ...fields }) {
  return creerRegleQualite(fields);
}
