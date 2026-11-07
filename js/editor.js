import { db, newNote, saveNote } from './db.js';
import { storeImage, imageUrl, removeImage } from './images.js';
import { h, viewImage, flash, findLinks, linkEl, shortUrl } from './ui.js';
import { applyTags } from './tags.js';
import { tap } from './native.js';
import { continueList, initSuggest } from './compose.js';

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
  current.text = text;
  current.deleted = empty;   // leere Notizen verschwinden einfach
  applyTags(current);
  current.dirtyLocal = false;
  await saveNote(current);
  if (!quiet && !empty) flash('gespeichert');
}

export async function addImages(files) {
  if (!current) current = newNote();
  for (const f of files) {
    try {
      const id = await storeImage(f, current.id);
      current.images.push(id);
    } catch (err) {
      console.error(err);
      flash('Bild konnte nicht geladen werden');
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
      h('img', { src, alt: '', onclick: () => viewImage(src, del) }),
      h('button', { type: 'button', 'aria-label': 'Bild entfernen', onclick: del }, '×'),
    ));
  }
}

// „Weglegen“: Notiz speichern, sofort leeres Blatt – ein Abbild der alten Notiz fliegt nach unten weg.
export async function putAway() {
  const t = ta();
  const page = document.getElementById('page');
  const hasContent = t.value.trim() || current?.images.length;
  if (!hasContent) { spring(page); page.style.opacity = ''; return; }

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
  flash('weggelegt');
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
  const startAt = y => { if (editor.scrollTop <= 0) { y0 = y; dy = 0; } };
  const moveTo = (y, e) => {
    if (y0 == null) return;
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
  await flush();
  current = null;
  ta().value = '';
  autosize();
  thumbsEl().replaceChildren();
  if (focus) focusEditor();
}

export async function openNote(id) {
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
