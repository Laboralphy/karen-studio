Principe
--------
Le principe de ce projet est de proposer à ma fille la possibilité de créer de petits jeux vidéo à l'aide d'un langage de programmation par bloc qu'elle aime tant.
Je voudrais le faire en utilisant TypeScript/Electron/Canvas
J'ai une bibliothèque comprenant un moteur de jeu video simple : Fairy Engine

Les jeux seront des jeux 2D au look retro (simple à construire). avec des sprite, des background objects (BOB) et la possibilité deplacer une caméra dans un écran plus petit que le niveau lui même. Si possible un scrolling paralaxe de 2 niveaux (niveau, et ciel).

Les jeux sont orchestrés par un timer qu'on va cadencer à 30 ou 20 fps


Pour l'instant seule la bibliothèque Fairy est présent, il y a tout a faire depuis l'échafaudage.


Onglet système
------------------

Enregistrement / cahrgement de fichier.



Onglet CODE :
-----------------
On programme le jeu grace à la librairie de pogrammation visuelle par block : Blockly
Tres ressemblant aux site "scratch" de programmation par bloc actuels
Avec une partie "categorie de blocs" une partie "blocs d'instruction" et une partie "code"
Comme sur les sites Scratch actuels on proposera les sctructure de définition, contôle, comparaison, calculs... habituels.
	- si, alors
	- si, alors, sinon
	- tant que
	- répéter {} fois
	- opérateurs logiques
	- operateurs arithmétiques
	- fonctions numériques de base (min, max, random, clamp)
	....
	
Prévoir des blocs personnalisés comme 
	"Déplacer sprite", 
	"Changer vitesse sprite"
	"Déplacer camera "
	"Créer sprite"
	"Détruire sprite"
	"Changer animation sprite"
	"Bloc function" avec paramètre et retour (ce serait vraiment bien)
	"Jouer son {}"
	"Arreter son {}"
	"Modifier élément {} de tableau {}" (pour les variables de type number[])
	"Modifier élément {} du registre {}" (pour les variable de type Record<string, number>)
	"Remplacer élément de niveau {position} par {code}"
	...
	
Prévoir des évènements 
	"Touche {} pressée" 
	"Touche {} relachée"
	"Tick de jeu"
	"Sprite de tag {} touche marqueur {}"
	"Sprite de tag {} touche bloc solide"
	"Sprite de tag {} touche sprite de tag {}"
	"Animation actuelle du sprite de tag {} terminée"
	"Son {} terminé"
	...

Onglets Assets :
----------------
un onglet editeur de BOB (élément de décors)
	- 32x32 pixels (objet d'arrière plan, décor, élément de niveau) 
	- avec une palette de 256 couleur
	- propriété solide / pas solide qui empèche les sprite de traverser le block.
	- peut être animé (plusieur frame definissable)
	- Proposer un générateur de texture simple pour les tempalte : "rocher", "brique", "metal", "terre", "terre+herbe", "bois", "lave", "eau", "buisson", "cailloux", "tronc d'arbre", ....
un onglet editeur de sprites 
	- 32x32 pixels 
	- avec une palette de 256 couleur dont une transparente
	- un sprite possède un tag permettant de réagir aux évènements de manière générique 
	- possède plusieurs animations, avec un tag pour chacune
	- chaque animation possède une longueur, vitesse, loop etc... prévu par la librarie Fairy
un onglet editeur de niveau 
	- on peut placer des BOB et des marqueurs (servent à être référencer dans le code), 
	- les niveau peuvent avoir une taille dépassant l'écran de 640x480
un onglet éditeur de ciel
	- une image qui bougera en paralaxe avec une possibilité de prégénérer ciel, montagnes, nuage, lune, étoiles, ou bien un environnement neutre mosaique
	- pouvoir définir l'heure de la journée : matin, après midi, soir, nuit.
		
un onglet editeur d'interface
	- Placer du texte fixe avec un minimum de templating {{}} (utiliser handlebars)
	- Chaque texte a son style
	- alignement simple (les 8 coins ou le centre)
	- Le div dans lequel se trouve le canvas possède un layer html ou faciliter
un onlget editeur de son 
	- utilisation library de type jsfxr
	- simplification des paramètre pour des sons
	- proposer des preset et un bouton de randomisation pour "power up", "jump", "explosion", "hit", "treasure" etc...
	- chaque son a un tag 


Panneau de droite : Canvas de rendu de 640x480 pixel
	- un bouton démarrer, pour lancer le timer.
	- un bouton stop, pour arreter le timer et réinitialiser le jeu
	- un bouton aggrandir, pour mieux voir le jeu (grossissement CSS)

Onglet A propos
---------------

version du logiciel
