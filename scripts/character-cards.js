/**
 * Character Cards - module Foundry VTT
 *
 * - Bouton "Carte"  dans la fiche acteur : ouvre la carte en fenetre
 * - Bouton "Chat"   dans la fiche acteur : poste un message cliquable
 * - Les joueurs cliquent sur le message pour ouvrir la carte
 *
 * Pour ajouter une nouvelle carte :
 *   1. Deposez le fichier HTML dans cards/
 *   2. Ajoutez une entree dans CARD_REGISTRY ci-dessous
 */

const MODULE_ID = 'character-cards';

const CARD_REGISTRY = {
  'beckie':     'beckie.html',
  'zal':        'zal.html',
  'zal krindar':'zal.html',
};

Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Character Cards initialise`);
});

Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
  const cardFile = findCard(sheet.actor.name);
  if (!cardFile) return;

  buttons.unshift({
    label: 'Chat',
    class: 'share-character-card',
    icon: 'fas fa-share-nodes',
    onclick: () => shareCardToChat(sheet.actor, cardFile),
  });

  buttons.unshift({
    label: 'Carte',
    class: 'open-character-card',
    icon: 'fas fa-address-card',
    onclick: () => openCard(sheet.actor.name, cardFile),
  });
});

function findCard(actorName) {
  const name = actorName.toLowerCase().trim();
  if (CARD_REGISTRY[name]) return CARD_REGISTRY[name];
  const firstName = name.split(' ')[0];
  if (CARD_REGISTRY[firstName]) return CARD_REGISTRY[firstName];
  for (const [key, file] of Object.entries(CARD_REGISTRY)) {
    if (name.startsWith(key) || key.startsWith(firstName)) return file;
  }
  return null;
}

function openCard(actorName, cardFile) {
  const existingId = `character-card-${cardFile.replace('.html', '')}`;
  const existing = Object.values(ui.windows).find(w => w.id === existingId);
  if (existing) { existing.bringToTop(); return; }
  new CharacterCardApp(actorName, cardFile, existingId).render(true);
}

async function shareCardToChat(actor, cardFile) {
  const content = `
<div class="cc-chat-card" data-card-file="${cardFile}" data-actor-name="${actor.name}">
  <div class="cc-chat-header">
    <i class="fas fa-address-card cc-chat-icon"></i>
    <span class="cc-chat-name">${actor.name}</span>
  </div>
  <p class="cc-chat-desc">Carte de personnage - cliquez pour l'afficher</p>
  <button type="button" class="cc-chat-btn">
    <i class="fas fa-eye"></i>&nbsp; Voir la carte
  </button>
</div>`;

  await ChatMessage.create({
    content,
    speaker: { alias: actor.name },
    flags: { [MODULE_ID]: { cardFile, actorName: actor.name } },
  });
}

Hooks.on('renderChatMessage', (_message, html) => {
  html.find('.cc-chat-btn').on('click', function () {
    const wrapper   = $(this).closest('.cc-chat-card');
    const cardFile  = wrapper.data('card-file');
    const actorName = wrapper.data('actor-name');
    if (cardFile && actorName) openCard(actorName, cardFile);
  });
});

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
  get title() { return `ðŸƒ ${this._actorName}`; }

  async _renderInner(_data) {
    const url = `modules/${MODULE_ID}/cards/${this._cardFile}`;
    return $(`<iframe src="${url}" class="character-card-frame"></iframe>`);
  }
}