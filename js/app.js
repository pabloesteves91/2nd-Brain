import { db, localDay, notesOfDay, listNotes, newNote, saveNote } from './db.js';
import { initEditor, startFresh, openNote, flush, focusEditor, refreshCurrent, autosize, putAway, takePhoto, startTodo, toggleDictation } from './editor.js';
import { openReview } from './review.js';
import { openAll } from './all.js';
import { openSettings } from './settings-view.js';
import { settings, apply } from './settings.js';
import { initSync, scheduleSync, syncNow } from './sync.js';
import { isNative, initNative, scheduleReminder, scheduleWeekly, rescheduleTasks, setStatusBar, tap,
  takePendingAction, readSharedInbox, clearSharedInbox, canDictate } from './native.js';
import { storeImage, dataUrlToBlob } from './images.js';
import { applyTags, adoptCategories } from './tags.js';
import { toast, updateInert } from './ui.js';
import { initLock, onAppState } from './lock.js';
import { showOnboarding } from './onboarding.js';
import { importShared } from './share.js';
import { openPlus } from './plus-view.js';
import { isPlus, grantEarlyUsers, refreshPurchases, shouldAskOnStart } from './plus.js';
import { setSetting } from './settings.js';
import { t, translateDom } from './i18n.js';

const overlay = document.getElementById('overlay');
const body = document.getElementById('sheet-body');
const HIDDEN_KEY = 'sb.hiddenAt';
let view = null;

translateDom();
apply();
initEditor();
document.addEventListener('settings-changed', autosize);
startFresh();

// ---------- Sheets ----------

const views = {
  review: c => openReview(c),
  week: c => openReview(c, { mode: 'week' }),
  all: c => openAll(c),
  settings: c => openSettings(c),
  plus: c => openPlus(c, close),
};

async function open(name) {
  await flush();
  document.activeElement?.blur();
  view = name;
  overlay.hidden = false;
  updateInert();
  body.scrollTop = 0;
  await views[name](body);
  // VoiceOver: Fokus auf die Überschrift des Fensters
  if (!body.contains(document.activeElement)) {
    const sheet = overlay.querySelector('.sheet');
    const title = body.querySelector('h2') || sheet;
    sheet.setAttribute('aria-label', body.querySelector('h2')?.textContent || t('Einstellungen'));
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}

function close() {
  overlay.hidden = true;
  updateInert();
  view = null;
  body.replaceChildren();
  refreshCurrent(); // z. B. in „heute“ abgehakt, während die Notiz im Editor offen ist
  focusEditor();
}

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => open(b.dataset.view)));
overlay.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
document.addEventListener('keydown', e => {
  if (!document.getElementById('lock').hidden) return;
  if (e.key === 'Escape') {
    if (view) close();
    else document.querySelector('.onboarding .ob-skip')?.click();
    return;
  }
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  const act = { n: () => { if (view) close(); putAway(); }, t: () => open('review'), ',': () => open('settings'),
    f: async () => { await open('all'); body.querySelector('.search')?.focus(); } }[k];
  if (!act || document.querySelector('.onboarding')) return;
  e.preventDefault();
  act();
});
document.getElementById('new').addEventListener('click', () => putAway());
document.getElementById('todo').addEventListener('click', () => startTodo());
if (canDictate()) { const sp = document.getElementById('speak'); sp.hidden = false; sp.addEventListener('click', () => toggleDictation()); }

body.addEventListener('open-note', async e => {
  close();
  await openNote(e.detail);
});

// Wischen nach unten auf dem Griff schliesst das Sheet
let dragY = null;
overlay.querySelector('.sheet-grip').addEventListener('pointerdown', e => { dragY = e.clientY; });
window.addEventListener('pointerup', e => {
  if (dragY != null && e.clientY - dragY > 60) close();
  dragY = null;
});

// ---------- Daten geändert (lokal oder per Sync) ----------

document.addEventListener('notes-changed', () => scheduleSync());
document.addEventListener('remote-changed', async () => {
  refreshCurrent();
  if (isNative()) rescheduleTasks(await listNotes());
  if (view === 'review' || view === 'week' || view === 'all') {
    const top = body.scrollTop;
    Promise.resolve(views[view](body)).then(() => { body.scrollTop = top; });
  }
  checkReminder();
});

// ---------- Öffnen → leeres Blatt ----------

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'hidden') {
    await flush();
    try { localStorage.setItem(HIDDEN_KEY, String(Date.now())); } catch { /* egal */ }
    syncNow();
    return;
  }
  const hiddenAt = Number(localStorage.getItem(HIDDEN_KEY) || 0);
  const mins = settings().freshAfterMin;
  if (hiddenAt && Date.now() - hiddenAt >= mins * 60000) {
    if (view) close();
    await startFresh();
  }
  scheduleSync(300);
  checkReminder();
});
window.addEventListener('pagehide', () => { flush(); });
window.addEventListener('online', () => scheduleSync(300));

// ---------- Abend-Hinweis ----------

const banner = document.getElementById('banner');
const bannerOpen = document.getElementById('banner-open');
let bannerAction = () => open('review');
let bannerDismiss = async () => db.setMeta('bannerDismissed', localDay());
bannerOpen.addEventListener('click', () => { banner.hidden = true; bannerAction(); });
document.getElementById('banner-close').addEventListener('click', async () => {
  banner.hidden = true;
  await bannerDismiss();
});

// Fällige Aufgaben (im Browser; in der iOS-App kommen echte Mitteilungen).
async function checkDue() {
  if (isNative()) return false;
  const seen = (await db.getMeta('remindersSeen')) || [];
  const due = (await listNotes()).filter(n => n.remind_at && new Date(n.remind_at) <= new Date()
    && n.status !== 'archived' && !seen.includes(n.id + n.remind_at));
  if (!due.length) return false;
  const n = due[0];
  const text = n.text.replace(/\s+/g, ' ').trim();
  bannerOpen.textContent = `⏰ ${text.length > 34 ? text.slice(0, 32) + '…' : text || t('Erinnerung')} →`;
  const mark = async () => db.setMeta('remindersSeen', [...seen, n.id + n.remind_at].slice(-200));
  bannerAction = async () => { await mark(); if (view) close(); openNote(n.id); };
  bannerDismiss = mark;
  banner.hidden = false;
  return true;
}

async function checkReminder() {
  if (await checkDue()) return;
  bannerOpen.textContent = t('Tag abschliessen →');
  bannerAction = () => open('review');
  bannerDismiss = async () => db.setMeta('bannerDismissed', localDay());
  const s = settings();
  if (!s.reminder || isNative()) { banner.hidden = true; return; }
  const now = new Date();
  const [hh, mm] = s.reviewTime.split(':').map(Number);
  if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;
  const today = localDay();
  const closed = (await db.getMeta('closedDays')) || [];
  if (closed.includes(today) || (await db.getMeta('bannerDismissed')) === today) return;
  const open = (await notesOfDay(today)).filter(n => n.status === 'inbox');
  banner.hidden = open.length === 0;
}
checkReminder();
setInterval(checkReminder, 60000);

// ---------- Sync & Offline ----------

initSync().then(() => scheduleSync(500));
// Einmalig (Update auf 2.4): Kategorien aus vorhandenen Notizen in die Liste übernehmen
db.getMeta('catsAdopted').then(async done => { if (!done) { adoptCategories(await listNotes()); await db.setMeta('catsAdopted', true); } });
if (isNative()) listNotes().then(rescheduleTasks);

// ---------- Native iOS-App ----------

initLock();
// Plus: frühe Nutzer beschenken (vor der Einführung prüfen), Käufe abfragen, Kaufbildschirm ggf. anbieten.
grantEarlyUsers().then(async () => {
  if (!settings().onboarded) showOnboarding();
  else if (shouldAskOnStart()) { setSetting('plusAskedAgain', true); open('plus'); }
  await refreshPurchases();
});
document.addEventListener('onboarding-done', () => { if (isNative() && !isPlus()) open('plus'); });
body.addEventListener('open-plus', () => open('plus'));
document.addEventListener('plus-changed', () => {
  nativeSettings();
  scheduleSync(300);
  if (view === 'settings' || view === 'review' || view === 'week') views[view](body);
});
body.addEventListener('open-onboarding', () => { close(); showOnboarding(); });
initNative({
  onOpenReview: () => open('review'),
  onOpenWeek: () => open('week'),
  onOpenNote: async id => { if (view) close(); await openNote(id); },
  onNewThought: async () => { if (view) close(); await startFresh(); },
  onAppState: active => { onAppState(active); if (active) { nativeInbox(); refreshPurchases(); } },
  onPendingAction: () => nativeInbox(),
  onImport: code => openShared(code),
  onPhoto: async () => { if (view) close(); await startFresh({ focus: false }); await takePhoto(); },
  onTodo: () => { if (view) close(); startTodo(); },
});

// Geteilte Notiz aus einem Link (App: secondbrain://import?d=…, Web: …/#import=…)
async function openShared(code) {
  try {
    const id = await importShared(code);
    if (view) close();
    await openNote(id);
    toast(t('Geteilte Notiz übernommen'));
  } catch { toast(t('Dieser Link enthält keine gültige Notiz')); }
}
function checkImportHash() {
  const m = /^#import=([\w-]+)/.exec(location.hash);
  if (m) { history.replaceState(null, '', location.pathname + location.search); openShared(m[1]); }
}
checkImportHash();
window.addEventListener('hashchange', checkImportHash);

// Kurzbefehl „Neuer Gedanke“ und geteilte Inhalte übernehmen.
let inboxBusy = false;
async function nativeInbox() {
  if (!isNative() || inboxBusy) return;
  inboxBusy = true;
  try {
    const action = await takePendingAction();
    if (action === 'new' || action === 'speak') { if (view) close(); await startFresh(); }
    // Siri „Neuer Gedanke in 2nd Brain“: leeres Blatt und gleich zuhören (kurz warten, bis Siri das Mikrofon freigibt)
    if (action === 'speak' && canDictate()) setTimeout(() => toggleDictation(), 700);
    const items = await readSharedInbox();
    const done = [];
    let imported = 0;
    for (const it of items) {
      if (!it?.id) continue;
      if (await db.get('notes', it.id)) { done.push(it.id); continue; } // schon übernommen
      const n = newNote();
      n.id = it.id;
      n.text = it.text || '';
      if (it.created_at) {
        const d = new Date(it.created_at);
        if (!isNaN(d)) { n.created_at = d.toISOString(); n.day = localDay(d); n.sort_order = d.getTime(); }
      }
      for (const src of it.images || []) {
        try {
          const blob = await dataUrlToBlob(src);
          n.images.push(await storeImage(new File([blob], 'geteilt.jpg', { type: 'image/jpeg' }), n.id));
        } catch (err) { console.warn('Geteiltes Bild übersprungen', err); }
      }
      if (!n.text.trim() && !n.images.length) { done.push(it.id); continue; }
      applyTags(n);
      await saveNote(n);
      imported++;
      done.push(it.id);
    }
    await clearSharedInbox(done);
    if (imported) toast(imported === 1 ? t('1 geteilte Notiz übernommen') : t('{n} geteilte Notizen übernommen', { n: imported }));
  } finally {
    inboxBusy = false;
  }
}
nativeInbox();
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let reminderKey = '';
let weeklyKey = '';
function nativeSettings() {
  if (!isNative()) return;
  const s = settings();
  setStatusBar(s.theme === 'dark' || (s.theme === 'system' && darkQuery.matches));
  const key = `${s.reminder}|${s.reviewTime}`;
  if (key !== reminderKey) { reminderKey = key; scheduleReminder({ enabled: s.reminder, time: s.reviewTime }); }
  const weekly = s.weekly && isPlus(); // Wochenrückblick gehört zu Plus
  const wkey = `${weekly}|${s.weeklyTime}`;
  if (wkey !== weeklyKey) { weeklyKey = wkey; scheduleWeekly({ enabled: weekly, time: s.weeklyTime }); }
}
nativeSettings();
document.addEventListener('settings-changed', nativeSettings);
darkQuery.addEventListener?.('change', nativeSettings);
document.addEventListener('day-closed', tap);

if (!isNative() && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// iOS schiebt beim Fokus eines Feldes die ganze Seite hoch, obwohl die App nie scrollt. Sheets sind
// position:fixed – iOS zeichnet den Cursor dann um genau diesen Betrag zu tief. Seite deshalb immer oben
// halten und stattdessen nur den Sheet-Inhalt so scrollen, dass das Feld sichtbar ist.
const pinTop = () => { if (scrollY || document.documentElement.scrollTop) scrollTo(0, 0); };
window.addEventListener('scroll', pinTop, { passive: true });
let caretTimer;
const fixCaret = () => {
  pinTop();
  clearTimeout(caretTimer);
  caretTimer = setTimeout(() => {
    pinTop();
    const el = document.activeElement;
    const box = el?.closest?.('.sheet-body');
    if (!box || !('selectionStart' in el) || el.selectionStart == null) return;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    const bottom = Math.min(b.bottom, visualViewport?.height ?? innerHeight) - 12;
    if (r.bottom > bottom) box.scrollTop += r.bottom - bottom;
    else if (r.top < b.top + 12) box.scrollTop -= b.top + 12 - r.top;
    const { selectionStart: s, selectionEnd: e, selectionDirection: d } = el;
    el.setSelectionRange(s, e, d || 'none'); // Cursor neu zeichnen lassen
  }, 120);
};
window.addEventListener('resize', fixCaret);
window.visualViewport?.addEventListener('resize', fixCaret);
document.addEventListener('focusin', fixCaret);

// Schwierige Fälle (iOS): Fokus nach dem ersten Tippen erzwingen
document.addEventListener('touchend', e => {
  if (!view && !e.target.closest('nav, .banner, .thumbs, .imgview, .pick, input, label')) focusEditor();
}, { passive: true });
