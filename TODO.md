# TODO

- [ ] **Attributs dynamiques** : un attribut (d'une entité patient, pathologie, etc.) doit pouvoir être créé à la volée, sans redéploiement, comme les règles qualité.
  - Aujourd'hui : `ATTRIBUTS` est codé en dur dans `src/domain/attributs.js` (4 attributs).
  - Piste : faire de l'attribut une donnée du domaine (versionnée, stockée dans un dépôt, créée par un scénario `definirAttribut`), avec un type de valeur choisi dans une liste connue ; même logique ensuite pour les correspondances sources (`CORRESPONDANCES_SOURCES`).
