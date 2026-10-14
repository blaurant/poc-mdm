/**
 * In-memory simulator of a document database (MongoDB-like API).
 * Documents are serialised to JSON on write and parsed on read, as a real document store would do,
 * so callers never share references with stored documents.
 */
export class InMemoryDocumentStore {
  #collections = new Map();

  /** @param {string} name */
  collection(name) {
    if (!this.#collections.has(name)) this.#collections.set(name, new InMemoryCollection());
    return this.#collections.get(name);
  }
}

class InMemoryCollection {
  /** @type {Map<string, string>} _id -> serialised document */
  #documents = new Map();

  async insertOne(document) {
    if (!document?._id) throw new Error('A document needs an _id');
    if (this.#documents.has(document._id)) throw new Error(`Duplicate key: ${document._id}`);
    this.#documents.set(document._id, JSON.stringify(document));
  }

  async insertMany(documents) {
    for (const document of documents) await this.insertOne(document);
  }

  /** @param {Record<string, unknown>} [filter] - equality on top-level or dotted fields */
  async find(filter = {}) {
    return [...this.#documents.values()].map((text) => JSON.parse(text)).filter((document) => matches(document, filter));
  }

  async findOne(filter = {}) {
    return (await this.find(filter))[0] ?? null;
  }

  async countDocuments(filter = {}) {
    return (await this.find(filter)).length;
  }
}

function matches(document, filter) {
  return Object.entries(filter).every(([path, expected]) => {
    const actual = path.split('.').reduce((value, key) => value?.[key], document);
    return actual === expected;
  });
}
