import { db, wipeAll, emitChange } from './db.js';
import { blobToDataUrl, dataUrlToBlob } from './images.js';
import { settings, setSetting } from './settings.js';
import * as sync from './sync.js';
import { h } from './ui.js';

const seg = (key, options) => h('div', { class: 'seg' }, options.map(([v, label]) =>
  h('button', {
    type: 'button', class: settings()[key] === v ? 'on' : '',
    onclick: e => {
      setSetting(key, v);
      [...e.currentTarget.parentNode.children].forEach(b => b.classList.remove('on'));
      e.currentTarget.classList.add('on');
    },
  }, label)));

const row = (label, control, hint) => h('div', { class: 'row' },
  h('div', {}, label, hint ? h('div', { class: 'hint' }, hint) : null), control);

const toggle = (key) => h('label', { class: 'switch' },
  h('input', { type: 'checkbox', checked: settings()[key], onchange: e => setSetting(key, e.target.checked) }),
  h('span'));

export function openSettings(container) {
  const s = settings();

  const cats = h('div', { class: 'cats' });
  const renderCats = () => cats.replaceChildren(
    ...settings().categories.map(c => h('span', { class: 'chip' }, c,
      h('button', {
        type: 'button', 'aria-label': `${c} entfernen`,
        onclick: () => { setSetting('categories', settings().categories.filter(x => x !== c)); renderCats(); },
      }, '×'))),
  );
  renderCats();
  const newCat = h('input', { type: 'text', placeholder: 'Neue Kategorie', enterkeyhint: 'done' });
  const addCat = () => {
    const v = newCat.value.trim();
    if (v && !settings().categories.includes(v)) setSetting('categories', [...settings().categories, v]);
    newCat.value = '';
    renderCats();
  };
  newCat.addEventListener('keydown', e => { if (e.key === 'Enter') addCat(); });

  container.replaceChildren(
    h('div', { class: 'head' }, h('h2', {}, 'Einstellungen')),

    h('div', { class: 'group' }, h('h3', {}, 'Schreiben'),
      row('Schrift', seg('font', [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']])),
      row('Grösse', h('input', {
        type: 'range', min: 15, max: 26, step: 1, value: s.size,
        oninput: e => setSetting('size', Number(e.target.value)),
      })),
      row('Erscheinung', seg('theme', [['system', 'Auto'], ['light', 'Hell'], ['dark', 'Dunkel']])),
      row('Leeres Blatt nach', h('div', {},
        h('input', {
          type: 'number', min: 0, max: 240, value: s.freshAfterMin,
          onchange: e => setSetting('freshAfterMin', Math.max(0, Number(e.target.value) || 0)),
        }), ' Min.'), '0 = jedes Mal beim Öffnen'),
    ),

    h('div', { class: 'group' }, h('h3', {}, 'Tagesrückblick'),
      row('Abend-Hinweis', toggle('reminder'), 'Dezenter Hinweis zum Sortieren'),
      row('Ab', h('input', { type: 'time', value: s.reviewTime, onchange: e => setSetting('reviewTime', e.target.value) })),
    ),

    h('div', { class: 'group' }, h('h3', {}, 'Kategorien'),
      cats,
      row(newCat, h('button', { type: 'button', class: 'link', onclick: addCat }, 'hinzufügen')),
    ),

    syncSection(),

    h('div', { class: 'group' }, h('h3', {}, 'Daten'),
      row('Exportieren', h('button', { type: 'button', class: 'link', onclick: exportData }, 'JSON sichern')),
      row('Importieren', h('label', { class: 'link' }, 'Datei wählen',
        h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: importData }))),
      row('Alles löschen', h('button', {
        type: 'button', class: 'danger',
        onclick: async () => {
          if (!confirm('Wirklich alle Notizen auf diesem Gerät löschen?')) return;
          await wipeAll();
          location.reload();
        },
      }, 'löschen'), 'Nur auf diesem Gerät'),
    ),

    h('p', { class: 'small', style: 'text-align:center;margin-top:28px' }, 'Öffnen. Schreiben. Schliessen.'),
  );
}

function syncSection() {
  const box = h('div', { class: 'group' }, h('h3', {}, 'Cloud-Sync'));
  const body = h('div');
  box.append(body);

  if (!sync.syncEnabled) {
    body.append(h('p', { class: 'small' }, 'Noch nicht eingerichtet. Firebase-Konfiguration in js/config.js eintragen (siehe README). Bis dahin bleibt alles nur auf diesem Gerät.'));
    return box;
  }

  const statusText = () => {
    const st = sync.syncStatus();
    if (st.state === 'syncing') return 'synchronisiert …';
    if (st.state === 'error') return `Fehler: ${st.error}`;
    if (st.state === 'offline') return 'offline – wird später nachgeholt';
    if (st.at) return `zuletzt ${new Date(st.at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`;
    return 'bereit';
  };

  const render = async () => {
    body.replaceChildren(h('p', { class: 'small' }, 'lädt …'));
    let user = null;
    try { user = await sync.currentUser(); } catch { /* offline */ }
    if (user) {
      const st = h('span', { class: 'small' }, statusText());
      const onStatus = () => { st.textContent = statusText(); };
      document.addEventListener('sync-status', onStatus);
      body.replaceChildren(
        row('Angemeldet', h('button', { type: 'button', class: 'link', onclick: async () => { await sync.signOut(); render(); } }, 'abmelden'), user.email || user.displayName || ''),
        row(st, h('button', { type: 'button', class: 'link', onclick: () => sync.syncNow() }, 'jetzt synchronisieren')),
      );
      return;
    }
    const err = h('p', { class: 'small' });
    const email = h('input', { type: 'email', placeholder: 'E-Mail', autocomplete: 'email' });
    const pw = h('input', { type: 'password', placeholder: 'Passwort', autocomplete: 'current-password', style: 'flex:1;min-width:0;border:1px solid var(--line);border-radius:8px;padding:6px 10px;background:var(--card);font-size:15px' });
    const go = create => async () => {
      err.textContent = '';
      try { await sync.signInEmail(email.value.trim(), pw.value, create); render(); }
      catch (e) { err.textContent = e.message; }
    };
    body.replaceChildren(
      h('p', { class: 'small' }, 'Melde dich an, um deine Notizen auf allen Geräten zu haben.'),
      row('Google', h('button', {
        type: 'button', class: 'link',
        onclick: async () => { err.textContent = ''; try { await sync.signInGoogle(); render(); } catch (e) { err.textContent = e.message; } },
      }, 'mit Google anmelden')),
      h('div', { class: 'row' }, email),
      h('div', { class: 'row' }, pw),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'link', onclick: go(false) }, 'anmelden'),
        h('button', { type: 'button', class: 'link', onclick: go(true) }, 'neues Konto'),
      ),
      err,
    );
  };
  render();
  document.addEventListener('auth-changed', render, { once: true });
  return box;
}

async function exportData() {
  const notes = (await db.all('notes')).filter(n => !n.deleted).map(({ dirty, dirtyLocal, ...n }) => n);
  const images = [];
  for (const img of await db.all('images')) {
    if (img.blob) images.push({ id: img.id, note_id: img.note_id, data: await blobToDataUrl(img.blob) });
  }
  const blob = new Blob([JSON.stringify({ app: '2nd-brain', version: 1, exported_at: new Date().toISOString(), notes, images })], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `2nd-brain-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function importData(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.notes)) throw new Error('Unbekanntes Format');
    let count = 0;
    for (const img of data.images || []) {
      if (!(await db.get('images', img.id))) await db.put('images', { id: img.id, note_id: img.note_id, blob: await dataUrlToBlob(img.data), dirty: true });
    }
    for (const n of data.notes) {
      const local = await db.get('notes', n.id);
      if (!local || n.updated_at > local.updated_at) { await db.put('notes', { ...n, images: n.images || [], dirty: true }); count++; }
    }
    emitChange();
    sync.scheduleSync(500);
    alert(`${count} Notizen importiert.`);
  } catch (err) {
    alert(`Import fehlgeschlagen: ${err.message}`);
  }
}
