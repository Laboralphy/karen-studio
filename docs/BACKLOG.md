# Karen Studio — Idées et points reportés

Liste des améliorations repérées en cours de route et volontairement remises à plus tard.
Le découpage principal en jalons (J0 → J8) est dans `ANALYSE_FAISABILITE.md`.

## Fait

- Panneau de jeu repliable (J8).
- Annuler / rétablir dans les éditeurs (J8 ; l'onglet Code garde l'annulation de Blockly).
- Essai d'un exécutable Windows (J8) : `npm run dist:win` → `dist/Karen Studio-<version>-win.zip`.

## Interface

- Sélection / copier-coller de zones dans l'éditeur de niveau.
- Plusieurs niveaux visibles dans l'aperçu de l'onglet Interface (aujourd'hui : le premier).

## Tests

- Test de bout en bout automatisé de l'application packagée (lancement + protocole de
  débogage Chromium, comme fait à la main en J8).

## Distribution

- Icône intégrée au `.exe` et installeur : nécessitent Wine (ou un build depuis Windows).
- Signature de l'exécutable : inutile pour un usage familial par clé USB ; au besoin, certificat
  auto-signé installé sur le PC cible.

## Code

- `src/runtime/demo/` (démo J1) ne sert plus qu'aux tests d'intégration du moteur : à remplacer
  par des tests sur `ProjectGame` puis à supprimer.
