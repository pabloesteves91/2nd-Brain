// #Hashtags im Text erkennen und als Kategorie übernehmen.
import { settings, setSetting } from './settings.js';

const TAG = /(^|[\s(])#([\p{L}\p{N}_-]{2,})/gu;

// Für Vergleiche: Gross/klein, Leerzeichen und Bindestriche egal („Mein Projekt“ = #meinprojekt).
export const normTag = s => s.toLowerCase().replace(/[\s_-]+/g, '');

export function extractTags(text) {
  const out = [];
  for (const m of text.matchAll(TAG)) {
    const t = m[2].toLowerCase();
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

// Setzt note.tags und – falls ein Tag zu einer Kategorie passt – note.category.
export function applyTags(note) {
  const tags = extractTags(note.text);
  note.tags = tags;
  if (!tags.length) return;
  const s = settings();
  const cats = s.categories;
  const match = tags.map(t => cats.find(c => normTag(c) === normTag(t))).find(Boolean);
  if (match) {
    if (note.category !== match) { note.category = match; note.status = note.status === 'archived' ? 'archived' : 'sorted'; }
    return;
  }
  if (s.tagsAsCategory && !note.category) {
    const raw = note.text.match(new RegExp(`#(${tags[0]})`, 'iu'))?.[1] || tags[0];
    const name = raw.charAt(0).toUpperCase() + raw.slice(1);
    setSetting('categories', [...cats, name]);
    note.category = name;
    if (note.status === 'inbox') note.status = 'sorted';
  }
}

// Kategorie in die eigene Liste aufnehmen, falls sie fehlt (gleiche Schreibweise-Regeln wie bei #Tags).
export function ensureCategory(name) {
  if (!name) return null;
  const cats = settings().categories;
  const found = cats.find(c => normTag(c) === normTag(name));
  if (found) return found;
  setSetting('categories', [...cats, name]);
  return name;
}

// Kategorien, die an Notizen hängen, aber in der Liste fehlen (Sync, Neuinstallation, ältere Version) → übernehmen.
export function adoptCategories(notes) {
  for (const n of notes) if (!n.deleted && n.category) ensureCategory(n.category);
}

// Ein Wort mit grossem Anfangsbuchstaben, so wie es im Text steht („#Meinprojekt“ → „Meinprojekt“).
export function tagLabel(text, tag) {
  const raw = text.match(new RegExp(`#(${tag})`, 'iu'))?.[1] || tag;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
