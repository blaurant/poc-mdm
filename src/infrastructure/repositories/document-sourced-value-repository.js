import { creerValeurSourcee } from '../../domain/index.js';

/**
 * Sourced values stored as documents, one document per value.
 * Implements the DepotValeursSourcees port of the domain.
 */
export class DocumentSourcedValueRepository {
  #collection;

  /** @param {{ collection: (name: string) => any }} store */
  constructor(store) {
    this.#collection = store.collection('valeursSourcees');
  }

  async enregistrerTout(valeurs) {
    await this.#collection.insertMany(valeurs.map((valeur) => ({ _id: valeur.id, ...valeur })));
  }

  async existe(id) {
    return (await this.#collection.countDocuments({ _id: id })) > 0;
  }

  async trouverParPatient(identifiantPatient) {
    const documents = await this.#collection.find({ identifiantPatient });
    return documents.map(({ _id, ...champs }) => creerValeurSourcee(champs));
  }
}
