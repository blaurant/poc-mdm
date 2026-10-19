# poc-mdm

Prototype du MDM (plateforme de données de référence) de l'IGR – objectif 1 du POC : montrer au métier quel enrichissement le MDM apporte à chaque donnée (provenance, dates, qualité, historique), de l'ingestion à la restitution.

- **Démonstration :** ouvrir [`demo/index.html`](demo/index.html). Pour chaque cas de la note, la page montre le JSON initial (sources), le JSON final (MDM) et les hypothèses d'enrichissement.
- **Modèle des données enrichies :** ouvrir [`docs/domain-model.html`](docs/domain-model.html).
- **Objets du domaine (vue code) :** ouvrir [`docs/domain-objects.html`](docs/domain-objects.html).
- **Questions au métier :** ouvrir [`docs/questions-au-metier.html`](docs/questions-au-metier.html).

Toutes les données sont **fictives**.

## Lancer

Prérequis : Node.js 22 ou plus. Aucune dépendance à installer.

```bash
npm test        # tests (domaine, scénarios, infrastructure simulée, architecture)
npm run demo    # rejoue les cas via la gateway HTTP et régénère demo/index.html
npm start       # démarre la gateway sur http://localhost:3000 (base documentaire en mémoire)
```

Exemple avec la gateway démarrée :

```bash
curl -X POST localhost:3000/integrer-donnees --data @demo/fixtures/dxcare-c_quest.json
curl "localhost:3000/extraire-donnees?identifiantPatient=99000002"
curl "localhost:3000/extraire-donnees?identifiantPatient=99000002&aLaDate=2026-08-01"
curl "localhost:3000/extraire-donnees?identifiantPatient=99000002&aLaDate=2026-09-20&connuLe=2026-10-05T09:00:00"
curl -X POST localhost:3000/regles-qualite --data '{"identifiant":"POIDS-FRAICHEUR-RCP","attribut":"poids","dimension":"fraicheur","typeControle":"anciennete-max-jours","parametres":{"jours":15},"severite":"avertissement","usages":["rcp"],"auteur":"data-steward","dateEffet":"2026-10-01"}'
```

## Architecture concentrique

Les dépendances vont uniquement vers le centre. Un test (`test/architecture.test.js`) le vérifie.

```
src/
├── domain/          centre : aucune dépendance (ni bibliothèque externe, ni module Node)
│   ├── attributs.js          attributs gérés (Patient, Pathologie) et normalisation des valeurs
│   ├── valeur-sourcee.js     valeur sourcée : valeur, date de valeur, date d'enregistrement, date d'intégration, provenance
│   ├── lignage-sources.js    lignage : où trouver chaque attribut dans chaque extraction source
│   ├── fiabilite.js          fiabilité selon le mode d'acquisition (saisie, reprise, NLP)
│   ├── regles-qualite.js     règles qualité (données versionnées) et contrôles
│   ├── consolidation.js      évolution / concordance / conflit / rejet, confiance, aptitude par usage
│   ├── dossier-patient.js    dossier patient enrichi
│   ├── ports.js              contrats attendus de l'extérieur (dépôts, horloge)
│   ├── erreurs.js            erreur du domaine
│   └── dates.js              outils de dates (technique)
├── scenarios/       dépend uniquement du domaine
│   ├── integrer-donnees.js      intègre une extraction brute d'une source
│   ├── extraire-donnees.js      restitue le dossier enrichi d'un patient, éventuellement « à une date »
│   └── definir-regle-qualite.js ajoute ou versionne une règle qualité à chaud
├── infrastructure/  anneau externe, entièrement simulé (noms techniques en anglais)
│   ├── document-store/       base documentaire en mémoire (API proche de MongoDB)
│   ├── repositories/         dépôts documentaires implémentant les ports du domaine
│   ├── clock/                horloge système et horloge fixe (simulateur)
│   └── gateway/              gateway HTTP : traduit une requête web en appel de scénario, rien d'autre
├── application.js   composition : relie l'infrastructure simulée aux scénarios et à la gateway
└── main.js          point d'entrée
```

- **Langage :** le langage du domaine (concepts, attributs, champs du JSON, scénarios, ports) est en français, sans accents dans les identifiants. Le code technique (infrastructure, outils de dates) et les commentaires sont en anglais.
- **Gateway HTTP :** `POST /integrer-donnees`, `GET /extraire-donnees?identifiantPatient=&aLaDate=&connuLe=` (`aLaDate` : date de validité ; `connuLe` : date de connaissance, par défaut `aLaDate`), `POST /regles-qualite`, `GET /health`.
- **Règles qualité par défaut :** `config/regles-qualite-par-defaut.json`, chargées au démarrage par le scénario `definirRegleQualite`.
- **Tests :** ils utilisent des doublures (`test/support/fakes.js`) et l'infrastructure simulée ; aucun service externe.

## Données de test

- `demo/fixtures/` : extractions sources fictives (DXCare, Simbad, NLP) d'un patient, utilisées par la démonstration.
- `data/sources-poc-lot1.edn` : jeu de données fictif plus large (6 patients, 8 tables sources) et son générateur. Les schémas des tables sources sont des hypothèses.
