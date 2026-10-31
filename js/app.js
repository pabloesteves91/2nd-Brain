import { db, localDay, notesOfDay } from './db.js';
import { initEditor, startFresh, openNote, flush, focusEditor, refreshCurrent, autosize } from './editor.js';
import { openReview } from './review.js';
import { openAll } from './all.js';
import { openSettings } from './settings-view.js';
import { settings, apply } from './settings.js';
import { initSync, scheduleSync, syncNow } from './sync.js';

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
document.getElementById('new').addEventListener('click', () => startFresh());

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
document.addEventListener('remote-changed', () => {
  refreshCurrent();
  if (view === 'review' || view === 'all') {
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
document.getElementById('banner-open').addEventListener('click', () => { banner.hidden = true; open('review'); });
document.getElementById('banner-close').addEventListener('click', async () => {
  banner.hidden = true;
  await db.setMeta('bannerDismissed', localDay());
});

async function checkReminder() {
  const s = settings();
  if (!s.reminder) { banner.hidden = true; return; }
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

// ---------- Sync & Offline ----------

initSync().then(() => scheduleSync(500));

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Schwierige Fälle (iOS): Fokus nach dem ersten Tippen erzwingen
document.addEventListener('touchend', e => {
  if (!view && !e.target.closest('nav, .banner, .thumbs, input, label')) focusEditor();
}, { passive: true });
