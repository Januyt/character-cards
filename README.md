# Character Cards

Module Foundry VTT — affiche une carte holographique recto/verso pour chaque personnage.

## Fonctionnement

Quand un acteur possède une carte associée, un bouton **🃏 Carte** apparaît dans l'en-tête de sa fiche. Un clic ouvre la carte dans une fenêtre dédiée, avec l'animation de retournement intégrée.

## Installation via The Forge

1. Dans Foundry VTT, allez dans **Configuration → Modules → Installer un module**
2. Collez l'URL du manifeste :
   ```
   https://raw.githubusercontent.com/Januyt/character-cards/main/module.json
   ```
3. Cliquez sur **Installer**
4. Activez le module dans votre monde

## Ajouter une nouvelle carte

1. Déposez votre fichier HTML dans le dossier `cards/`
2. Ouvrez `scripts/character-cards.js` et ajoutez une entrée dans `CARD_REGISTRY` :
   ```js
   const CARD_REGISTRY = {
     'beckie':     'beckie.html',
     'zal':        'zal.html',
     'zal krindar':'zal.html',
     'nouveau':    'nouveau-personnage.html',  // ← votre carte
   };
   ```
3. Commitez et poussez sur GitHub

## Cartes incluses

| Personnage | Fichier |
|---|---|
| Beckie | `cards/beckie.html` |
| Zal Krindar | `cards/zal.html` |

## Structure du module

```
character-cards/
├── module.json
├── scripts/
│   └── character-cards.js
├── styles/
│   └── character-cards.css
├── cards/
│   ├── beckie.html
│   └── zal.html
└── README.md
```
