import { db, localDay, notesOfDay, saveNote, deleteNote } from './db.js';
import { imageUrl } from './images.js';
import { settings } from './settings.js';
import { h, fmtTime, fmtDay, shiftDay } from './ui.js';

const STOP = new Set(`aber alle allem allen aller alles also auch auf aus bei beim bin bis bist dann das dass dem den denn der des die dies diese diesem diesen dieser dir doch dort durch ein eine einem einen einer eines etwas euch für gegen hab habe haben hat hatte hier ihr ihre ihm ihn ich ist jetzt kann kein keine man mehr mein meine mich mir mit muss nach nicht noch nur oder ohne schon sehr sein seine sich sie sind so soll über um und uns unser vom von vor war waren was weil wenn werden wie wieder wir wird wo zu zum zur sollte könnte würde mal immer einfach heute morgen dann denke glaube the and for that this with from have are was you not but`.split(/\s+/));

let state = { day: localDay(), sort: 'eigene', filter: null };

export function openReview(container, opts = {}) {
  state = { ...state, day: opts.day ?? localDay(), filter: null };
  return render(container);
}

function keywords(notes) {
  const counts = new Map();
  for (const n of notes) {
    const seen = new Set();
    for (const raw of n.text.toLowerCase().match(/[\p{L}\p{N}#-]{4,}/gu) || []) {
      const w = raw.replace(/^-+|-+$/g, '');
      if (w.length < 4 || STOP.has(w) || seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c > 1 || notes.length <= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([w]) => w);
}

function sortNotes(notes) {
  const pin = (a, b) => (b.pinned - a.pinned);
  if (state.sort === 'zeit') return notes.sort((a, b) => pin(a, b) || a.created_at.localeCompare(b.created_at));
  if (state.sort === 'kategorie') {
    const cats = settings().categories;
    const idx = c => (c == null ? 999 : (cats.indexOf(c) + 1 || 998));
    return notes.sort((a, b) => pin(a, b) || idx(a.category) - idx(b.category) || a.created_at.localeCompare(b.created_at));
  }
  return notes.sort((a, b) => pin(a, b) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

async function render(container) {
  const all = (await notesOfDay(state.day)).filter(n => n.status !== 'archived');
  const withImages = all.filter(n => n.images.length).length;
  const words = keywords(all);
  const byCat = new Map();
  for (const n of all) if (n.category) byCat.set(n.category, (byCat.get(n.category) || 0) + 1);
  const unsorted = all.filter(n => n.status === 'inbox').length;

  let visible = all;
  if (state.filter) visible = all.filter(n => n.text.toLowerCase().includes(state.filter));
  sortNotes(visible);

  const isToday = state.day === localDay();
  const closedDays = (await db.getMeta('closedDays')) || [];

  const summary = all.length === 0 ? null : [
    `${all.length} ${all.length === 1 ? 'Gedanke' : 'Gedanken'}`,
    withImages ? `${withImages} mit ${withImages === 1 ? 'Bild' : 'Bildern'}` : null,
    unsorted ? `${unsorted} unsortiert` : 'alles sortiert',
  ].filter(Boolean).join(' · ');

  const catLine = byCat.size ? [...byCat].map(([c, n]) => `${c} ${n}`).join(' · ') : null;

  const cards = h('div', { class: 'cards' }, visible.map(n => card(n, container)));
  if (state.sort === 'eigene') enableDrag(cards, container);

  container.replaceChildren(...[
    h('div', { class: 'head' },
      h('h2', {}, isToday ? 'Heute' : fmtDay(state.day)),
      h('div', { class: 'nav' },
        h('button', { type: 'button', 'aria-label': 'Vorheriger Tag', onclick: () => { state.day = shiftDay(state.day, -1); state.filter = null; render(container); } }, '‹'),
        h('button', { type: 'button', 'aria-label': 'Nächster Tag', disabled: isToday, onclick: () => { state.day = shiftDay(state.day, 1); state.filter = null; render(container); } }, '›'),
      ),
    ),
    all.length === 0
      ? h('div', { class: 'empty-state' }, isToday ? 'Noch nichts notiert heute.' : 'An diesem Tag gibt es keine Notizen.')
      : [
        h('div', { class: 'summary' }, summary, catLine ? h('br') : null, catLine),
        words.length ? h('div', { class: 'chips' }, words.map(w =>
          h('button', {
            type: 'button', class: 'chip' + (state.filter === w ? ' on' : ''),
            onclick: () => { state.filter = state.filter === w ? null : w; render(container); },
          }, w))) : null,
        h('div', { class: 'toolbar' },
          h('span', {}, 'sortieren'),
          h('div', { class: 'seg' }, ['eigene', 'zeit', 'kategorie'].map(s =>
            h('button', { type: 'button', class: state.sort === s ? 'on' : '', onclick: () => { state.sort = s; render(container); } }, s))),
        ),
        cards,
        h('button', {
          type: 'button', class: 'primary',
          disabled: unsorted === 0 && closedDays.includes(state.day),
          onclick: async () => {
            for (const n of all) if (n.status === 'inbox') { n.status = 'sorted'; await saveNote(n); }
            await db.setMeta('closedDays', [...new Set([...closedDays, state.day])].slice(-60));
            document.getElementById('banner').hidden = true;
            document.dispatchEvent(new CustomEvent('day-closed'));
            render(container);
          },
        }, unsorted === 0 && closedDays.includes(state.day) ? 'Tag abgeschlossen ✓' : 'Tag abschliessen'),
      ],
  ].flat().filter(Boolean));
}

function card(n, container) {
  const cats = settings().categories;
  const select = h('select', {
    class: 'cat' + (n.category ? ' set' : ''), 'aria-label': 'Kategorie',
    onchange: async e => {
      n.category = e.target.value || null;
      n.status = n.category ? 'sorted' : n.status;
      await saveNote(n);
      render(container);
    },
  },
  h('option', { value: '' }, 'Kategorie'),
  [...new Set([...cats, ...(n.category ? [n.category] : [])])].map(c =>
    h('option', { value: c, selected: c === n.category }, c)));

  const thumbs = h('div', { class: 'thumbs' });
  n.images.forEach(async id => {
    const src = await imageUrl(id);
    if (src) thumbs.append(h('div', { class: 'thumb' }, h('img', { src, alt: '' })));
  });

  return h('article', { class: 'card', 'data-id': n.id },
    h('div', { class: 'card-top' },
      h('span', {}, fmtTime(n.created_at)),
      n.pinned ? h('span', {}, '★') : null,
      h('span', { class: 'grow' }),
      select,
      state.sort === 'eigene' ? h('span', { class: 'handle', 'aria-label': 'Verschieben' }, '⋮⋮') : null,
    ),
    h('div', {
      class: 'card-text' + (n.text.trim() ? '' : ' empty'),
      onclick: () => container.dispatchEvent(new CustomEvent('open-note', { bubbles: true, detail: n.id })),
    }, n.text.trim() || 'Nur Bild'),
    thumbs,
    h('div', { class: 'card-actions' },
      h('button', { type: 'button', class: n.pinned ? 'on' : '', onclick: async () => { n.pinned = !n.pinned; await saveNote(n); render(container); } }, n.pinned ? 'gepinnt' : 'pinnen'),
      h('button', { type: 'button', onclick: async () => { n.status = 'archived'; await saveNote(n); render(container); } }, 'archivieren'),
      h('button', { type: 'button', onclick: async () => { if (confirm('Notiz löschen?')) { await deleteNote(n); render(container); } } }, 'löschen'),
    ),
  );
}

// Drag & Drop per Pointer-Events am Griff (funktioniert mit Touch und Maus).
function enableDrag(list, container) {
  list.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.handle');
    if (!handle) return;
    e.preventDefault();
    const item = handle.closest('.card');
    item.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);

    const move = ev => {
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.card');
      if (!over || over === item || over.parentNode !== list) return;
      const r = over.getBoundingClientRect();
      list.insertBefore(item, ev.clientY < r.top + r.height / 2 ? over : over.nextSibling);
    };
    const up = async () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      item.classList.remove('dragging');
      const ids = [...list.children].map(c => c.dataset.id);
      for (const [i, id] of ids.entries()) {
        const n = await db.get('notes', id);
        if (n && n.sort_order !== i) { n.sort_order = i; await saveNote(n); }
      }
      render(container);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}
