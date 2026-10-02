# Karen Studio — Idées et points reportés

Liste des améliorations repérées en cours de route et volontairement remises à plus tard.
Le découpage principal en jalons (J0 → J8) est dans `ANALYSE_FAISABILITE.md`.

## Interface

- **Panneau de jeu repliable** (demandé le 02/10/2026) : le panneau de rendu prend 640 px et
  serre les éditeurs (la palette passe sous le dessin dans les onglets BOB / Sprites). Pouvoir le
  replier pendant l'édition, ou le faire passer sous les éditeurs.
- Annuler / rétablir (Ctrl+Z / Ctrl+Y) dans les éditeurs pixel et niveau (prévu en J8).
- Outils de niveau supplémentaires : rectangle, remplissage, sélection / copier-coller (J6).

## Tests

- Test de bout en bout dans Electron (Playwright) : lancer la vraie application, cliquer,
  comparer des captures. À faire quand l'interface sera stabilisée.

## Distribution

- Essai tôt d'un exécutable Windows (dossier `win-unpacked` via electron-builder) copié sur clé
  USB, pour valider la chaîne sur l'autre PC.
- Signature de l'exécutable : inutile pour un usage familial par clé USB ; au besoin, certificat
  auto-signé installé sur le PC cible.

## Code

- `src/runtime/demo/` (démo J1) ne sert plus qu'aux tests d'intégration du moteur : à remplacer
  par des tests sur `ProjectGame` puis à supprimer.
