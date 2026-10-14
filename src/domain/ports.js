/**
 * Ports: contracts the domain expects from the outside world.
 * Scenarios receive implementations of these contracts; they never import them.
 * This file only holds type definitions.
 */

/**
 * @typedef {object} DepotValeursSourcees
 * @property {(valeurs: ReadonlyArray<import('./valeur-sourcee.js').ValeurSourcee>) => Promise<void>} enregistrerTout
 * @property {(id: string) => Promise<boolean>} existe
 * @property {(identifiantPatient: string) => Promise<import('./valeur-sourcee.js').ValeurSourcee[]>} trouverParPatient
 */

/**
 * @typedef {object} DepotReglesQualite
 * @property {(regle: import('./regles-qualite.js').RegleQualite) => Promise<void>} enregistrer
 * @property {() => Promise<import('./regles-qualite.js').RegleQualite[]>} trouverTout
 * @property {(identifiant: string) => Promise<import('./regles-qualite.js').RegleQualite[]>} trouverVersions
 */

/**
 * @typedef {object} Horloge
 * @property {() => string} maintenant - current date-time, 'YYYY-MM-DDTHH:mm:ss'
 */

export {};
