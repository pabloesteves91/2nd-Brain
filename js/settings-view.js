import { db, wipeAll, emitChange } from './db.js';
import { dataUrlToBlob } from './images.js';
import { buildBackup } from './backup.js';
import { settings, setSetting } from './settings.js';
import * as sync from './sync.js';
import { h, toast, askConfirm } from './ui.js';
import { isNative, isAndroid, biometryAvailable, verifyIdentity, appInfo } from './native.js';
import { APP_VERSION, SUPPORT_EMAIL, siteUrl } from './config.js';
import { isPlus, plusKind } from './plus.js';
import { canBuy, manageSubscriptions, canBackup } from './native.js';
import { refreshPurchases } from './plus.js';
import { t, locale } from './i18n.js';

function aboutHeader() {
  const sub = h('div', { class: 'about-sub' }, t('Version {v}', { v: APP_VERSION }));
  const mail = h('a', { class: 'support-btn', href: '#' }, t('Support'));
  const setMail = version => {
    const platform = isAndroid() ? 'Android-App' : isNative() ? 'iOS-App' : 'Web-App';
    const body = `\n\n\n—\n2nd Brain ${version} · ${platform}\n${navigator.userAgent}`;
    mail.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('2nd Brain Support')}&body=${encodeURIComponent(body)}`;
  };
  setMail(APP_VERSION);
  appInfo().then(info => {
    if (!info?.version) return;
    const v = info.build && info.build !== info.version ? `${info.version} (${info.build})` : info.version;
    sub.textContent = t('Version {v}', { v });
    setMail(v);
  });
  return h('div', { class: 'about' },
    h('div', { class: 'about-mark', 'aria-hidden': 'true' }),
    h('div', { class: 'about-text' },
      h('div', { class: 'about-name' }, '2nd Brain'),
      h('div', { class: 'about-sub' }, t('Öffnen. Schreiben. Schliessen.')),
      sub),
    h('div', { class: 'about-actions' },
      mail,
      h('a', { class: 'link', href: siteUrl(), target: '_blank', rel: 'noopener' }, t('Website')),
      h('a', { class: 'link', href: siteUrl('privacy.html'), target: '_blank', rel: 'noopener' }, t('Datenschutz'))),
  );
}

const seg = (key, options) => h('div', { class: 'seg' }, options.map(([v, de]) =>
  h('button', {
    type: 'button', class: settings()[key] === v ? 'on' : '',
    onclick: e => {
      setSetting(key, v);
      if (key === 'lang') { location.reload(); return; } // alles neu in der gewählten Sprache
      [...e.currentTarget.parentNode.children].forEach(b => b.classList.remove('on'));
      e.currentTarget.classList.add('on');
    },
  }, t(de))));

const row = (label, control, hint) => {
  // VoiceOver: Schalter/Felder bekommen den Zeilentitel als Namen
  const fields = control instanceof Element ? [control, ...control.querySelectorAll('input, select')].filter(el => el.matches('input, select')) : [];
  for (const f of fields) if (!f.hasAttribute('aria-label') && typeof label === 'string') f.setAttribute('aria-label', label);
  return h('div', { class: 'row' }, h('div', {}, label, hint ? h('div', { class: 'hint' }, hint) : null), control);
};

const toggle = (key) => h('label', { class: 'switch' },
  h('input', { type: 'checkbox', checked: settings()[key], onchange: e => setSetting(key, e.target.checked) }),
  h('span'));

// Feedback: aufklappbares Textfeld, landet in Firestore (Sammlung „feedback“).
function feedbackRow() {
  const field = h('textarea', { class: 'feedback-text', rows: 4, maxlength: 2000, 'aria-label': t('Feedback'),
    placeholder: t('Was fehlt dir, was stört dich?'), oninput: () => { send.disabled = !field.value.trim(); } });
  const send = h('button', { type: 'button', class: 'primary', disabled: true, onclick: async () => {
    send.disabled = true;
    send.textContent = t('Wird gesendet …');
    try {
      await Promise.race([sync.sendFeedback(field.value), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 15000))]);
      field.value = '';
      box.hidden = true;
      toast(t('Danke für dein Feedback!'));
    } catch (err) {
      toast(!navigator.onLine || err?.message === 'timeout' ? t('Keine Verbindung – später nochmal versuchen') : t('Senden fehlgeschlagen – später nochmal versuchen'));
      send.disabled = false;
    }
    send.textContent = t('Senden');
  } }, t('Senden'));
  const box = h('div', { class: 'feedback', hidden: true }, field, send);
  const toggleBtn = h('button', { type: 'button', class: 'link', 'aria-expanded': 'false', onclick: () => {
    box.hidden = !box.hidden;
    toggleBtn.setAttribute('aria-expanded', String(!box.hidden));
    if (!box.hidden) field.focus();
  } }, t('schreiben'));
  return [row(t('Feedback senden'), toggleBtn, t('Ideen, Fehler, Wünsche – direkt an mich')), box];
}

const openPlusEvt = e => e.currentTarget.dispatchEvent(new CustomEvent('open-plus', { bubbles: true }));
const plusLink = label => h('button', { type: 'button', class: 'link', onclick: openPlusEvt }, label);
const KIND_TEXT = { monthly: t('Monatsabo'), yearly: t('Jahresabo'), lifetime: t('für immer'), early: t('Geschenk für frühe Nutzer'), gift: t('geschenkt') };

// Immer sichtbar (in der App mit Store): Plus ansehen bzw. Status.
function plusSection() {
  if (!canBuy()) return null;
  const kind = plusKind();
  return h('div', { class: 'group' }, h('h3', {}, t('2nd Brain Plus')),
    kind
      ? [row(t('Plus aktiv ✓'), (kind === 'monthly' || kind === 'yearly')
        ? h('button', { type: 'button', class: 'link', onclick: async () => { await manageSubscriptions(); refreshPurchases(); } }, t('Abo verwalten')) : null,
      KIND_TEXT[kind]),
      row(t('Plus-Optionen'), plusLink(t('Ansehen')), t('Monat, Jahr oder für immer'))]
      : row(t('Unterstütze 2nd Brain'), plusLink(t('Ansehen')), t('Sync auf allen Geräten und Wochenrückblick')));
}

export function openSettings(container) {
  const s = settings();

  const cats = h('div', { class: 'cats' });
  const renderCats = () => cats.replaceChildren(
    ...settings().categories.map(c => h('span', { class: 'chip' }, c,
      h('button', {
        type: 'button', 'aria-label': t('{c} entfernen', { c }),
        onclick: () => { setSetting('categories', settings().categories.filter(x => x !== c)); renderCats(); },
      }, '×'))),
  );
  renderCats();
  const newCat = h('input', { type: 'text', placeholder: t('Neue Kategorie'), enterkeyhint: 'done' });
  const addCat = () => {
    const v = newCat.value.trim();
    if (v && !settings().categories.includes(v)) setSetting('categories', [...settings().categories, v]);
    newCat.value = '';
    renderCats();
  };
  newCat.addEventListener('keydown', e => { if (e.key === 'Enter') addCat(); });

  container.replaceChildren(...[
    aboutHeader(),
    plusSection(),

    h('div', { class: 'group' }, h('h3', {}, t('Schreiben')),
      row(t('Schrift'), seg('font', [['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']])),
      row(t('Grösse'), h('input', {
        type: 'range', min: 15, max: 26, step: 1, value: s.size,
        oninput: e => setSetting('size', Number(e.target.value)),
      })),
      row(t('Erscheinung'), seg('theme', [['system', 'Auto'], ['light', 'Hell'], ['dark', 'Dunkel']])),
      row(t('Sprache'), seg('lang', [['auto', 'Auto'], ['de', 'Deutsch'], ['en', 'English']])),
      row(t('Leeres Blatt nach'), h('div', {},
        h('input', {
          type: 'number', min: 0, max: 240, value: s.freshAfterMin,
          onchange: e => setSetting('freshAfterMin', Math.max(0, Number(e.target.value) || 0)),
        }), ` ${t('Min.')}`), t('0 = jedes Mal beim Öffnen')),
    ),

    h('div', { class: 'group' }, h('h3', {}, t('Tagesrückblick')),
      row(t('Abend-Hinweis'), toggle('reminder'), isNative() ? t('Mitteilung zur eingestellten Zeit') : t('Dezenter Hinweis zum Sortieren')),
      row(isNative() ? t('Um') : t('Ab'), h('input', { type: 'time', 'aria-label': t('Abend-Hinweis Uhrzeit'), value: s.reviewTime, onchange: e => setSetting('reviewTime', e.target.value) })),
      row(t('Wiederentdecken'), toggle('rediscover'), t('Alte Gedanken von vor 7, 30 oder 365 Tagen')),
    ),

    h('div', { class: 'group' }, h('h3', {}, t('Wochenrückblick')),
      isNative() ? row(t('Sonntags erinnern'), isPlus() ? toggle('weekly') : plusLink(t('Mit Plus')), t('Mitteilung mit Blick auf die Woche')) : null,
      isNative() ? row(t('Um'), h('input', { type: 'time', 'aria-label': t('Wochenrückblick Uhrzeit'), value: s.weeklyTime, onchange: e => setSetting('weeklyTime', e.target.value) })) : null,
      h('p', { class: 'small' }, t('Unter „heute“ → „Woche“ jederzeit ansehen.')),
    ),

    h('div', { class: 'group' }, h('h3', {}, t('Kategorien')),
      cats,
      row(newCat, h('button', { type: 'button', class: 'link', onclick: addCat }, t('hinzufügen'))),
      row(t('#Tags übernehmen'), toggle('tagsAsCategory'), t('Neue #Tags im Text werden automatisch zur Kategorie. Bekannte Kategorien (#idee, #aufgabe …) werden immer erkannt.')),
    ),

    isNative() ? h('div', { class: 'group' }, h('h3', {}, t('Privatsphäre')),
      row(t(isAndroid() ? 'Mit Fingerabdruck sperren' : 'Mit Face ID sperren'), h('label', { class: 'switch' },
        h('input', {
          type: 'checkbox', checked: s.faceId,
          onchange: async e => {
            const want = e.target.checked;
            if (want && !(await biometryAvailable())) { toast(t(isAndroid() ? 'Fingerabdruck ist auf diesem Gerät nicht verfügbar oder nicht eingerichtet.' : 'Face ID ist auf diesem Gerät nicht verfügbar oder nicht eingerichtet.')); e.target.checked = false; return; }
            if (!(await verifyIdentity())) { e.target.checked = !want; return; }
            setSetting('faceId', want);
          },
        }), h('span')), t('Beim Öffnen nach „Leeres Blatt nach“')),
    ) : null,

    syncSection(),

    h('div', { class: 'group' }, h('h3', {}, t('Hilfe')),
      row(t('Einführung ansehen'), h('button', {
        type: 'button', class: 'link',
        onclick: e => e.currentTarget.dispatchEvent(new CustomEvent('open-onboarding', { bubbles: true })),
      }, t('öffnen'))),
      sync.syncEnabled ? feedbackRow() : null,
      h('p', { class: 'small kbd-hint' }, t('Tastatur: ⌘N neu · ⌘F suchen · ⌘T heute · ⌘, Einstellungen · Esc schliessen')),
    ),

    h('div', { class: 'group' }, h('h3', {}, t('Daten')),
      canBackup() ? backupRow() : null,
      row(t('Exportieren'), h('button', { type: 'button', class: 'link', onclick: exportData }, t('JSON sichern'))),
      row(t('Importieren'), h('label', { class: 'link' }, t('Datei wählen'),
        h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: importData }))),
      row(t('Alles löschen'), h('button', {
        type: 'button', class: 'danger',
        onclick: async () => {
          if (!(await askConfirm({ title: t('Alles löschen?'), text: t('Alle Notizen und Bilder auf diesem Gerät werden gelöscht. Das lässt sich nicht rückgängig machen.'), ok: t('Alles löschen') }))) return;
          await wipeAll();
          location.reload();
        },
      }, t('löschen')), t('Nur auf diesem Gerät')),
    ),


  ].filter(Boolean)); // ohne Filter würde „null“ als Text erscheinen
}

function syncSection() {
  const box = h('div', { class: 'group' }, h('h3', {}, t('Cloud-Sync')));
  const body = h('div');
  box.append(body);

  if (!sync.syncEnabled) {
    body.append(h('p', { class: 'small' }, t('Noch nicht eingerichtet. Firebase-Konfiguration in js/config.js eintragen (siehe README). Bis dahin bleibt alles nur auf diesem Gerät.')));
    return box;
  }

  const statusText = () => {
    const st = sync.syncStatus();
    if (st.state === 'syncing') return t('synchronisiert …');
    if (st.state === 'error') return t('Fehler: {e}', { e: st.error });
    if (st.state === 'offline') return t('offline – wird später nachgeholt');
    if (st.state === 'plus' || !isPlus()) return t('pausiert – Sync gehört zu Plus');
    if (st.at) return t('zuletzt {time}', { time: new Date(st.at).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) });
    return t('bereit');
  };

  const render = async () => {
    body.replaceChildren(h('p', { class: 'small' }, t('lädt …')));
    let user = null;
    try { user = await sync.currentUser(); } catch { /* offline */ }
    if (user) {
      const st = h('span', { class: 'small' }, statusText());
      const onStatus = () => { st.textContent = statusText(); };
      document.addEventListener('sync-status', onStatus);
      body.replaceChildren(
        row(t('Angemeldet'), h('button', { type: 'button', class: 'link', onclick: async () => { await sync.signOut(); render(); } }, t('abmelden')), user.email || user.displayName || ''),
        row(st, h('button', { type: 'button', class: 'link', onclick: () => sync.syncNow() }, t('jetzt synchronisieren'))),
        row(t('Konto löschen'), h('button', {
          type: 'button', class: 'danger',
          onclick: async () => {
            if (!(await askConfirm({ title: t('Konto wirklich löschen?'), text: t('Dein Konto und alle Notizen und Bilder in der Cloud werden endgültig gelöscht. Die Notizen auf diesem Gerät bleiben erhalten.'), ok: t('Konto löschen') }))) return;
            try { await sync.deleteAccount(); render(); toast(t('Konto gelöscht')); } catch (e) { toast(e.message); }
          },
        }, t('löschen')), t('Entfernt alle Cloud-Daten')),
      );
      return;
    }
    const err = h('p', { class: 'small' });
    const email = h('input', { type: 'email', placeholder: t('E-Mail'), autocomplete: 'email' });
    const pw = h('input', { type: 'password', placeholder: t('Passwort'), autocomplete: 'current-password', style: 'flex:1;min-width:0;border:1px solid var(--line);border-radius:8px;padding:6px 10px;background:var(--card);font-size:.8824rem' });
    const go = create => async () => {
      err.textContent = '';
      try { await sync.signInEmail(email.value.trim(), pw.value, create); render(); }
      catch (e) { err.textContent = e.message; }
    };
    body.replaceChildren(
      isPlus() ? h('p', { class: 'small' }, t('Melde dich an, um deine Notizen auf allen Geräten zu haben.'))
        : h('div', { class: 'plus-teaser' }, h('b', {}, t('Sync auf allen Geräten')), h('p', {}, t('Der Sync gehört zu 2nd Brain Plus. Hast du Plus geschenkt bekommen? Dann melde dich unten an.')),
          h('button', { type: 'button', class: 'primary', onclick: e => e.currentTarget.dispatchEvent(new CustomEvent('open-plus', { bubbles: true })) }, t('Sync einschalten'))),
      // shortcut: Android nur mit E-Mail – Google-Anmeldung braucht dort ein natives Plugin (Popup geht im WebView nicht)
      isAndroid() ? null : isNative()
        ? row('Apple', h('button', {
          type: 'button', class: 'link',
          onclick: async () => { err.textContent = ''; try { await sync.signInApple(); render(); } catch (e) { err.textContent = e.message; } },
        }, t('Mit Apple anmelden')))
        : row('Google', h('button', {
          type: 'button', class: 'link',
          onclick: async () => { err.textContent = ''; try { await sync.signInGoogle(); render(); } catch (e) { err.textContent = e.message; } },
        }, t('mit Google anmelden'))),
      h('div', { class: 'row' }, email),
      h('div', { class: 'row' }, pw),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'link', onclick: go(false) }, t('anmelden')),
        h('button', { type: 'button', class: 'link', onclick: go(true) }, t('neues Konto')),
      ),
      h('div', { class: 'row' }, h('button', {
        type: 'button', class: 'link small',
        onclick: async () => {
          err.textContent = '';
          const mail = email.value.trim();
          if (!mail) { err.textContent = t('Gib zuerst deine E-Mail ein.'); email.focus(); return; }
          try { await sync.resetPassword(mail); toast(t('Falls es ein Konto gibt, ist die E-Mail zum Zurücksetzen unterwegs.')); }
          catch (e) { err.textContent = e.message; }
        },
      }, t('Passwort vergessen?'))),
      err,
    );
  };
  render();
  document.addEventListener('auth-changed', render, { once: true });
  return box;
}

async function exportData() {
  const blob = new Blob([await buildBackup()], { type: 'application/json' });
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
    if (!Array.isArray(data.notes)) throw new Error(t('Unbekanntes Format'));
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
    toast(t('{n} Notizen importiert.', { n: count }));
  } catch (err) {
    toast(t('Import fehlgeschlagen: {e}', { e: err.message }));
  }
}

// Auto-Backup: nur Info, wann zuletzt gesichert wurde (wo: Dateien-App bzw. Downloads)
function backupRow() {
  const hint = h('span', {}, t('Wöchentlich, das erste kommt bald'));
  db.getMeta('backupAt').then(at => { if (at) hint.textContent = t('Wöchentlich – zuletzt am {d}', { d: new Date(at).toLocaleDateString(locale()) }); });
  return row(t('Automatisches Backup'), h('span', { class: 'small' }, isAndroid() ? 'Downloads › 2nd Brain' : t('Dateien › 2nd Brain')), hint);
}
