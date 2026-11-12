// Kleine IndexedDB-Schicht. Alles lebt zuerst lokal (offline-first).

const DB_NAME = 'second-brain';
const DB_VERSION = 1;
let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      const notes = d.createObjectStore('notes', { keyPath: 'id' });
      notes.createIndex('day', 'day');
      const images = d.createObjectStore('images', { keyPath: 'id' });
      images.createIndex('note_id', 'note_id');
      d.createObjectStore('meta');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  get: (store, key) => run(store, 'readonly', s => s.get(key)),
  all: (store) => run(store, 'readonly', s => s.getAll()),
  put: (store, value) => run(store, 'readwrite', s => { s.put(value); }),
  del: (store, key) => run(store, 'readwrite', s => { s.delete(key); }),
  clear: (store) => run(store, 'readwrite', s => { s.clear(); }),
  getMeta: (key) => run('meta', 'readonly', s => s.get(key)),
  setMeta: (key, value) => run('meta', 'readwrite', s => { s.put(value, key); }),
};

// ---------- Hilfen ----------

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));

export function localDay(date = new Date()) {
  const d = new Date(date);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function emitChange() {
  document.dispatchEvent(new CustomEvent('notes-changed'));
}

// ---------- Notizen ----------

export function newNote() {
  const now = new Date();
  return {
    id: uid(),
    text: '',
    images: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    day: localDay(now),
    category: null,
    pinned: false,
    status: 'inbox',
    sort_order: now.getTime(),
    deleted: false,
    dirty: true,
  };
}

export async function saveNote(note, { touch = true } = {}) {
  if (touch) note.updated_at = new Date().toISOString();
  note.dirty = true;
  await db.put('notes', { ...note, images: [...note.images] });
  emitChange();
  return note;
}

export async function listNotes({ includeDeleted = false } = {}) {
  const all = await db.all('notes');
  return all
    .filter(n => includeDeleted || !n.deleted)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function notesOfDay(day) {
  return (await listNotes()).filter(n => n.day === day || n.edited_day === day); // auch heute bearbeitete ältere Notizen
}

export async function deleteNote(note) {
  note.deleted = true;
  await saveNote(note);
  for (const id of note.images) await db.del('images', id);
}

export async function wipeAll() {
  await Promise.all([db.clear('notes'), db.clear('images'), db.clear('meta')]);
  emitChange();
}
