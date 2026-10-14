import { obtenirAttribut } from './attributs.js';
import { datePart, endOfDayInstant } from './dates.js';
import { fiabiliteDe } from './fiabilite.js';
import { USAGES, evaluerRegle, selectionnerReglesApplicables } from './regles-qualite.js';

/** Confidence adjustments: working assumptions to be discussed with the business. */
export const POLITIQUE_CONFIANCE = Object.freeze({
  bonusParSourceConcordante: 0.1,
  penaliteConflit: 0.3,
  penaliteParAvertissement: 0.1,
  seuilHaute: 0.8,
  seuilMoyenne: 0.5,
});

/**
 * Consolidates all the values stated by the sources for one attribute of one patient.
 *
 * Steps:
 *  1. keep the values known at `aLaDate` (recording date <= aLaDate);
 *  2. run the quality rules in force at `aLaDate`; values failing a blocking rule are rejected;
 *  3. group the remaining values by value date: the latest date is the current state,
 *     older dates are the history (an evolution, not a conflict);
 *  4. inside a value date, identical values are concordant, different values are a conflict.
 *
 * @param {object} entree
 * @param {string} entree.attribut
 * @param {ReadonlyArray<import('./valeur-sourcee.js').ValeurSourcee>} entree.valeurs
 * @param {ReadonlyArray<import('./regles-qualite.js').RegleQualite>} entree.regles
 * @param {string} entree.aLaDate - date or date-time
 */
export function consoliderAttribut({ attribut, valeurs, regles, aLaDate }) {
  const definition = obtenirAttribut(attribut);
  const instant = endOfDayInstant(aLaDate);
  const dateReference = datePart(instant);
  const reglesApplicables = selectionnerReglesApplicables(regles, { attribut, date: dateReference });

  const evaluees = valeurs
    .filter((valeur) => valeur.attribut === attribut && valeur.dateEnregistrement <= instant)
    .map((valeur) => evaluer(valeur, reglesApplicables, dateReference));

  const rejetees = evaluees.filter(estRejetee);
  const acceptees = evaluees.filter((element) => !estRejetee(element));
  const base = { attribut, entite: definition.entite, temporel: definition.temporel };

  if (acceptees.length === 0) {
    return {
      ...base,
      valeur: null,
      dateValeur: null,
      statut: evaluees.length === 0 ? 'sans-donnee' : 'sans-valeur-valide',
      aRevoir: rejetees.length > 0,
      qualite: null,
      sources: [],
      alternatives: [],
      rejetees: rejetees.map(decrireSource),
      historique: [],
    };
  }

  const [courant, ...anciens] = grouperParDateValeur(acceptees).map(resoudreGroupe);
  const retenue = courant.retenue;
  const avertissements = retenue.controles.filter(
    (controle) => controle.resultat === 'echec' && controle.severite === 'avertissement' && controle.usages.length === 0,
  );
  const score = borner(
    retenue.fiabilite.score +
      POLITIQUE_CONFIANCE.bonusParSourceConcordante * (courant.concordantes.length - 1) -
      (courant.conflit ? POLITIQUE_CONFIANCE.penaliteConflit : 0) -
      POLITIQUE_CONFIANCE.penaliteParAvertissement * avertissements.length,
  );

  return {
    ...base,
    valeur: retenue.valeur.valeur,
    dateValeur: retenue.valeur.dateValeur,
    statut: courant.conflit ? 'conflit' : 'consolidee',
    aRevoir: courant.conflit || rejetees.length > 0,
    qualite: {
      confiance: { score, niveau: niveauConfiance(score) },
      motif: expliquer(courant, avertissements, rejetees.length),
      aptitude: Object.fromEntries(USAGES.map((usage) => [usage, estApte(retenue, usage)])),
      controles: retenue.controles.map(decrireControle),
    },
    sources: courant.concordantes.map(decrireSource),
    alternatives: courant.alternatives.map(decrireSource),
    rejetees: rejetees.map(decrireSource),
    historique: anciens.map((groupe) => ({
      valeur: groupe.retenue.valeur.valeur,
      dateValeur: groupe.retenue.valeur.dateValeur,
      statut: groupe.conflit ? 'conflit' : 'consolidee',
      sources: groupe.concordantes.map(decrireSource),
      alternatives: groupe.alternatives.map(decrireSource),
    })),
  };
}

function evaluer(valeur, regles, dateReference) {
  const controles = regles
    .map((regle) => evaluerRegle(regle, valeur, { dateReference }))
    .filter((controle) => controle.resultat !== 'non-applicable');
  return { valeur, fiabilite: fiabiliteDe(valeur), controles };
}

function estRejetee(element) {
  return element.controles.some(
    (controle) => controle.resultat === 'echec' && controle.severite === 'bloquante' && controle.usages.length === 0,
  );
}

function estApte(element, usage) {
  return !element.controles.some((controle) => controle.resultat === 'echec' && controle.usages.includes(usage));
}

/** Groups by value date, most recent first. Timeless values form a single group. */
function grouperParDateValeur(elements) {
  const groupes = new Map();
  for (const element of elements) {
    const cle = element.valeur.dateValeur ?? 'intemporel';
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(element);
  }
  return [...groupes.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([, groupe]) => groupe);
}

/** Retains the most reliable value of a group, then the most recently recorded one. */
function resoudreGroupe(groupe) {
  const classes = [...groupe].sort(
    (a, b) =>
      b.fiabilite.score - a.fiabilite.score ||
      (a.valeur.dateEnregistrement < b.valeur.dateEnregistrement ? 1 : -1),
  );
  const retenue = classes[0];
  const identique = (element) => JSON.stringify(element.valeur.valeur) === JSON.stringify(retenue.valeur.valeur);
  const concordantes = classes.filter(identique);
  const alternatives = classes.filter((element) => !identique(element));
  return { retenue, concordantes, alternatives, conflit: alternatives.length > 0 };
}

function expliquer(groupe, avertissements, nombreRejetees) {
  const parties = [];
  const { retenue, concordantes, alternatives } = groupe;
  const nomSource = (element) => `${element.valeur.provenance.source} (${element.valeur.provenance.mode})`;
  if (groupe.conflit) {
    parties.push(
      `Conflit à la même date de valeur : ${concordantes.length + alternatives.length} sources divergent ; ` +
        `la valeur de ${nomSource(retenue)} est retenue comme la plus fiable. Revue nécessaire.`,
    );
  } else if (concordantes.length > 1) {
    parties.push(`${concordantes.length} sources concordantes à la même date de valeur.`);
  } else {
    parties.push(`Source unique : ${nomSource(retenue)}.`);
  }
  parties.push(`Fiabilité de la source retenue : ${retenue.fiabilite.niveau}.`);
  if (avertissements.length > 0) {
    parties.push(`Avertissements : ${avertissements.map((controle) => controle.identifiantRegle).join(', ')}.`);
  }
  if (nombreRejetees > 0) parties.push(`${nombreRejetees} valeur(s) rejetée(s) par des règles bloquantes.`);
  return parties.join(' ');
}

function decrireControle(controle) {
  return {
    identifiantRegle: controle.identifiantRegle,
    versionRegle: controle.versionRegle,
    dimension: controle.dimension,
    severite: controle.severite,
    usages: controle.usages,
    resultat: controle.resultat,
  };
}

function decrireSource(element) {
  const { valeur } = element;
  return {
    valeur: valeur.valeur,
    valeurBrute: valeur.valeurBrute,
    ...(valeur.erreurAnalyse ? { erreurAnalyse: valeur.erreurAnalyse } : {}),
    dateValeur: valeur.dateValeur,
    dateEnregistrement: valeur.dateEnregistrement,
    dateIntegration: valeur.dateIntegration,
    provenance: valeur.provenance,
    fiabilite: element.fiabilite.niveau,
    controles: element.controles.map(decrireControle),
  };
}

function borner(score) {
  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

function niveauConfiance(score) {
  if (score >= POLITIQUE_CONFIANCE.seuilHaute) return 'haute';
  if (score >= POLITIQUE_CONFIANCE.seuilMoyenne) return 'moyenne';
  return 'faible';
}
