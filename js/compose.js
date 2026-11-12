// Schreibhilfen im Editor: automatische Listen und #Kategorie-Vorschläge.
import { listNotes } from './db.js';
import { settings } from './settings.js';
import { h } from './ui.js';
import { normTag, extractTags } from './tags.js';

// ---------- Listen ----------

// Enter in einer Listenzeile → nächster Punkt; Enter in leerem Punkt → Liste beenden.
export function continueList(t) {
  const pos = t.selectionStart;
  if (pos !== t.selectionEnd) return false;
  const v = t.value;
  const lineStart = v.lastIndexOf('\n', pos - 1) + 1;
  const line = v.slice(lineStart, pos);
  let m, next, content;
  if ((m = line.match(/^(\s*)[○✓] ?(.*)$/))) { next = `${m[1]}○ `; content = m[2]; }       // Todo-Liste
  else if ((m = line.match(/^(\s*)([-•*]) \[[ xX]\] ?(.*)$/))) { next = `${m[1]}${m[2]} [ ] `; content = m[3]; }
  else if ((m = line.match(/^(\s*)([-•*]) (.*)$/))) { next = `${m[1]}${m[2]} `; content = m[3]; }
  else if ((m = line.match(/^(\s*)(\d{1,3})([.)]) (.*)$/))) { next = `${m[1]}${Number(m[2]) + 1}${m[3]} `; content = m[4]; }
  else return false;

  if (!content.trim()) t.setRangeText('', lineStart, pos, 'end');      // leerer Punkt: Liste beenden
  else t.setRangeText('\n' + next, pos, pos, 'end');
  t.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// ---------- #Vorschläge ----------

let pool = null;               // gecachte Tags aus allen Notizen
document.addEventListener('notes-changed', () => { pool = null; });

async function knownTags() {
  if (!pool) {
    const counts = new Map();
    for (const n of await listNotes()) for (const t of extractTags(n.text || '')) counts.set(t, (counts.get(t) || 0) + 1); // aus dem Text: auch alte/synchronisierte Notizen ohne gespeicherte Tags
    pool = [...counts].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }
  return pool;
}

function currentQuery(t) {
  if (t.selectionStart !== t.selectionEnd) return null;
  const before = t.value.slice(0, t.selectionStart);
  const m = before.match(/(^|\s)#([\p{L}\p{N}_-]*)$/u);
  return m ? m[2] : null;
}

export function initSuggest(t) {
  const bar = document.getElementById('suggest');
  let shown = [];

  const close = () => { bar.hidden = true; bar.replaceChildren(); shown = []; };

  const pick = name => {
    const q = currentQuery(t);
    if (q == null) return close();
    const pos = t.selectionStart;
    const tag = name.toLowerCase().replace(/\s+/g, '');
    t.setRangeText(`#${tag} `, pos - q.length - 1, pos, 'end');
    t.dispatchEvent(new Event('input', { bubbles: true }));
    close();
  };

  const update = async () => {
    const q = currentQuery(t);
    if (q == null || document.activeElement !== t) return close();
    const nq = normTag(q);
    const cats = settings().categories.filter(c => normTag(c).startsWith(nq));
    const catKeys = new Set(cats.map(normTag));
    const tags = (await knownTags()).filter(x => normTag(x).startsWith(nq) && !catKeys.has(normTag(x)) && normTag(x) !== nq);
    const items = [...cats.map(c => ({ name: c, cat: true })), ...tags.map(x => ({ name: x, cat: false }))].slice(0, 6);
    if (!items.length || (items.length === 1 && normTag(items[0].name) === nq && q.length > 0 && !items[0].cat)) return close();
    shown = items;
    bar.replaceChildren(...items.map(it => h('button', {
      type: 'button', class: 'suggest-chip' + (it.cat ? ' cat' : ''),
      onpointerdown: e => e.preventDefault(),        // Tastatur offen lassen
      onclick: () => { pick(it.name); t.focus({ preventScroll: true }); },
    }, `#${it.name}`)));
    bar.hidden = false;
  };

  t.addEventListener('input', update);
  t.addEventListener('blur', () => setTimeout(close, 150));
  document.addEventListener('selectionchange', () => { if (document.activeElement === t) update(); });
  t.addEventListener('keydown', e => {
    if (bar.hidden) return;
    if (e.key === 'Escape') { close(); e.preventDefault(); }
    if (e.key === 'Tab' && shown.length) { e.preventDefault(); pick(shown[0].name); }
  });
  return { close, isOpen: () => !bar.hidden, first: () => shown[0]?.name, pick };
}
