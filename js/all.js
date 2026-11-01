import { listNotes, saveNote } from './db.js';
import { imageUrl } from './images.js';
import { settings } from './settings.js';
import { h, fmtTime, fmtDay } from './ui.js';
import { swipeNote } from './swipe.js';
import { reminderControl } from './tasks.js';

let state = { q: '', cat: null, archived: false };

export function openAll(container) {
  state = { ...state, q: '' };
  const search = h('input', {
    class: 'search', type: 'search', placeholder: 'Suchen …', value: state.q,
    oninput: e => { state.q = e.target.value; renderList(); },
  });
  const chips = h('div', { class: 'chips' });
  const list = h('div');

  const renderChips = () => {
    chips.replaceChildren(
      ...[null, ...settings().categories].map(c => h('button', {
        type: 'button', class: 'chip' + (state.cat === c ? ' on' : ''),
        onclick: () => { state.cat = c; renderChips(); renderList(); },
      }, c ?? 'alle')),
      h('button', {
        type: 'button', class: 'chip' + (state.archived ? ' on' : ''),
        onclick: () => { state.archived = !state.archived; renderChips(); renderList(); },
      }, 'archiv'),
    );
  };

  async function renderList() {
    const q = state.q.trim().toLowerCase();
    const notes = (await listNotes()).filter(n =>
      (state.archived ? n.status === 'archived' : n.status !== 'archived') &&
      (!state.cat || n.category === state.cat) &&
      (!q || n.text.toLowerCase().includes(q) || (n.category || '').toLowerCase().includes(q)));

    if (!notes.length) {
      list.replaceChildren(h('div', { class: 'empty-state' }, q || state.cat || state.archived ? 'Nichts gefunden.' : 'Noch keine Notizen.'));
      return;
    }
    const groups = new Map();
    for (const n of notes) {
      if (!groups.has(n.day)) groups.set(n.day, []);
      groups.get(n.day).push(n);
    }
    list.replaceChildren(...[...groups].map(([day, items]) => [
      h('div', { class: 'day-label' }, fmtDay(day)),
      h('div', { class: 'cards' }, items.map(n => swipeCard(n, container, renderList))),
    ]).flat(), h('p', { class: 'swipe-hint' }, state.archived ? '→ wiederherstellen · ← löschen' : '→ archivieren · ← löschen'));
  }

  container.replaceChildren(
    h('div', { class: 'head' }, h('h2', {}, 'Alle Notizen')),
    search, chips, list,
  );
  renderChips();
  renderList();
}

// Rechts wischen = archivieren (bzw. wiederherstellen), links wischen = löschen.
const swipeCard = (n, container, rerender) => swipeNote(n, card(n, container, rerender), rerender);

function card(n, container, rerender) {
  const thumbs = h('div', { class: 'thumbs' });
  n.images.forEach(async id => {
    const src = await imageUrl(id);
    if (src) thumbs.append(h('div', { class: 'thumb' }, h('img', { src, alt: '' })));
  });
  return h('article', { class: 'card' + (n.status === 'archived' ? ' archived' : '') },
    h('div', { class: 'card-top' },
      h('span', {}, fmtTime(n.created_at)),
      n.pinned ? h('span', {}, '★') : null,
      h('span', { class: 'grow' }),
      n.category ? h('span', {}, n.category) : null,
    ),
    h('div', {
      class: 'card-text' + (n.text.trim() ? '' : ' empty'),
      onclick: () => container.dispatchEvent(new CustomEvent('open-note', { bubbles: true, detail: n.id })),
    }, n.text.trim() || 'Nur Bild'),
    thumbs,
    n.status === 'archived' ? h('div', { class: 'card-actions' },
      h('button', { type: 'button', onclick: async () => { n.status = 'sorted'; await saveNote(n); rerender(); } }, 'wiederherstellen'),
    ) : (reminderControl(n, rerender) ? h('div', { class: 'card-actions' }, reminderControl(n, rerender)) : null),
  );
}
