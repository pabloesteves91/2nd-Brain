import { db, localDay, notesOfDay, listNotes, newNote, saveNote } from './db.js';
import { initEditor, startFresh, openNote, flush, focusEditor, refreshCurrent, autosize, putAway } from './editor.js';
import { openReview } from './review.js';
import { openAll } from './all.js';
import { openSettings } from './settings-view.js';
import { settings, apply } from './settings.js';
import { initSync, scheduleSync, syncNow } from './sync.js';
import { isNative, initNative, scheduleReminder, scheduleWeekly, rescheduleTasks, setStatusBar, tap,
  takePendingAction, readSharedInbox, clearSharedInbox } from './native.js';
import { storeImage, dataUrlToBlob } from './images.js';
import { applyTags } from './tags.js';
import { toast } from './ui.js';
import { initLock, onAppState } from './lock.js';

const overlay = document.getElementById('overlay');
const body = document.getElementById('sheet-body');
const HIDDEN_KEY = 'sb.hiddenAt';
let view = null;

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
};

async function open(name) {
  await flush();
  document.activeElement?.blur();
  view = name;
  overlay.hidden = false;
  body.scrollTop = 0;
  await views[name](body);
}

function close() {
  overlay.hidden = true;
  view = null;
  body.replaceChildren();
  focusEditor();
}

document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => open(b.dataset.view)));
overlay.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && view) close(); });
document.getElementById('new').addEventListener('click', () => putAway());

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
  bannerOpen.textContent = `⏰ ${text.length > 34 ? text.slice(0, 32) + '…' : text || 'Erinnerung'} →`;
  const mark = async () => db.setMeta('remindersSeen', [...seen, n.id + n.remind_at].slice(-200));
  bannerAction = async () => { await mark(); if (view) close(); openNote(n.id); };
  bannerDismiss = mark;
  banner.hidden = false;
  return true;
}

async function checkReminder() {
  if (await checkDue()) return;
  bannerOpen.textContent = 'Tag abschliessen →';
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
if (isNative()) listNotes().then(rescheduleTasks);

// ---------- Native iOS-App ----------

initLock();
initNative({
  onOpenReview: () => open('review'),
  onOpenWeek: () => open('week'),
  onOpenNote: async id => { if (view) close(); await openNote(id); },
  onNewThought: async () => { if (view) close(); await startFresh(); },
  onAppState: active => { onAppState(active); if (active) nativeInbox(); },
  onPendingAction: () => nativeInbox(),
});

// Kurzbefehl „Neuer Gedanke“ und geteilte Inhalte übernehmen.
let inboxBusy = false;
async function nativeInbox() {
  if (!isNative() || inboxBusy) return;
  inboxBusy = true;
  try {
    if ((await takePendingAction()) === 'new') { if (view) close(); await startFresh(); }
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
    if (imported) toast(imported === 1 ? '1 geteilte Notiz übernommen' : `${imported} geteilte Notizen übernommen`);
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
  const wkey = `${s.weekly}|${s.weeklyTime}`;
  if (wkey !== weeklyKey) { weeklyKey = wkey; scheduleWeekly({ enabled: s.weekly, time: s.weeklyTime }); }
}
nativeSettings();
document.addEventListener('settings-changed', nativeSettings);
darkQuery.addEventListener?.('change', nativeSettings);
document.addEventListener('day-closed', tap);

if (!isNative() && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Schwierige Fälle (iOS): Fokus nach dem ersten Tippen erzwingen
document.addEventListener('touchend', e => {
  if (!view && !e.target.closest('nav, .banner, .thumbs, input, label')) focusEditor();
}, { passive: true });
