import { db, newNote, saveNote, localDay } from './db.js';
import { storeImage, imageUrl, removeImage } from './images.js';
import { h, thumbImg, reducedMotion, popMenu, flash, findLinks, linkEl, shortUrl, toast } from './ui.js';
import { applyTags } from './tags.js';
import { tap, canUseCamera, cameraPhotos, startDictation, stopDictation, endDictationListeners } from './native.js';
import { continueList, initSuggest } from './compose.js';
import { t as tr, locale } from './i18n.js';

const ta = () => document.getElementById('note');
const thumbsEl = () => document.getElementById('thumbs');

let current = null;   // die Notiz, die gerade im Editor ist
let timer = null;
let typingTimer = null;

export function autosize() {
  const t = ta();
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight}px`;
  renderLinks();
}

// Links im Text als antippbare Zeile unter dem Schreibfeld
let lastLinks = '';
function renderLinks() {
  const el = document.getElementById('links');
  if (!el) return;
  const links = findLinks(ta().value);
  const key = links.join('\n');
  if (key === lastLinks) return;
  lastLinks = key;
  el.replaceChildren(...links.slice(0, 6).map(u => linkEl(u, `↗ ${shortUrl(u)}`)));
}

export function initEditor() {
  const t = ta();
  document.getElementById('tap-area').addEventListener('click', () => focusEditor(true));
  initPullDown();
  window.addEventListener('resize', autosize);
  t.addEventListener('input', () => {
    autosize();
    document.body.classList.add('typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => document.body.classList.remove('typing'), 2500);
    clearTimeout(timer);
    timer = setTimeout(save, 400);
  });
  t.addEventListener('blur', () => {
    document.body.classList.remove('typing');
    flush();
  });

  document.getElementById('file').addEventListener('change', async e => {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length) await addImages(files);
  });
  // iPhone/iPad-App: eigene Auswahl, damit Kamera-Fotos auch in der Mediathek gespeichert werden
  const fileBtn = document.querySelector('label[for=file]');
  fileBtn.addEventListener('click', e => {
    if (!canUseCamera()) return;
    e.preventDefault();
    pickSource(fileBtn);
  });

  t.addEventListener('click', () => toggleAtCaret(t));

  // Schreibhilfen: #Vorschläge und automatische Listen
  const suggest = initSuggest(t);
  t.addEventListener('beforeinput', e => {
    if (e.inputType !== 'insertLineBreak' && e.inputType !== 'insertParagraph') return;
    if (suggest.isOpen()) suggest.close();
    if (continueList(t)) e.preventDefault();
  });

  // Bilder direkt einfügen (Desktop: Cmd+V)
  t.addEventListener('paste', e => {
    const files = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith('image/'));
    if (files.length) { e.preventDefault(); addImages(files); }
  });
}

export async function flush() {
  if (timer) { clearTimeout(timer); timer = null; await save(); }
}

async function save({ quiet = false } = {}) {
  timer = null;
  const text = ta().value;
  const empty = !text.trim() && (!current || current.images.length === 0);
  if (!current) {
    if (empty) return;
    current = newNote();
  }
  if (current.text === text && !current.dirtyLocal) return;
  if (current.text !== text && current.day !== localDay()) current.edited_day = localDay(); // erscheint dann auch in „heute“
  current.text = text;
  current.deleted = empty;   // leere Notizen verschwinden einfach
  applyTags(current);
  current.dirtyLocal = false;
  await saveNote(current);
  if (!quiet && !empty) flash(tr('gespeichert'));
}

async function fromCamera(fromLibrary) {
  const blobs = await cameraPhotos(fromLibrary);
  if (blobs.length) await addImages(blobs.map((b, i) => new File([b], `foto-${i}.jpg`, { type: b.type || 'image/jpeg' })));
}

// Widget „Foto“: direkt die Kamera; ohne Kamera-Plugin (Mac) die normale Bildauswahl.
export async function takePhoto() {
  if (canUseCamera()) await fromCamera(false);
  else document.getElementById('file').click();
}

function pickSource(anchor) {
  const take = fromLibrary => () => fromCamera(fromLibrary);
  popMenu(anchor, [[tr('Foto aufnehmen'), take(false)], [tr('Aus Mediathek'), take(true)]]);
}

export async function addImages(files) {
  if (!current) current = newNote();
  for (const f of files) {
    try {
      const id = await storeImage(f, current.id);
      current.images.push(id);
    } catch (err) {
      console.error(err);
      flash(tr('Bild konnte nicht geladen werden'));
    }
  }
  current.text = ta().value;
  current.dirtyLocal = true;
  await save();
  await renderThumbs();
  ta().focus({ preventScroll: true });
}

async function renderThumbs() {
  const el = thumbsEl();
  el.replaceChildren();
  if (!current) return;
  for (const id of current.images) {
    const src = await imageUrl(id);
    if (!src) continue;
    const del = async () => {
      current.images = current.images.filter(x => x !== id);
      await removeImage(id);
      current.dirtyLocal = true;
      await save({ quiet: true });
      renderThumbs();
    };
    el.append(h('div', { class: 'thumb' },
      thumbImg(src, del),
      h('button', { type: 'button', 'aria-label': tr('Bild entfernen'), onclick: del }, '×'),
    ));
  }
}

// „Weglegen“: Notiz speichern, sofort leeres Blatt – ein Abbild der alten Notiz fliegt nach unten weg.
// „todo“: aktuelle Notiz weglegen, neues Blatt beginnt mit einem Kreis zum Abhaken.
export async function startTodo() {
  const t = ta();
  if (t.value.trim() || current?.images.length) await putAway();
  else await startFresh({ focus: false });
  t.value = '○ ';
  t.dispatchEvent(new Event('input', { bubbles: true }));
  focusEditor(true);
}

// Kreis am Zeilenanfang angetippt (Cursor davor oder direkt dahinter) → ○ ↔ ✓
function toggleAtCaret(t) {
  const pos = t.selectionStart;
  if (pos !== t.selectionEnd) return;
  const v = t.value;
  const ls = v.lastIndexOf('\n', pos - 1) + 1;
  const ch = v[ls];
  if ((ch !== '○' && ch !== '✓') || pos - ls > 1) return;
  t.setRangeText(ch === '○' ? '✓' : '○', ls, ls + 1, 'preserve');
  const le = v.indexOf('\n', ls);
  t.setSelectionRange(le < 0 ? v.length : le, le < 0 ? v.length : le);
  tap();
  t.dispatchEvent(new Event('input', { bubbles: true }));
}

export async function putAway() {
  const t = ta();
  const page = document.getElementById('page');
  const hasContent = t.value.trim() || current?.images.length;
  if (!hasContent) { spring(page); page.style.opacity = ''; return; }
  if (reducedMotion()) { // Bewegung reduzieren: ohne Wegflieg-Animation
    await flush(); tap(); await startFresh({ focus: false }); focusEditor(); flash(tr('weggelegt')); return;
  }

  // Abbild für die Animation
  const r = page.getBoundingClientRect();
  const ghost = page.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  const gNote = ghost.querySelector('textarea');
  if (gNote) { gNote.value = t.value; gNote.tabIndex = -1; gNote.readOnly = true; }
  Object.assign(ghost.style, {
    position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    pointerEvents: 'none', zIndex: 3, margin: 0, transform: page.style.transform, opacity: page.style.opacity || '1',
  });
  ghost.classList.add('ghost');
  document.body.append(ghost);

  // Sofort speichern und frisches Blatt – Tastatur bleibt offen
  await flush();
  tap();
  await startFresh({ focus: false });
  focusEditor();
  page.style.transition = 'none';
  page.style.transform = '';
  page.style.opacity = '0';

  requestAnimationFrame(() => {
    ghost.style.transition = 'transform .34s cubic-bezier(.4,0,.6,1), opacity .34s ease';
    ghost.style.transform = 'translateY(45vh) scale(.96)';
    ghost.style.opacity = '0';
    page.style.transition = 'opacity .3s ease .08s';
    page.style.opacity = '';
  });
  setTimeout(() => ghost.remove(), 420);
  flash(tr('weggelegt'));
}

function spring(page) {
  page.style.transition = 'transform .25s cubic-bezier(.2,.8,.2,1)';
  page.style.transform = '';
}

// Im Schreibfeld nach unten ziehen (nur wenn ganz oben) = weglegen.
function initPullDown() {
  const editor = document.getElementById('editor');
  const page = document.getElementById('page');
  let y0 = null, dy = 0;
  // Beim Markieren von Text (Griffe ziehen, lange drücken) nicht weglegen und nichts verschieben
  const selecting = () => { const t = ta(); return document.activeElement === t && t.selectionStart !== t.selectionEnd; };
  const cancel = () => { if (y0 == null) return; y0 = null; dy = 0; spring(page); page.style.opacity = ''; };
  document.addEventListener('selectionchange', () => { if (selecting()) cancel(); });
  const startAt = y => { if (editor.scrollTop <= 0 && !selecting()) { y0 = y; dy = 0; } };
  const moveTo = (y, e) => {
    if (y0 == null) return;
    if (selecting()) return cancel();
    dy = y - y0;
    if (dy <= 0 || editor.scrollTop > 0) { if (dy < 0) y0 = null; return; }
    if (dy > 8) e?.cancelable && e.preventDefault();
    page.style.transition = 'none';
    page.style.transform = `translateY(${Math.min(dy * 0.5, 160)}px)`;
    page.style.opacity = String(Math.max(0.35, 1 - dy / 400));
  };
  const finish = () => {
    if (y0 == null) return;
    y0 = null;
    if (dy > 120) putAway();
    else { spring(page); page.style.opacity = ''; }
    dy = 0;
  };
  editor.addEventListener('touchstart', e => { if (e.touches.length === 1) startAt(e.touches[0].clientY); }, { passive: true });
  editor.addEventListener('touchmove', e => moveTo(e.touches[0].clientY, e), { passive: false });
  editor.addEventListener('touchend', finish);
  editor.addEventListener('touchcancel', finish);
  // Maus (Desktop): mit gedrückter Maustaste im leeren Bereich ziehen
  editor.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.target.id !== 'note') startAt(e.clientY); });
  window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') moveTo(e.clientY); });
  window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') finish(); });
}

// Leeres Blatt – der Kern des Workflows.
export async function startFresh({ focus = true } = {}) {
  cancelDictation();
  await flush();
  current = null;
  ta().value = '';
  autosize();
  thumbsEl().replaceChildren();
  if (focus) focusEditor();
}

export async function openNote(id) {
  cancelDictation();
  await flush();
  const note = await db.get('notes', id);
  if (!note) return;
  current = note;
  ta().value = note.text;
  autosize();
  await renderThumbs();
  focusEditor(true);
}

export function focusEditor(toEnd = false) {
  if (document.querySelector('.onboarding')) return; // Einführung offen → keine Tastatur
  const t = ta();
  t.focus({ preventScroll: true });
  if (toEnd) t.setSelectionRange(t.value.length, t.value.length);
}

export function currentNoteId() {
  return current?.id ?? null;
}

// Wenn eine Notiz im Hintergrund (z. B. per Sync) geändert wurde.
export async function refreshCurrent() {
  if (!current || timer) return;
  const fresh = await db.get('notes', current.id);
  if (!fresh) return;
  if (fresh.deleted) return startFresh({ focus: false });
  if (fresh.updated_at > current.updated_at) {
    current = fresh;
    ta().value = fresh.text;
    autosize();
    renderThumbs();
  }
}

// ---------- Spracheingabe ----------
// Gesprochenes erscheint live an der Cursor-Position; jedes Teilergebnis ersetzt das vorherige.
let dict = null; // { start, len, sep, quiet, safety }
const speakBtn = () => document.getElementById('speak');

function speakState(on) {
  const b = speakBtn();
  if (!b) return;
  b.classList.toggle('listening', on);
  b.setAttribute('aria-pressed', String(on));
  b.textContent = tr(on ? 'stopp' : 'sprechen');
}

export async function toggleDictation() {
  if (dict) { // zweiter Tipp: Aufnahme beenden, Endergebnis kommt noch
    clearTimeout(dict.quiet);
    dict.safety = setTimeout(cancelDictation, 3000);
    stopDictation();
    return;
  }
  const t = ta();
  const pos = document.activeElement === t ? t.selectionEnd : t.value.length;
  const before = t.value.slice(0, pos);
  dict = { start: pos, len: 0, sep: before && !/\s$/.test(before) ? ' ' : '', quiet: 0, safety: 0 };
  speakState(true);
  tap();
  try {
    await startDictation(locale(), onDictation, cancelDictation);
  } catch (err) {
    cancelDictation();
    const m = String(err?.message || err);
    toast(/denied/.test(m) ? tr('Spracheingabe nicht erlaubt – bitte in den Einstellungen erlauben.')
      : /unavailable/.test(m) ? tr('Spracheingabe ist auf diesem Gerät nicht verfügbar.')
        : tr('Spracheingabe: {e}', { e: m }));
  }
}

function onDictation(text, final) {
  if (!dict || !text) return;
  const t = ta();
  const ins = dict.sep + text;
  t.setRangeText(ins, dict.start, dict.start + dict.len, 'end');
  dict.len = ins.length;
  t.dispatchEvent(new Event('input', { bubbles: true }));
  clearTimeout(dict.quiet);
  if (final) cancelDictation();
  else dict.quiet = setTimeout(() => dict && toggleDictation(), 2500); // nach Stille selbst beenden
}

export function cancelDictation() {
  if (!dict) return;
  clearTimeout(dict.quiet); clearTimeout(dict.safety);
  dict = null;
  stopDictation();
  endDictationListeners();
  speakState(false);
}
