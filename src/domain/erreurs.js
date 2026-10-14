/**
 * Error raised when a business rule of the domain is violated.
 * The `code` lets outer layers translate the error without parsing messages.
 */
export class ErreurDomaine extends Error {
  /**
   * @param {string} code - stable machine-readable code (e.g. 'SOURCE_INCONNUE')
   * @param {string} message - human-readable explanation
   */
  constructor(code, message) {
    super(message);
    this.name = 'ErreurDomaine';
    this.code = code;
  }
}
