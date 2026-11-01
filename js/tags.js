// #Hashtags im Text erkennen und als Kategorie übernehmen.
import { settings, setSetting } from './settings.js';

const TAG = /(^|[\s(])#([\p{L}\p{N}_-]{2,})/gu;

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
  const match = tags.map(t => cats.find(c => c.toLowerCase() === t)).find(Boolean);
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
