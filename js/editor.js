import { db, newNote, saveNote } from './db.js';
import { storeImage, imageUrl, removeImage } from './images.js';
import { h, flash } from './ui.js';

const ta = () => document.getElementById('note');
const thumbsEl = () => document.getElementById('thumbs');

let current = null;   // die Notiz, die gerade im Editor ist
let timer = null;
let typingTimer = null;

export function autosize() {
  const t = ta();
  t.style.height = 'auto';
  t.style.height = `${t.scrollHeight}px`;
}

export function initEditor() {
  const t = ta();
  document.getElementById('tap-area').addEventListener('click', () => focusEditor(true));
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
    el.append(h('div', { class: 'thumb' },
      h('img', { src, alt: '' }),
      h('button', {
        type: 'button', 'aria-label': 'Bild entfernen',
        onclick: async () => {
          current.images = current.images.filter(x => x !== id);
          await removeImage(id);
          current.dirtyLocal = true;
          await save({ quiet: true });
          renderThumbs();
        },
      }, '×'),
    ));
  }
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
