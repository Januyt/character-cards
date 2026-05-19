/**
 * Character Cards — module Foundry VTT v2.1
 *
 * Fix The Forge : les images (PNG/JPG) sont uploadées sur le serveur,
 * le HTML est généré à la volée et affiché via blob URL → pas de téléchargement forcé.
 * Le verso fonctionne pour toutes les cartes ajoutées via le gestionnaire.
 */

const MODULE_ID = 'character-cards';

// Cartes legacy (fichiers HTML dans le module GitHub)
const LEGACY_CARDS = {
  'beckie':      'modules/character-cards/cards/beckie.html',
  'zal':         'modules/character-cards/cards/zal.html',
  'zal krindar': 'modules/character-cards/cards/zal.html',
};

// ─────────────────────────────────────────────────────────────
//  Settings
// ─────────────────────────────────────────────────────────────
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Character Cards v2.1 initialisé`);

  // Registre : { key: string } pour legacy, { key: { recto, verso } } pour nouvelles cartes
  game.settings.register(MODULE_ID, 'cardRegistry', {
    name: 'Registre des cartes',
    scope: 'world',
    config: false,
    type: Object,
    default: {},
  });

  game.settings.registerMenu(MODULE_ID, 'manageCards', {
    name: 'Gérer les cartes',
    label: 'Ouvrir le gestionnaire',
    hint: 'Ajouter ou supprimer des cartes de personnage sans quitter Foundry.',
    icon: 'fas fa-address-card',
    type: CardManagerApp,
    restricted: true,
  });
});

// ─────────────────────────────────────────────────────────────
//  Registre
// ─────────────────────────────────────────────────────────────
function getRegistry() {
  const stored = game.settings.get(MODULE_ID, 'cardRegistry') || {};
  return Object.assign({}, LEGACY_CARDS, stored);
}

function findCard(actorName) {
  const registry = getRegistry();
  const name = actorName.toLowerCase().trim();
  if (registry[name]) return registry[name];
  const firstName = name.split(' ')[0];
  if (registry[firstName]) return registry[firstName];
  for (const [key, entry] of Object.entries(registry)) {
    if (name.startsWith(key) || key.startsWith(firstName)) return entry;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
//  Boutons fiche acteur
// ─────────────────────────────────────────────────────────────
Hooks.on('getActorSheetHeaderButtons', (sheet, buttons) => {
  const entry = findCard(sheet.actor.name);
  if (!entry) return;

  buttons.unshift({
    label: 'Chat',
    class: 'share-character-card',
    icon: 'fas fa-share-nodes',
    onclick: () => shareCardToChat(sheet.actor),
  });

  buttons.unshift({
    label: 'Carte',
    class: 'open-character-card',
    icon: 'fas fa-address-card',
    onclick: () => openCard(sheet.actor.name, entry),
  });
});

// ─────────────────────────────────────────────────────────────
//  Ouverture de la carte
//  - entry string  → chemin HTML legacy (module GitHub)
//  - entry object  → { recto, verso } → HTML généré + blob URL
// ─────────────────────────────────────────────────────────────
async function openCard(actorName, entry) {
  const cardId   = actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const windowId = `character-card-${cardId}`;
  const existing = Object.values(ui.windows).find(w => w.id === windowId);
  if (existing) { existing.bringToTop(); return; }

  let srcUrl, blobUrl = null;

  if (typeof entry === 'string') {
    srcUrl = entry;
  } else {
    const html = _generateCardHtml(actorName, entry.recto, entry.verso || null);
    const blob  = new Blob([html], { type: 'text/html' });
    blobUrl = URL.createObjectURL(blob);
    srcUrl  = blobUrl;
  }

  new CharacterCardApp(actorName, srcUrl, blobUrl, windowId).render(true);
}

// ─────────────────────────────────────────────────────────────
//  Partage dans le chat
// ─────────────────────────────────────────────────────────────
async function shareCardToChat(actor) {
  const safeName = actor.name.replace(/"/g, '&quot;');
  const content  = `
<div class="cc-chat-card" data-actor-name="${safeName}">
  <div class="cc-chat-header">
    <i class="fas fa-address-card cc-chat-icon"></i>
    <span class="cc-chat-name">${actor.name}</span>
  </div>
  <p class="cc-chat-desc">Carte de personnage — cliquez pour l'afficher</p>
  <button type="button" class="cc-chat-btn">
    <i class="fas fa-eye"></i>&nbsp; Voir la carte
  </button>
</div>`;
  await ChatMessage.create({
    content,
    speaker: { alias: actor.name },
    flags: { [MODULE_ID]: { actorName: actor.name } },
  });
}

Hooks.on('renderChatMessage', (_message, html) => {
  html.find('.cc-chat-btn').on('click', function () {
    const actorName = $(this).closest('.cc-chat-card').data('actor-name');
    if (!actorName) return;
    const entry = findCard(actorName);
    if (entry) openCard(actorName, entry);
  });
});

// ─────────────────────────────────────────────────────────────
//  Application : fenêtre d'affichage de la carte
// ─────────────────────────────────────────────────────────────
class CharacterCardApp extends Application {
  constructor(actorName, srcUrl, blobUrl, windowId) {
    super();
    this._actorName = actorName;
    this._srcUrl    = srcUrl;
    this._blobUrl   = blobUrl;
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
    return $(`<iframe src="${this._srcUrl}" class="character-card-frame"></iframe>`);
  }

  async close(...args) {
    if (this._blobUrl) URL.revokeObjectURL(this._blobUrl);
    return super.close(...args);
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
      return `<tr>
        <td style="padding:5px 8px;color:#e2d9f3">${key}</td>
        <td style="padding:5px 8px;color:#7c6fa0;font-size:.82em">${label}</td>
        <td style="padding:5px 8px;text-align:right">
          <button type="button" class="cc-del-btn" data-key="${key}"
            style="background:#3b1f1f;border:none;color:#f87171;border-radius:4px;
                   padding:3px 10px;cursor:pointer;font-size:.85em">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>`;
    }).join('');

    const listHtml = entries.length
      ? `<table style="width:100%;border-collapse:collapse">${rows}</table>`
      : `<p style="color:#4b5563;font-size:.85em;margin:0">Aucune carte ajoutée.</p>`;

    return $(`<div style="background:#0d0b14;padding:16px;font-family:'Segoe UI',sans-serif;color:#e2d9f3">

  <div style="background:#1a1628;border:1px solid #2d2440;border-radius:10px;padding:16px;margin-bottom:14px">
    <h3 style="color:#a78bfa;margin:0 0 14px 0;font-size:.95em;letter-spacing:.03em">
      <i class="fas fa-plus-circle"></i>&nbsp; Ajouter une carte
    </h3>

    <label style="color:#9ca3af;font-size:.82em;display:block;margin-bottom:3px">Recto (face avant) *</label>
    <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">
      <span id="cc-recto-name"
        style="flex:1;background:#0d0b14;border:1px solid #2d2440;color:#6b7280;
               border-radius:6px;padding:5px 10px;font-size:.88em;display:block;
               overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        Aucun fichier choisi
      </span>
      <label for="cc-recto-file"
        style="background:#2d2440;border:none;color:#a78bfa;border-radius:6px;
               padding:5px 14px;cursor:pointer;font-size:.88em;white-space:nowrap;
               display:inline-block;user-select:none">Choisir</label>
    </div>
    <input id="cc-recto-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif"
      style="position:fixed;top:-9999px;left:-9999px;opacity:0"/>

    <label style="color:#9ca3af;font-size:.82em;display:block;margin-bottom:3px">Verso (face arrière, optionnel)</label>
    <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center">
      <span id="cc-verso-name"
        style="flex:1;background:#0d0b14;border:1px solid #2d2440;color:#6b7280;
               border-radius:6px;padding:5px 10px;font-size:.88em;display:block;
               overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        Aucun fichier choisi
      </span>
      <label for="cc-verso-file"
        style="background:#2d2440;border:none;color:#a78bfa;border-radius:6px;
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
             color:#fff;border-radius:6px;padding:9px;font-size:.93em;font-weight:600;
             cursor:pointer;letter-spacing:.02em">
      <i class="fas fa-cloud-upload-alt"></i>&nbsp; Ajouter et enregistrer
    </button>
    <div id="cc-status" style="margin-top:8px;font-size:.82em;min-height:18px;text-align:center"></div>
  </div>

  <div style="background:#1a1628;border:1px solid #2d2440;border-radius:10px;padding:16px">
    <h3 style="color:#a78bfa;margin:0 0 10px 0;font-size:.95em;letter-spacing:.03em">
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
      const name  = this._rectoFile ? this._rectoFile.name : 'Aucun fichier choisi';
      const color = this._rectoFile ? '#e2d9f3' : '#6b7280';
      this.element.find('#cc-recto-name').text(name).css('color', color);
    });

    this.element.on('change.cc-manager', '#cc-verso-file', ev => {
      this._versoFile = ev.target.files[0] || null;
      const name  = this._versoFile ? this._versoFile.name : 'Aucun fichier choisi';
      const color = this._versoFile ? '#e2d9f3' : '#6b7280';
      this.element.find('#cc-verso-name').text(name).css('color', color);
    });

    html.find('#cc-add-btn').on('click', () => this._addCard());

    html.find('.cc-del-btn').on('click', async ev => {
      const key = ev.currentTarget.dataset.key;
      const ok  = await Dialog.confirm({
        title:   'Supprimer la carte',
        content: `<p>Retirer <strong>${key}</strong> du registre ?</p>`,
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

    this.element.find('#cc-add-btn').prop('disabled', true);
    status.html('<span style="color:#a78bfa"><i class="fas fa-spinner fa-spin"></i> Upload en cours…</span>');

    try {
      const entry = await _uploadImages(actorName, this._rectoFile, this._versoFile);

      const reg  = game.settings.get(MODULE_ID, 'cardRegistry') || {};
      const keys = [actorName.toLowerCase().trim()];
      const firstName = keys[0].split(' ')[0];
      if (firstName !== keys[0]) keys.push(firstName);
      if (aliasesRaw) {
        aliasesRaw.split(',').forEach(a => {
          const k = a.trim().toLowerCase();
          if (k && !keys.includes(k)) keys.push(k);
        });
      }
      keys.forEach(k => { reg[k] = entry; });
      await game.settings.set(MODULE_ID, 'cardRegistry', reg);

      this._rectoFile = null;
      this._versoFile = null;
      status.html('<span style="color:#34d399"><i class="fas fa-check"></i> Carte ajoutée !</span>');
      setTimeout(() => this.render(), 1400);

    } catch (err) {
      console.error(`${MODULE_ID} | Erreur :`, err);
      status.html('<span style="color:#f87171">Erreur : ' + err.message + '</span>');
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
//  Utilitaires
// ─────────────────────────────────────────────────────────────

async function _uploadImages(actorName, rectoFile, versoFile) {
  const base   = actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const folder = 'character-cards/images';

  try { await FilePicker.createDirectory('data', 'character-cards'); }  catch (_) {}
  try { await FilePicker.createDirectory('data', folder); }              catch (_) {}

  const ext1       = rectoFile.name.split('.').pop();
  const rectoNamed = new File([rectoFile], base + '-recto.' + ext1, { type: rectoFile.type });
  const rectoRes   = await FilePicker.upload('data', folder, rectoNamed, {});

  let versoUrl = null;
  if (versoFile) {
    const ext2       = versoFile.name.split('.').pop();
    const versoNamed = new File([versoFile], base + '-verso.' + ext2, { type: versoFile.type });
    const versoRes   = await FilePicker.upload('data', folder, versoNamed, {});
    versoUrl = versoRes.path;
  }

  return { recto: rectoRes.path, verso: versoUrl };
}

function _generateCardHtml(actorName, rectoUrl, versoUrl) {
  const name = actorName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  const commonCss = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;
         background:radial-gradient(circle at 50% 10%,rgba(87,43,132,.50),transparent 38%),
                    linear-gradient(135deg,#030407,#090914 50%,#020205);overflow:hidden}
    .card-name{position:absolute;bottom:0;left:0;right:0;padding:16px 20px;
               background:linear-gradient(transparent,rgba(5,3,15,.90));
               color:#e2d9f3;font-family:"Palatino Linotype",Palatino,serif;
               font-size:1.4em;font-weight:bold;letter-spacing:.06em;
               text-shadow:0 2px 8px rgba(0,0,0,.8)}`;

  if (versoUrl) {
    return `<!DOCTYPE html>
<html lang="fr"><head>
  <meta charset="UTF-8"/>
  <title>${name}</title>
  <style>${commonCss}
    .scene{perspective:1400px;width:390px;max-width:88vw;aspect-ratio:2/3;cursor:pointer}
    .card{width:100%;height:100%;position:relative;transform-style:preserve-3d;
          transition:transform .65s cubic-bezier(.4,0,.2,1)}
    .card.flipped{transform:rotateY(180deg)}
    .face{position:absolute;inset:0;border-radius:24px;overflow:hidden;
          backface-visibility:hidden;-webkit-backface-visibility:hidden;
          box-shadow:0 40px 90px rgba(0,0,0,.80),0 0 40px rgba(110,60,255,.28)}
    .face.back{transform:rotateY(180deg)}
    .face img{width:100%;height:100%;object-fit:cover;display:block}
    .hint{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);
          color:rgba(162,139,255,.55);font-size:.8em;font-family:sans-serif;
          letter-spacing:.05em;pointer-events:none;user-select:none}
  </style>
</head><body>
  <div class="scene" id="scene">
    <div class="card" id="card">
      <div class="face front">
        <img src="${rectoUrl}" alt="${name}"/>
        <div class="card-name">${name}</div>
      </div>
      <div class="face back">
        <img src="${versoUrl}" alt="${name} verso"/>
      </div>
    </div>
  </div>
  <div class="hint">Cliquez pour retourner</div>
  <script>
    var card  = document.getElementById('card');
    var scene = document.getElementById('scene');
    card.addEventListener('click', function() { card.classList.toggle('flipped'); });
    scene.addEventListener('mousemove', function(e) {
      if (card.classList.contains('flipped')) return;
      var r  = scene.getBoundingClientRect();
      var rx = ((e.clientY - r.top)  / r.height - .5) * -18;
      var ry = ((e.clientX - r.left) / r.width  - .5) *  18;
      card.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale(1.03)';
    });
    scene.addEventListener('mouseleave', function() {
      if (!card.classList.contains('flipped')) card.style.transform = '';
    });
  </script>
</body></html>`;

  } else {
    return `<!DOCTYPE html>
<html lang="fr"><head>
  <meta charset="UTF-8"/>
  <title>${name}</title>
  <style>${commonCss}
    .scene{perspective:1400px;width:390px;max-width:88vw;aspect-ratio:2/3}
    .card{width:100%;height:100%;border-radius:24px;overflow:hidden;position:relative;
          box-shadow:0 40px 90px rgba(0,0,0,.80),0 0 40px rgba(110,60,255,.28);
          transition:transform .15s ease;transform-style:preserve-3d}
    .card img{width:100%;height:100%;object-fit:cover;display:block}
  </style>
</head><body>
  <div class="scene">
    <div class="card" id="card">
      <img src="${rectoUrl}" alt="${name}"/>
      <div class="card-name">${name}</div>
    </div>
  </div>
  <script>
    var card = document.getElementById('card');
    card.addEventListener('mousemove', function(e) {
      var r  = card.getBoundingClientRect();
      var rx = ((e.clientY - r.top)  / r.height - .5) * -22;
      var ry = ((e.clientX - r.left) / r.width  - .5) *  22;
      card.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg) scale(1.04)';
    });
    card.addEventListener('mouseleave', function() { card.style.transform = ''; });
  </script>
</body></html>`;
  }
}
