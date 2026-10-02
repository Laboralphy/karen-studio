# Karen Studio — Analyse de faisabilité

## 0. Contexte

Objectif : un atelier de création de petits jeux 2D rétro pour enfant, programmés en blocs (Blockly, look Scratch), en Electron + TypeScript + Canvas, avec le moteur maison **Fairy Engine** (`src/engine`, `src/core`). Le dépôt ne contient que le moteur : pas de `package.json`, pas de `tsconfig`, pas de build, pas de tests.

**Verdict global : faisable.** Aucune brique n'est techniquement bloquante. Toutes les technos citées (Electron, Blockly, jsfxr, Handlebars) sont matures et compatibles. Le vrai risque, c'est le **périmètre** : 8 onglets/éditeurs, dont plusieurs sont de petits logiciels à eux seuls. Il faut avancer par tranches verticales jouables.

---

## 1. Ce que Fairy Engine apporte déjà

| Brique | Fichier | État pour le projet |
|---|---|---|
| Boucle + machine d'états (init → chargement → init jeu → running) | `FairyEngine.ts`, `FairySequencer.ts` | ✅ réutilisable, à adapter (cadence, voir §2) |
| Sprites : physique (pos/vitesse/accél.), anims, zoom, durée de vie, `oData` | `Fairy.ts`, `FairyFlight.ts` | ✅ correspond aux blocs « déplacer », « changer vitesse », « détruire » |
| Calque de sprites, nettoyage des morts | `Fairies.ts` | ✅ |
| Animations : Forward/Backward/Yoyo, durée par frame, nb de boucles, `bOver` | `FairyAnimation.ts` | ✅ couvre « longueur, vitesse, loop » ; `bOver` permet l'événement « animation terminée » |
| Tilemap avec offscreen canvas, tiles animées, `lookAt` (scroll), sub/over-matrix (parallaxe) | `FairyMatrix.ts`, `FairyTile.ts` | ✅ base des BOB et du niveau plus grand que l'écran |
| Code logique par tile (`nCode` : 0 air, 1 semi-solide, 2 solide…) | `FairyTile.ts` | ✅ propriété « solide » des BOB |
| Collision sprite↔sprite : spatial hash + AABB + masque de tangibilité | `FairyCollision.ts` | ✅ broad-phase prête |
| Entrées clavier/souris (état instantané) | `FairyInputState.ts`, `FairyKeys.ts` | ✅ à compléter (fronts montants/descendants) |
| Pub/sub typé | `Observatory.ts`, `Observer.ts` | ✅ socle du système d'événements |
| Parseur de niveau texte base-62 | `FairyLevelBuilder.ts` | ⚠️ limité à 62 tiles × 6 méta-codes. L'éditeur passera directement par `setTileGfx`/`setTileCode` |

## 2. Ce qui manque dans Fairy (adaptations à faire)

1. **Cadence fixe à 20/30 fps.** Aujourd'hui `proceed()` tourne à chaque RAF (60 Hz, voire 120/144 Hz selon l'écran) et `render()` une frame sur deux (`FairyEngine._updateFrame`). Il faut un accumulateur à pas fixe (`tickMs = 1000/fps`) : la logique tourne pile à 20 ou 30 Hz quel que soit l'écran.
2. **Caméra.** `FairyMatrix.lookAt` scrolle les tiles, mais les sprites (`Fairy.render`) dessinent en coordonnées monde, sans offset. Il faut un objet Caméra qui pilote `lookAt` et applique un `ctx.translate` autour du rendu des `Fairies`. Le clamp aux bords du niveau est à prévoir.
3. **Collision sprite ↔ décor solide : absente.** Le collider ne gère que sprite↔sprite. Il faut écrire une résolution AABB contre la grille (axes séparés X puis Y, dans l'observer `move`, sur `vNewPosition`). C'est le plus gros morceau « moteur » : il conditionne la sensation de jeu (plateforme, top-down).
4. **Ciel parallaxe.** `FairyLayer.render` dessine toujours en (0,0). Il faut un calque ciel avec facteur de parallaxe et répétition horizontale (ou utiliser `setSubMatrix`).
5. **Images générées en mémoire.** Les éditeurs produiront des `HTMLCanvasElement`, pas des URL. `Fairy.render` utilise `naturalWidth` (propriété absente d'un canvas) et `FairyImageLoader` ne prend que des URL. Il faut généraliser à `CanvasImageSource` (ou passer par `ImageBitmap`).
6. **Événements « touche pressée/relâchée ».** `FairyInputState` donne un niveau, pas un front : il faut comparer avec l'état du tick précédent. De plus, les écouteurs sont sur `window` : taper du texte dans Blockly piloterait le jeu. Il faut les limiter au conteneur du canvas (focus).
7. **Modification de niveau à chaud.** `setTileGfx` met `_invalid = true` et provoque le redessin de **toute** la map. Le bloc « Remplacer élément de niveau » appelé à chaque tick serait coûteux : il faut ajouter `invalidateTile(x,y)`.
8. **Stop/Reset.** Le plus fiable : `destroy()` puis recréer un moteur neuf à chaque « Démarrer ». Déjà quasi supporté.
9. **Son : absent du moteur.** Il faut un petit gestionnaire WebAudio (jouer/arrêter par tag, callback `onended` pour l'événement « Son terminé »).
10. **Détail de build :** `export const enum LoopType` plus un mélange d'imports avec et sans `.js`. Avec Vite/esbuild (`isolatedModules`), mieux vaut passer en `enum` simple. Changement trivial.

**Limites à fixer :** tiles et sprites en 32×32. Le niveau est rendu en entier dans un canvas offscreen : 200×40 tiles = 6400×1280 px, sans problème. Un plafond raisonnable : environ 400×60 tiles. Les tags de collision via bitmask sont limités à 32. On filtrera plutôt par tag côté runtime.

## 3. Analyse par onglet

### Système (enregistrer/charger) — Faisabilité : facile
Projet = un fichier JSON unique (`.karen`), contenant palette, BOB, sprites, niveau(x), ciel, interface, sons (paramètres jsfxr, pas de WAV) et workspace Blockly (`Blockly.serialization.workspaces.save`). Les pixels sont stockés **indexés** (Uint8Array 32×32 encodé en base64). Dialogues natifs via IPC Electron (`preload` + `contextIsolation`). Ajouts conseillés : sauvegarde auto et « fichiers récents ».

### Code (Blockly) — Faisabilité : moyenne, cœur du projet
- Blockly est maintenu (passé à la Raspberry Pi Foundation), a une locale **française**, et le renderer **`zelos`** donne le look Scratch. La structure catégories / blocs / zone de code est native (toolbox à catégories).
- Blocs standards (si/sinon, tant que, répéter, logique, maths, min/max/aléatoire/clamp) : déjà fournis.
- **Fonctions avec paramètres et retour** : fournies (`procedures_defreturn`). ✅
- Blocs personnalisés (sprite, caméra, son, tableaux, registre, niveau) : définitions JSON + générateurs JS. C'est du volume, pas de la difficulté.
- `number[]` → listes Blockly. `Record<string, number>` → blocs « registre » à créer.
- Événements : blocs « chapeau » (hat blocks) sans connexion précédente. Chaque chapeau devient un handler enregistré auprès du runtime.
- **Exécution** : Blockly génère du JS, exécuté via `new Function(api)` dans le renderer, avec une API restreinte (pas d'accès Node). Il faut protéger contre les boucles infinies (`INFINITE_LOOP_TRAP` : compteur d'itérations par tick, arrêt propre du jeu avec un message clair).
- **Décision structurante → question n°1** : modèle d'exécution (voir §6).

### Assets — BOB — Faisabilité : moyenne
Éditeur pixel 32×32 zoomé (crayon, gomme, remplissage, pipette, miroir), palette 256 couleurs partagée par le projet, case « solide », frames d'animation et vitesse. **Générateur de textures** : bruit procédural (value/Perlin) + motifs (briques, planches, herbe sur terre…) + quantification sur la palette, avec une graine aléatoire et un bouton « relancer ». Faisable et très gratifiant pour un enfant. Comptons environ 10 à 12 recettes au départ.

### Assets — Sprites — Faisabilité : moyenne
Même éditeur pixel, l'index 0 étant transparent. Le tag du sprite et la liste d'animations (tag, frames, vitesse, boucle) se mappent directement sur `FairyAnimation.setLoop`. À l'export runtime, chaque sprite devient une sprite-sheet canvas (une rangée par anim). La boîte de collision par défaut couvre tout le 32×32 ; option : l'ajuster.

### Assets — Niveau — Faisabilité : moyenne
Grille scrollable/zoomable, pinceau de BOB, gomme, rectangle de remplissage. **Marqueurs** nommés, posés sur la grille, invisibles en jeu et référencés dans le code (« sprite touche marqueur X », « créer sprite au marqueur X »). Il faut aussi un point de départ de caméra et une taille de niveau réglable. Un seul niveau ou plusieurs → **question n°3**.

### Assets — Ciel — Faisabilité : facile/moyenne
Générateur procédural : dégradé selon l'heure (matin, après-midi, soir, nuit), montagnes (déplacement de point médian), nuages, lune/soleil, étoiles la nuit, ou mosaïque neutre. Rendu dans un canvas de 640×480 (ou plus large, répétable horizontalement) et déplacé en parallaxe à environ 0,2–0,5× la caméra.

### Assets — Interface (HUD) — Faisabilité : facile
Calque HTML superposé au canvas (`position:absolute`). Chaque texte a une ancre parmi 9 positions, un style (police pixel, taille, couleur, contour) et un gabarit Handlebars `{{score}}` compilé une fois puis rafraîchi à chaque tick à partir des variables du jeu. Mise à jour du DOM uniquement si la chaîne change. Note : Handlebars compile via `new Function`, il faut donc une CSP Electron compatible (on en a besoin de toute façon pour le code Blockly).

### Assets — Son — Faisabilité : facile
La lib `jsfxr` (npm) fournit justement les presets `pickupCoin`, `laserShoot`, `explosion`, `powerUp`, `hitHurt`, `jump`, `blipSelect`, ainsi que `random` et `mutate`. Interface simplifiée : 4 à 6 curseurs nommés pour un enfant (« hauteur », « durée », « glissement », « grésillement »), avec les paramètres complets en option avancée. On stocke les paramètres et on génère un `AudioBuffer` au chargement.

### Panneau de rendu + Démarrer/Stop/Agrandir — Faisabilité : facile
Canvas 640×480 avec `image-rendering: pixelated`. Agrandir = `transform: scale()` entier (×2) ou plein écran. Démarrer = construire le moteur à partir du projet. Stop = `destroy()`.

### À propos — trivial
Version lue depuis `package.json` via `app.getVersion()`.

## 4. Architecture proposée

```
electron-vite (main / preload / renderer), TypeScript strict
src/
  engine/  core/            ← Fairy (existant, adapté §2)
  runtime/                  ← « Karen runtime » : projet JSON → jeu Fairy
     GameRuntime.ts         (pas fixe, caméra, ciel, HUD, sons, dispatch d'événements)
     TileCollision.ts, Camera.ts, SoundBank.ts, EventBus.ts, api.ts (API exposée au code généré)
  project/                  ← modèle de données + (dé)sérialisation + migrations de version
  editor/
     blockly/               (toolbox, blocs custom, générateurs, locale FR)
     pixel/                 (éditeur commun BOB/sprite, palette, générateurs de textures)
     level/  sky/  hud/  sound/
  main/ preload/            ← Electron : fenêtres, dialogues fichiers, menu
```

Le **runtime** reste indépendant de l'éditeur. Ça permet l'aperçu dans l'IDE et, plus tard, un **export du jeu en HTML autonome** à partager. Tests unitaires (Vitest) pour le runtime, la collision, la sérialisation et les générateurs Blockly.

## 5. Découpage en jalons (tranches jouables)

| # | Jalon | Contenu | Taille |
|---|---|---|---|
| J0 | Échafaudage | electron-vite, TS, lint, Vitest, Fairy compilé, fenêtre avec onglets + canvas | S |
| J1 | Moteur adapté | pas fixe, caméra, collision décor, images canvas, input à fronts, reset | M |
| J2 | **Premier jeu de bout en bout** | modèle projet, save/load, éditeur pixel minimal (sprite + BOB), niveau minimal, Blockly avec ~10 blocs (touche, tick, déplacer, vitesse), Démarrer/Stop | L |
| J3 | Blockly complet | tous les blocs/événements listés, fonctions, tableaux/registre, garde anti-boucle infinie, messages d'erreur lisibles | L |
| J4 | Sons | éditeur jsfxr + blocs jouer/arrêter/son terminé | S |
| J5 | Ciel + parallaxe | générateur + heure du jour | M |
| J6 | Éditeurs riches | animations sprites, générateur de textures BOB, marqueurs, outils niveau | L |
| J7 | Interface HUD | textes, ancres, styles, Handlebars | S |
| J8 | Finitions | sauvegarde auto, undo/redo éditeurs, packaging (electron-builder) | M |

Après J2, ta fille peut déjà faire bouger un perso dans un niveau. On enrichit ensuite.

## 6. Risques et points d'attention

1. **Modèle d'exécution des blocs** (le plus important). Un « tant que » ou un « répéter » dans un handler « tick » bloque la frame. Deux options :
   - **A. Exécution jusqu'au bout** (chaque handler s'exécute en entier dans le tick) : simple et rapide, mais un « tant que vrai » fige le jeu (la garde l'arrête). Pas de bloc « attendre ».
   - **B. Coroutines façon Scratch** (générateurs JS `function*`, `yield` en fin de boucle, bloc « attendre N secondes/ticks ») : intuitif pour une enfant habituée à Scratch. Un peu plus complexe à générer, mais maîtrisable.
2. **Périmètre** : 8 onglets. Discipline des tranches verticales.
3. **Ergonomie enfant** : libellés FR simples, gros boutons, erreurs compréhensibles (« Ton bloc *tant que* ne s'arrête jamais »).
4. **Sécurité Electron** : le code généré tourne dans le renderer, avec `nodeIntegration: false`, `contextIsolation: true` et une API minimale. Risque faible (code produit par l'utilisatrice elle-même).
5. **Rétro-compatibilité des fichiers** : champ `version` dans le JSON + migrations dès le départ.
6. **Fairy reste la référence** : adaptations minimales et rétro-compatibles, logique spécifique dans `runtime/`.

## 7. Décisions prises (02/10/2026)

| Sujet | Décision | Conséquence |
|---|---|---|
| Exécution des blocs | **Coroutines façon Scratch** | Le code Blockly est généré en `function*`, avec `yield` en fin de boucle et un bloc « attendre ». Un ordonnanceur de « threads » est intégré au runtime. |
| UI éditeur | **Vue 3** (SFC, `<script setup lang="ts">`) | electron-vite, template Vue. |
| Niveaux | **Plusieurs par projet** | `project.levels[]` + bloc « aller au niveau {} ». |
| Type de jeu | **Plateforme et vue de dessus** | Collision décor générique (solide + semi-solide) ; gravité = simple accélération réglable par bloc. |
| Public | **13 ans et +** | Libellés Scratch classiques ; on peut exposer des paramètres avancés (jsfxr complet en option, physique). |
| Export HTML autonome | **Non** | Retiré de J8. Le runtime reste quand même séparé de l'éditeur (bonne pratique, tests). |
| Premier lot | **J0 + J1** | Détaillé ci-dessous. |

---

## 8. Plan détaillé — J0 : Échafaudage

1. **Outillage** : `package.json` (nom `karen-studio`, version `0.1.0`), electron-vite, Vue 3, TypeScript strict, Vitest (+ `happy-dom`), ESLint + Prettier. Style aligné sur Fairy : 4 espaces, quotes simples, largeur 100.
2. **Arborescence** (convention electron-vite) :
   ```
   src/main/index.ts        fenêtre 1280×800, menu, IPC (squelette fichiers)
   src/preload/index.ts     contextBridge : API `karen` minimale
   src/renderer/index.html  CSP : script-src 'self' 'unsafe-eval' (requis par Blockly/Handlebars/new Function)
   src/renderer/src/        App.vue, composants
   src/engine/, src/core/   Fairy (inchangé hors §J1), alias `@fairy`
   src/runtime/             (vide en J0)
   ```
   On garde le moteur à `src/engine` et `src/core`, sans le déplacer, et on l'importe via l'alias Vite/TS.
3. **Sécurité Electron** : `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
4. **Coquille UI** (`App.vue`) : à gauche, une barre d'onglets (Système, Code, BOB, Sprites, Niveau, Ciel, Interface, Son, À propos) avec des composants placeholder. À droite, le panneau de rendu : canvas 640×480 en `image-rendering: pixelated`, boutons **Démarrer / Stop / Agrandir** (×2 via `transform: scale`).
5. **À propos** : version via IPC `app.getVersion()`.
6. Scripts : `dev`, `build`, `test`, `lint`, `typecheck`. Ajout de `.gitignore` (`node_modules`, `out`, `dist`).

## 9. Plan détaillé — J1 : Adaptations du moteur + runtime de base

Principe : modifications de Fairy **minimales et rétro-compatibles**. La logique propre à Karen va dans `src/runtime/`.

**Dans Fairy (`src/engine`)**
1. `FairyAnimation.ts` : `export const enum LoopType` → `export enum` (compatibilité `isolatedModules`). Uniformiser les imports `./IFairyLayer` → `./IFairyLayer.js`.
2. **Images canvas** : type `FairyImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap`. `FairyImageLoader.add(id, source)` pour les images déjà prêtes. `Fairy.render` utilise `oImage.width` au lieu de `naturalWidth`. `FairyMatrix`/`FairyLayer`/`createFairy` acceptent `FairyImage`.
3. **Pas fixe** (`FairyEngine`) : `setTickRate(fps)` (20 ou 30, défaut 30). Accumulateur sur `performance.now()`, au plus 5 ticks de rattrapage par RAF. `proceed` à chaque tick, `render` une fois par RAF s'il y a eu au moins un tick. L'ancien throttle `_frame & 1` disparaît.
4. **Caméra** : nouveau `FairyCamera.ts` (position, taille de viewport, bornes du monde, `follow(fairy, deadzone)`, clamp). `IFairyLayer` gagne un `setView?(x, y)` optionnel, appelé par le moteur avant `render` : `FairyMatrix` → `lookAt`, `Fairies` → `ctx.save/translate(-x,-y)/restore`.
5. **Parallaxe** : `FairyLayer.setParallax(fx, fy)` + `setRepeatX(true)` : rendu à `-x*fx` modulo la largeur, répété horizontalement.
6. **Tiles** : `FairyMatrix` gagne `setTile(x, y, gfx, code)` avec redessin d'une seule case (pas d'invalidation globale), `getCols/getRows/getTileW/getTileH`, et `getTileCodeAt(px, py)` qui renvoie 0 hors grille.
7. **Collision décor** : nouveau `FairyTileCollision.ts`. Fonction pure `resolveTileCollision(rect, flight, grid): ContactFlags`, où `grid` est une interface `ITileGrid` (testable sans canvas). Résolution X puis Y sur `vNewPosition`/`vNewSpeed`. Code 2 = solide. Code 1 = semi-solide (bloque seulement en descendant, si le bas du sprite était au-dessus du haut de la tile au tick précédent). Retourne `{ left, right, top, bottom }`, utilisé ensuite pour « sur le sol » et l'événement « touche bloc solide ».
8. **Entrées** : `FairyInputState.endTick()` mémorise l'état précédent, ce qui donne `isKeyPressed(k)` / `isKeyReleased(k)` (fronts). `FairyEngine.setInputTarget(el)` (défaut `window`) pour ne capter le clavier que quand le panneau de jeu a le focus.

**Runtime (`src/runtime`)**
9. `Scheduler.ts` : ordonnanceur de coroutines. Un thread est un générateur. `tick()` reprend chaque thread jusqu'à son prochain `yield`. `wait(ticks)`, `stopAll()`. Garde anti-blocage : budget d'étapes par thread et par tick, au-delà le thread est arrêté et l'erreur est signalée à l'UI. Ce sera la cible du code Blockly en J2/J3.
10. `GameRuntime.ts` : enveloppe le moteur (`start(canvas)`, `stop()` = `destroy()` + `scheduler.stopAll()`). En J1, il charge une **scène de démo codée en dur** : tiles et sprite générés sur canvas, ciel en dégradé parallaxe, sprite piloté aux flèches avec gravité et saut, caméra qui suit, niveau 60×20 tiles.
11. Brancher les boutons Démarrer/Stop du panneau sur `GameRuntime`.

**Fichiers critiques** : `src/engine/FairyEngine.ts`, `Fairy.ts`, `Fairies.ts`, `FairyLayer.ts`, `FairyMatrix.ts`, `FairyInputState.ts`, `FairyImageLoader.ts`, `FairyAnimation.ts`, `IFairyLayer.ts` ; nouveaux `FairyCamera.ts`, `FairyTileCollision.ts`, `src/runtime/Scheduler.ts`, `src/runtime/GameRuntime.ts`.

## 10. Vérification

- `npm run typecheck` et `npm run lint` passent.
- `npm test` (Vitest) :
  - `FairyTileCollision` : chute sur un sol, mur à gauche/droite, plafond, semi-solide traversé par le dessous mais bloquant par le dessus, coins.
  - Pas fixe : avec un horodatage simulé, 1 s → 30 ticks à 30 fps et 20 ticks à 20 fps ; plafond de rattrapage respecté.
  - `FairyInputState` : fronts pressé/relâché sur un seul tick.
  - `Scheduler` : ordre des threads, `wait(n)`, `stopAll`, garde anti-boucle infinie.
  - `FairyCamera` : clamp aux bords, suivi avec deadzone.
- `npm run dev` : la fenêtre s'ouvre avec tous les onglets. **Démarrer** lance la démo (le perso court et saute sur les plateformes, la caméra suit, le ciel défile plus lentement). **Stop** arrête et vide. **Démarrer** de nouveau repart à l'identique. **Agrandir** double la taille. Taper au clavier hors du panneau de jeu ne fait pas bouger le perso.
- Copier ce document dans `docs/ANALYSE_FAISABILITE.md`, puis commit (sur une branche, à ta demande).
