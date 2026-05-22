/**
 * Character Cards — module Foundry VTT v2.2
 *
 * Nouvelles cartes : rendu direct dans la fenêtre Foundry (pas d'iframe, pas de blob URL).
 * Contourne les restrictions CSP de The Forge.
 * Cartes legacy (beckie, zal) : toujours via iframe (fichiers HTML du module GitHub).
 */

const MODULE_ID = 'character-cards';

const LEGACY_CARDS = {
  'beckie':      'modules/character-cards/cards/beckie.html',
  'zal':         'modules/character-cards/cards/zal.html',
  'zal krindar': 'modules/character-cards/cards/zal.html',
};

function _escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function _legacyKey(value) {
  return String(value ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function _addUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function _candidateKeys(name) {
  const keys = [];
  const normalized = _normalizeKey(name);
  const legacy = _legacyKey(name);
  _addUnique(keys, normalized);
  _addUnique(keys, legacy);
  _addUnique(keys, normalized.split(' ')[0]);
  _addUnique(keys, legacy.split(' ')[0]);
  return keys;
}

function _findActorByName(name) {
  const wanted = _normalizeKey(name);
  return game.actors.find(actor => _normalizeKey(actor.name) === wanted) || null;
}

// ─────────────────────────────────────────────────────────────
//  Settings
// ─────────────────────────────────────────────────────────────
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Character Cards v2.2 initialisé`);

  game.settings.register(MODULE_ID, 'cardRegistry', {
    scope:  'world',
    config: false,
    type:   Object,
    default: {},
  });

  game.settings.registerMenu(MODULE_ID, 'manageCards', {
    name:       'Gérer les cartes',
    label:      'Ouvrir le gestionnaire',
    hint:       'Ajouter ou supprimer des cartes de personnage sans quitter Foundry.',
    icon:       'fas fa-address-card',
    type:       CardManagerApp,
    restricted: true,
  });
});

// ─────────────────────────────────────────────────────────────
//  Registre
//  legacy → string (chemin HTML)
//  nouveau → { recto: url, verso: url|null }
// ─────────────────────────────────────────────────────────────
function getRegistry() {
  return Object.assign({}, LEGACY_CARDS, game.settings.get(MODULE_ID, 'cardRegistry') || {});
}

function findCard(actorName) {
  const reg = getRegistry();
  const keys = _candidateKeys(actorName);
  for (const key of keys) {
    if (reg[key]) return reg[key];
  }
  for (const [k, v] of Object.entries(reg)) {
    const registryKey = _normalizeKey(k);
    if (keys.some(key => registryKey && (key.startsWith(registryKey) || registryKey.startsWith(key)))) return v;
  }
  return null;
}

function findCardForActor(actor) {
  return actor?.getFlag(MODULE_ID, 'card') || findCard(actor?.name || '');
}

// ─────────────────────────────────────────────────────────────
//  Boutons fiche acteur
// ─────────────────────────────────────────────────────────────
Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
  const entry = findCardForActor(sheet.actor);
  if (!entry) return;

  buttons.unshift({
    label:   'Chat',
    class:   'share-character-card',
    icon:    'fas fa-share-nodes',
    onclick: () => shareCardToChat(sheet.actor),
  });
  buttons.unshift({
    label:   'Carte',
    class:   'open-character-card',
    icon:    'fas fa-address-card',
    onclick: () => openCard(sheet.actor.name, entry),
  });
});

// ─────────────────────────────────────────────────────────────
//  Ouverture
// ─────────────────────────────────────────────────────────────
function openCard(actorName, entry) {
  const cardId   = actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const windowId = `character-card-${cardId}`;
  const existing = Object.values(ui.windows).find(w => w.id === windowId);
  if (existing) { existing.bringToTop(); return; }
  new CharacterCardApp(actorName, entry, windowId).render(true);
}

// ─────────────────────────────────────────────────────────────
//  Chat
// ─────────────────────────────────────────────────────────────
async function shareCardToChat(actor) {
  const safeName = _escapeHTML(actor.name);
  const safeId = _escapeHTML(actor.id);
  await ChatMessage.create({
    content: `
<div class="cc-chat-card" data-actor-id="${safeId}" data-actor-name="${safeName}">
  <div class="cc-chat-header">
    <i class="fas fa-address-card cc-chat-icon"></i>
    <span class="cc-chat-name">${safeName}</span>
  </div>
  <p class="cc-chat-desc">Carte de personnage — cliquez pour l'afficher</p>
  <button type="button" class="cc-chat-btn">
    <i class="fas fa-eye"></i>&nbsp; Voir la carte
  </button>
</div>`,
    speaker: ChatMessage.getSpeaker({ actor }),
    flags:   { [MODULE_ID]: { actorId: actor.id, actorName: actor.name } },
  });
}

Hooks.on('renderChatMessage', (_msg, html) => {
  html.find('.cc-chat-btn').on('click', function () {
    const wrapper = $(this).closest('.cc-chat-card');
    const actorId = wrapper.data('actor-id');
    const actor = actorId ? game.actors.get(actorId) : null;
    const actorName = actor?.name || wrapper.data('actor-name');
    if (!actorName) return;
    const entry = actor ? findCardForActor(actor) : findCard(actorName);
    if (entry) openCard(actorName, entry);
  });
});

// ─────────────────────────────────────────────────────────────
//  Application : fenêtre de la carte
// ─────────────────────────────────────────────────────────────
class CharacterCardApp extends Application {
  constructor(actorName, entry, windowId) {
    super();
    this._actorName = actorName;
    this._entry     = entry;    // string (legacy) ou { recto, verso }
    this._windowId  = windowId;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes:   ['character-card-app'],
      width:     430,
      height:    680,
      resizable: true,
    });
  }

  get id()    { return this._windowId; }
  get title() { return '🎴 ' + this._actorName; }

  async _renderInner(_data) {
    if (typeof this._entry === 'string') {
      // Legacy : iframe vers le fichier HTML du module
      return $(`<iframe src="${this._entry}" class="character-card-frame"></iframe>`);
    }
    // Nouvelle carte : rendu direct dans la fenêtre, sans iframe
    return _buildCardElement(this._actorName, this._entry.recto, this._entry.verso || null);
  }
}

// ─────────────────────────────────────────────────────────────
//  Gestionnaire de cartes
// ─────────────────────────────────────────────────────────────
class CardManagerApp extends FormApplication {
  constructor(...args) {
    super(...args);
    this._rectoFile = null;
    this._versoFile = null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title:         '🎴 Gestionnaire de cartes',
      id:            'card-manager-app',
      width:         540,
      height:        'auto',
      closeOnSubmit: false,
    });
  }

  getData() {
    return { entries: Object.entries(game.settings.get(MODULE_ID, 'cardRegistry') || {}) };
  }

  async _renderInner(data) {
    const entries = data.entries || [];
    const rows = entries.map(([key, entry]) => {
      const label = typeof entry === 'string'
        ? entry.split('/').pop()
        : (entry.verso ? 'recto + verso' : 'recto seul');
      const safeKey = _escapeHTML(key);
      const safeLabel = _escapeHTML(label);
      return `<tr>
        <td style="padding:5px 8px;color:#e2d9f3">${safeKey}</td>
        <td style="padding:5px 8px;color:#7c6fa0;font-size:.82em">${safeLabel}</td>
        <td style="padding:5px 8px;text-align:right">
          <button type="button" class="cc-del-btn" data-key="${safeKey}"
            style="background:#3b1f1f;border:none;color:#f87171;border-radius:4px;
                   padding:3px 10px;cursor:pointer;font-size:.85em">
            <i class="fas fa-trash"></i></button>
        </td></tr>`;
    }).join('');

    const listHtml = entries.length
      ? `<table style="width:100%;border-collapse:collapse">${rows}</table>`
      : `<p style="color:#4b5563;font-size:.85em;margin:0">Aucune carte ajoutée.</p>`;

    return $(`<div style="background:#0d0b14;padding:16px;font-family:'Segoe UI',sans-serif;color:#e2d9f3">

  <div style="background:#1a1628;border:1px solid #2d2440;border-radius:10px;padding:16px;margin-bottom:14px">
    <h3 style="color:#a78bfa;margin:0 0 14px 0;font-size:.95em">
      <i class="fas fa-plus-circle"></i>&nbsp; Ajouter une carte
    </h3>

    <label style="color:#9ca3af;font-size:.82em;display:block;margin-bottom:3px">Recto (face avant) *</label>
    <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">
      <span id="cc-recto-name" style="flex:1;background:#0d0b14;border:1px solid #2d2440;
        color:#6b7280;border-radius:6px;padding:5px 10px;font-size:.88em;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Aucun fichier choisi</span>
      <label for="cc-recto-file" style="background:#2d2440;color:#a78bfa;border-radius:6px;
        padding:5px 14px;cursor:pointer;font-size:.88em;white-space:nowrap;
        display:inline-block;user-select:none">Choisir</label>
    </div>
    <input id="cc-recto-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
      style="position:fixed;top:-9999px;left:-9999px;opacity:0"/>

    <label style="color:#9ca3af;font-size:.82em;display:block;margin-bottom:3px">Verso (face arrière, optionnel)</label>
    <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">
      <span id="cc-verso-name" style="flex:1;background:#0d0b14;border:1px solid #2d2440;
        color:#6b7280;border-radius:6px;padding:5px 10px;font-size:.88em;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Aucun fichier choisi</span>
      <label for="cc-verso-file" style="background:#2d2440;color:#a78bfa;border-radius:6px;
        padding:5px 14px;cursor:pointer;font-size:.88em;white-space:nowrap;
        display:inline-block;user-select:none">Choisir</label>
    </div>
    <input id="cc-verso-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
      style="position:fixed;top:-9999px;left:-9999px;opacity:0"/>

    <label style="color:#9ca3af;font-size:.82em;display:block;margin-bottom:3px">Nom de l'acteur dans Foundry *</label>
    <input id="cc-actor-name" type="text" placeholder="ex : Arfred"
      style="width:100%;background:#0d0b14;border:1px solid #2d2440;color:#e2d9f3;
             border-radius:6px;padding:5px 10px;font-size:.88em;box-sizing:border-box;margin-bottom:10px"/>

    <label style="color:#9ca3af;font-size:.82em;display:block;margin-bottom:3px">Alias (séparés par des virgules)</label>
    <input id="cc-aliases" type="text" placeholder="ex : Arfred le Barde, le Barde"
      style="width:100%;background:#0d0b14;border:1px solid #2d2440;color:#e2d9f3;
             border-radius:6px;padding:5px 10px;font-size:.88em;box-sizing:border-box;margin-bottom:14px"/>

    <button type="button" id="cc-add-btn"
      style="width:100%;background:linear-gradient(135deg,#5b21b6,#7c3aed);border:none;
             color:#fff;border-radius:6px;padding:9px;font-size:.93em;font-weight:600;cursor:pointer">
      <i class="fas fa-cloud-upload-alt"></i>&nbsp; Ajouter et enregistrer
    </button>
    <div id="cc-status" style="margin-top:8px;font-size:.82em;min-height:18px;text-align:center"></div>
  </div>

  <div style="background:#1a1628;border:1px solid #2d2440;border-radius:10px;padding:16px">
    <h3 style="color:#a78bfa;margin:0 0 10px 0;font-size:.95em">
      <i class="fas fa-list"></i>&nbsp; Cartes enregistrées
    </h3>
    ${listHtml}
  </div>
</div>`);
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.element.off('.cc-manager');

    this.element.on('change.cc-manager', '#cc-recto-file', ev => {
      this._rectoFile = ev.target.files[0] || null;
      this.element.find('#cc-recto-name')
        .text(this._rectoFile ? this._rectoFile.name : 'Aucun fichier choisi')
        .css('color', this._rectoFile ? '#e2d9f3' : '#6b7280');
    });

    this.element.on('change.cc-manager', '#cc-verso-file', ev => {
      this._versoFile = ev.target.files[0] || null;
      this.element.find('#cc-verso-name')
        .text(this._versoFile ? this._versoFile.name : 'Aucun fichier choisi')
        .css('color', this._versoFile ? '#e2d9f3' : '#6b7280');
    });

    html.find('#cc-add-btn').on('click', () => this._addCard());

    html.find('.cc-del-btn').on('click', async ev => {
      const key = ev.currentTarget.dataset.key;
      const ok  = await Dialog.confirm({
        title:   'Supprimer la carte',
        content: `<p>Retirer <strong>${_escapeHTML(key)}</strong> du registre ?</p>`,
      });
      if (!ok) return;
      const reg = game.settings.get(MODULE_ID, 'cardRegistry') || {};
      delete reg[key];
      await game.settings.set(MODULE_ID, 'cardRegistry', reg);
      this.render();
    });
  }

  async _addCard() {
    const status     = this.element.find('#cc-status');
    const actorName  = this.element.find('#cc-actor-name').val().trim();
    const aliasesRaw = this.element.find('#cc-aliases').val().trim();

    if (!this._rectoFile) {
      status.html("<span style='color:#f87171'>Choisissez une image pour le recto.</span>");
      return;
    }
    if (!actorName) {
      status.html("<span style='color:#f87171'>Entrez le nom de l'acteur.</span>");
      return;
    }
    const actor = _findActorByName(actorName);
    if (!actor) {
      status.html("<span style='color:#f87171'>Aucun acteur Foundry ne porte exactement ce nom.</span>");
      return;
    }

    this.element.find('#cc-add-btn').prop('disabled', true);
    status.html('<span style="color:#a78bfa"><i class="fas fa-spinner fa-spin"></i> Upload en cours…</span>');

    try {
      const entry = await _uploadImages(actor.name, this._rectoFile, this._versoFile);
      const reg   = game.settings.get(MODULE_ID, 'cardRegistry') || {};
      const keys  = _candidateKeys(actor.name);
      if (aliasesRaw) {
        aliasesRaw.split(',').forEach(a => {
          _candidateKeys(a).forEach(k => _addUnique(keys, k));
        });
      }
      keys.forEach(k => { reg[k] = entry; });
      await game.settings.set(MODULE_ID, 'cardRegistry', reg);
      await actor.setFlag(MODULE_ID, 'card', entry);
      await actor.setFlag(MODULE_ID, 'cardAliases', keys);

      this._rectoFile = null;
      this._versoFile = null;
      status.html('<span style="color:#34d399"><i class="fas fa-check"></i> Carte ajoutée !</span>');
      setTimeout(() => this.render(), 1400);
    } catch (err) {
      console.error(`${MODULE_ID} |`, err);
      status.html('<span style="color:#f87171">Erreur : ' + _escapeHTML(err.message) + '</span>');
    } finally {
      this.element.find('#cc-add-btn').prop('disabled', false);
    }
  }

  async close(...args) {
    this.element.off('.cc-manager');
    return super.close(...args);
  }

  async _updateObject() {}
}

// ─────────────────────────────────────────────────────────────
//  Rendu direct de la carte (sans iframe)
// ─────────────────────────────────────────────────────────────
function _buildCardElement(actorName, rectoUrl, versoUrl) {
  const name = _escapeHTML(actorName);
  const recto = _escapeHTML(rectoUrl);
  const verso = _escapeHTML(versoUrl || '');
  const wrap = $(`<div style="width:100%;height:100%;display:flex;align-items:center;
                              justify-content:center;background:#030407;overflow:hidden"></div>`);

  if (versoUrl) {
    wrap.append(`
      <style>
        .cc-scene{perspective:1400px;width:390px;max-width:88%;aspect-ratio:2/3;cursor:pointer}
        .cc-tilt{width:100%;height:100%;transform-style:preserve-3d;
                 transition:transform .15s ease}
        .cc-card{width:100%;height:100%;position:relative;transform-style:preserve-3d;
                 transition:transform .65s cubic-bezier(.4,0,.2,1)}
        .cc-card.cc-flipped{transform:rotateY(180deg)}
        .cc-face{position:absolute;inset:0;border-radius:24px;overflow:hidden;
                 backface-visibility:hidden;-webkit-backface-visibility:hidden;
                 box-shadow:0 40px 90px rgba(0,0,0,.80),0 0 40px rgba(110,60,255,.28)}
        .cc-face.cc-back{transform:rotateY(180deg)}
        .cc-face img{width:100%;height:100%;object-fit:cover;display:block}
        .cc-name{position:absolute;bottom:0;left:0;right:0;padding:16px 20px;
                 background:linear-gradient(transparent,rgba(5,3,15,.90));
                 color:#e2d9f3;font-family:"Palatino Linotype",Palatino,serif;
                 font-size:1.4em;font-weight:bold;letter-spacing:.06em;
                 text-shadow:0 2px 8px rgba(0,0,0,.8)}
        .cc-controls{display:flex;gap:8px;justify-content:center;margin-top:12px;
                     font-family:sans-serif;user-select:none}
        .cc-face-btn{border:1px solid rgba(167,139,250,.30);background:rgba(20,16,32,.92);
                     color:rgba(226,217,243,.78);border-radius:6px;padding:5px 12px;
                     font-size:.78em;cursor:pointer}
        .cc-face-btn:hover,.cc-face-btn.cc-active{background:#5b21b6;color:#fff}
      </style>
      <div>
        <div class="cc-scene" data-cc-scene tabindex="0">
          <div class="cc-tilt" data-cc-tilt>
            <div class="cc-card" data-cc-card>
              <div class="cc-face">
                <img src="${recto}" alt="${name}"/>
                <div class="cc-name">${name}</div>
              </div>
              <div class="cc-face cc-back">
                <img src="${verso}" alt="${name} verso"/>
              </div>
            </div>
          </div>
        </div>
        <div class="cc-controls">
          <button type="button" class="cc-face-btn cc-active" data-cc-side="front">Recto</button>
          <button type="button" class="cc-face-btn" data-cc-side="back">Verso</button>
        </div>
      </div>`);

    const card  = wrap.find('[data-cc-card]');
    const tilt  = wrap.find('[data-cc-tilt]');
    const scene = wrap.find('[data-cc-scene]');
    const buttons = wrap.find('[data-cc-side]');

    const setFlipped = flipped => {
      card.toggleClass('cc-flipped', flipped);
      buttons.removeClass('cc-active');
      buttons.filter(`[data-cc-side="${flipped ? 'back' : 'front'}"]`).addClass('cc-active');
    };

    scene.on('click', function (event) {
      if ($(event.target).closest('[data-cc-side]').length) return;
      setFlipped(!card.hasClass('cc-flipped'));
    });
    scene.on('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      setFlipped(!card.hasClass('cc-flipped'));
    });
    buttons.on('click', function (event) {
      event.stopPropagation();
      setFlipped(this.dataset.ccSide === 'back');
    });
    scene.on('mousemove', function (e) {
      const r  = this.getBoundingClientRect();
      const rx = ((e.clientY - r.top)  / r.height - .5) * -18;
      const ry = ((e.clientX - r.left) / r.width  - .5) *  18;
      tilt[0].style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale(1.03)';
    });
    scene.on('mouseleave', function () {
      tilt[0].style.transform = '';
    });

  } else {
    wrap.append(`
      <style>
        .cc-scene{perspective:1400px;width:390px;max-width:88%;aspect-ratio:2/3}
        .cc-card-solo{width:100%;height:100%;border-radius:24px;overflow:hidden;position:relative;
                      box-shadow:0 40px 90px rgba(0,0,0,.80),0 0 40px rgba(110,60,255,.28);
                      transition:transform .15s ease;transform-style:preserve-3d}
        .cc-card-solo img{width:100%;height:100%;object-fit:cover;display:block}
        .cc-name{position:absolute;bottom:0;left:0;right:0;padding:16px 20px;
                 background:linear-gradient(transparent,rgba(5,3,15,.90));
                 color:#e2d9f3;font-family:"Palatino Linotype",Palatino,serif;
                 font-size:1.4em;font-weight:bold;letter-spacing:.06em;
                 text-shadow:0 2px 8px rgba(0,0,0,.8)}
      </style>
      <div class="cc-scene">
        <div class="cc-card-solo" id="cc-card-inner">
          <img src="${recto}" alt="${name}"/>
          <div class="cc-name">${name}</div>
        </div>
      </div>`);

    const card = wrap.find('#cc-card-inner');
    card.on('mousemove', function (e) {
      const r  = this.getBoundingClientRect();
      const rx = ((e.clientY - r.top)  / r.height - .5) * -22;
      const ry = ((e.clientX - r.left) / r.width  - .5) *  22;
      this.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale(1.04)';
    });
    card.on('mouseleave', function () { this.style.transform = ''; });
  }

  return wrap;
}

// ─────────────────────────────────────────────────────────────
//  Upload des images
// ─────────────────────────────────────────────────────────────
function _imageExtension(file) {
  const byMime = {
    'image/png':  'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif':  'gif',
  };
  const mimeExt = byMime[file.type];
  const nameExt = String(file.name || '').split('.').pop().toLowerCase();
  const allowed = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
  const ext = mimeExt || nameExt;
  if (!allowed.includes(ext)) throw new Error(`Format image non supporté : ${file.name}`);
  return ext === 'jpeg' ? 'jpg' : ext;
}

function _uploadedPath(result, label) {
  const path = result?.path || result?.response?.path || result?.response?.url;
  if (!path) throw new Error(`Upload ${label} terminé, mais Foundry n'a pas renvoyé de chemin de fichier.`);
  return path;
}

async function _uploadImages(actorName, rectoFile, versoFile) {
  const base   = _normalizeKey(actorName).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'card';
  const folder = 'character-cards/images';
  const stamp  = Date.now();
  try { await FilePicker.createDirectory('data', 'character-cards'); } catch (_) {}
  try { await FilePicker.createDirectory('data', folder); }             catch (_) {}

  const ext1   = _imageExtension(rectoFile);
  const rNamed = new File([rectoFile], base + '-recto-' + stamp + '.' + ext1, { type: rectoFile.type });
  const rRes   = await FilePicker.upload('data', folder, rNamed, {});
  const rectoUrl = _uploadedPath(rRes, 'recto');

  let versoUrl = null;
  if (versoFile) {
    const ext2   = _imageExtension(versoFile);
    const vNamed = new File([versoFile], base + '-verso-' + stamp + '.' + ext2, { type: versoFile.type });
    const vRes   = await FilePicker.upload('data', folder, vNamed, {});
    versoUrl = _uploadedPath(vRes, 'verso');
  }
  return { recto: rectoUrl, verso: versoUrl };
}
