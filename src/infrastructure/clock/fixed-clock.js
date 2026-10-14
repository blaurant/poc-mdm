/** Clock simulator returning a chosen date-time, for tests and demonstrations. Implements the Horloge port. */
export class FixedClock {
  #now;

  /** @param {string} now - 'YYYY-MM-DDTHH:mm:ss' */
  constructor(now) {
    this.#now = now;
  }

  maintenant() {
    return this.#now;
  }

  /** @param {string} now */
  set(now) {
    this.#now = now;
  }
}
