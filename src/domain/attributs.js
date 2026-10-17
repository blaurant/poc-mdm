import { ErreurDomaine } from './erreurs.js';
import { parseDate } from './dates.js';

/**
 * Business attributes managed by the POC.
 * `temporel: true` means the value describes a clinical state at a given date (it has a value date);
 * `temporel: false` means the value is timeless (e.g. a birth date).
 */
export const ATTRIBUTS = Object.freeze({
  dateNaissance: Object.freeze({
    cle: 'dateNaissance',
    entite: 'patient',
    typeValeur: 'date',
    temporel: false,
    description: 'Date de naissance du patient',
  }),
  poids: Object.freeze({
    cle: 'poids',
    entite: 'patient',
    typeValeur: 'masse-kg',
    temporel: true,
    description: 'Poids du patient, en kilogrammes',
  }),
  localisationPrimitive: Object.freeze({
    cle: 'localisationPrimitive',
    entite: 'pathologie',
    typeValeur: 'topographie-cim-o-3',
    temporel: true,
    description: 'Localisation de la tumeur primitive, code topographique CIM-O-3',
  }),
  categorieT: Object.freeze({
    cle: 'categorieT',
    entite: 'pathologie',
    typeValeur: 'tnm-t',
    temporel: true,
    description: 'Catégorie T de la classification TNM (taille et extension de la tumeur primitive)',
  }),
});

/** Entities exposed by a patient record, in display order. */
export const ENTITES = Object.freeze(['patient', 'pathologie']);

/**
 * @param {string} cle
 * @returns {(typeof ATTRIBUTS)[keyof typeof ATTRIBUTS]}
 */
export function obtenirAttribut(cle) {
  const attribut = ATTRIBUTS[cle];
  if (!attribut) throw new ErreurDomaine('ATTRIBUT_INCONNU', `Attribut inconnu « ${cle} »`);
  return attribut;
}

/**
 * Converts a raw source value into the canonical value of the attribute.
 * @param {string} cleAttribut
 * @param {unknown} brute - raw value
 * @param {{ formatDate?: 'date-iso' | 'date-francaise' }} [options]
 * @returns {{ valeur: string | number | null, erreurAnalyse: string | null }}
 */
export function normaliserValeur(cleAttribut, brute, options = {}) {
  const attribut = obtenirAttribut(cleAttribut);
  if (brute === null || brute === undefined || String(brute).trim() === '') {
    return { valeur: null, erreurAnalyse: 'valeur vide' };
  }
  const texte = String(brute).trim();
  switch (attribut.typeValeur) {
    case 'date': {
      const valeur = parseDate(texte, options.formatDate ?? 'date-iso');
      return valeur ? { valeur, erreurAnalyse: null } : { valeur: null, erreurAnalyse: `« ${texte} » n'est pas une date valide` };
    }
    case 'masse-kg': {
      // Decimal comma and unit are accepted: "68,5 kg" -> 68.5
      const nombre = /^(\d+(?:[.,]\d+)?)\s*(?:kg)?$/i.exec(texte);
      return nombre
        ? { valeur: Number(nombre[1].replace(',', '.')), erreurAnalyse: null }
        : { valeur: null, erreurAnalyse: `« ${texte} » n'est pas un poids en kg` };
    }
    case 'topographie-cim-o-3':
      // Sources often append the label: "C34.1 - Lobe supérieur" -> "C34.1"
      return { valeur: texte.split(' - ')[0].trim().toUpperCase(), erreurAnalyse: null };
    case 'tnm-t':
      // The c/p/y prefix and the "T" letter are removed: "cT2a" -> "2a"
      return { valeur: texte.replace(/^[cpy]?T/i, '').trim(), erreurAnalyse: null };
    default:
      throw new ErreurDomaine('TYPE_VALEUR_INCONNU', `Type de valeur inconnu « ${attribut.typeValeur} »`);
  }
}
