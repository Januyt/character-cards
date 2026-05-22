# Character Cards

Module Foundry VTT v12 pour afficher une carte de personnage recto/verso et la partager dans le chat.

## Fonctionnement

Quand un acteur possede une carte associee, deux boutons apparaissent dans l'en-tete de sa fiche :

- **Carte** ouvre la carte dans une fenetre Foundry.
- **Chat** envoie un message cliquable qui ouvre la meme carte.

Les nouvelles cartes sont stockees sur l'acteur avec un flag Foundry, et aussi dans un registre monde de secours pour conserver la recherche par nom et alias.

## Installation via The Forge

1. Dans Foundry VTT, ouvrez **Configuration -> Modules -> Installer un module**.
2. Collez l'URL du manifeste :
   ```text
   https://raw.githubusercontent.com/Januyt/character-cards/main/module.json
   ```
3. Installez puis activez le module dans votre monde.

## Ajouter une carte depuis Foundry

1. Ouvrez **Configure Settings -> Module Settings -> Character Cards -> Gerer les cartes**.
2. Choisissez l'image du recto.
3. Choisissez l'image du verso si la carte en a un.
4. Entrez le nom exact de l'acteur Foundry.
5. Ajoutez les alias utiles, separes par des virgules.
6. Cliquez sur **Ajouter et enregistrer**.

Le module verifie que l'acteur existe, upload les images dans les donnees du monde, associe la carte a l'acteur, puis active les boutons dans sa fiche.

## Cartes legacy GitHub

Les fichiers HTML deja inclus dans `cards/` restent compatibles :

| Personnage | Fichier |
|---|---|
| Beckie | `cards/beckie.html` |
| Zal Krindar | `cards/zal.html` |

Le script `add-card.py` sert uniquement a ajouter une carte legacy dans le depot GitHub. Pour les parties Forge courantes, l'import depuis Foundry est le chemin recommande.

## Publication

`PUBLIER.bat` lance `sync-and-push.py`, qui incremente la version dans `module.json`, commit les fichiers existants et pousse sur GitHub. Il ne reecrit plus `scripts/character-cards.js`.
