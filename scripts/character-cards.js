/**
 * Character Cards — module Foundry VTT
 *
 * Affiche une carte holographique recto/verso pour chaque acteur
 * dont le nom correspond à un fichier dans modules/character-cards/cards/
 *
 * Pour ajouter une nouvelle carte :
 *   1. Déposez votre fichier HTML dans le dossier cards/
 *   2. Ajoutez une entrée dans CARD_REGISTRY ci-dessous
 */

const MODULE_ID = 'character-cards';

// ─────────────────────────────────────────────────────────────
//  Registre des cartes
//  Clé  : nom de l'acteur en minuscules (ou début du nom)
//  Valeur : nom du fichier HTML dans le dossier cards/
// ─────────────────────────────────────────────────────────────
const CARD_REGISTRY = {
  'beckie':     'beckie.html',
  'zal':        'zal.html',
  'zal krindar':'zal.html',
};

// ─────────────────────────────────────────────────────────────
//  Initialisation
// ─────────────────────────────────────────────────────────────
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Character Cards initialisé`);
});

// ─────────────────────────────────────────────────────────────
//  Bouton dans l'en-tête de la fiche d'acteur
// ─────────────────────────────────────────────────────────────
Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
  const cardFile = findCard(sheet.actor.name);
  if (!cardFile) return;

  buttons.unshift({
    label: 'Carte',
    class: 'open-character-card',
    icon: 'fas fa-address-card',
    onclick: () => openCard(sheet.actor.name, cardFile),
  });
});

// ─────────────────────────────────────────────────────────────
//  Recherche de carte par nom d'acteur
// ─────────────────────────────────────────────────────────────
function findCard(actorName) {
  const name = actorName.toLowerCase().trim();

  // Correspondance exacte
  if (CARD_REGISTRY[name]) return CARD_REGISTRY[name];

  // Correspondance sur le premier mot (prénom)
  const firstName = name.split(' ')[0];
  if (CARD_REGISTRY[firstName]) return CARD_REGISTRY[firstName];

  // Correspondance partielle : on cherche si le nom commence par une clé connue
  for (const [key, file] of Object.entries(CARD_REGISTRY)) {
    if (name.startsWith(key) || key.startsWith(firstName)) return file;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
//  Ouverture de la fenêtre carte
// ─────────────────────────────────────────────────────────────
function openCard(actorName, cardFile) {
  // Une seule fenêtre par acteur à la fois
  const existingId = `character-card-${cardFile.replace('.html', '')}`;
  const existing = Object.values(ui.windows).find(w => w.id === existingId);
  if (existing) {
    existing.bringToTop();
    return;
  }
  new CharacterCardApp(actorName, cardFile, existingId).render(true);
}

// ─────────────────────────────────────────────────────────────
//  Application Foundry pour l'affichage de la carte
// ─────────────────────────────────────────────────────────────
class CharacterCardApp extends Application {
  constructor(actorName, cardFile, windowId) {
    super();
    this._actorName = actorName;
    this._cardFile  = cardFile;
    this._windowId  = windowId;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['character-card-app'],
      width:   430,
      height:  680,
      resizable: true,
    });
  }

  get id()    { return this._windowId; }
  get title() { return `🃏 ${this._actorName}`; }

  /** Rendu direct : une iframe qui charge le fichier HTML de la carte */
  async _renderInner(_data) {
    const url = `modules/${MODULE_ID}/cards/${this._cardFile}`;
    return $(`<iframe src="${url}" class="character-card-frame"></iframe>`);
  }
}
