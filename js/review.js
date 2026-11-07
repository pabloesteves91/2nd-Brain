import { db, localDay, notesOfDay, saveNote, listNotes } from './db.js';
import { reminderControl } from './tasks.js';
import { swipeNote } from './swipe.js';
import { imageUrl } from './images.js';
import { settings } from './settings.js';
import { h, thumbImg, fmtTime, fmtDay, shiftDay, linkify } from './ui.js';

const STOP = new Set(`aber alle allem allen aller alles also auch auf aus bei beim bin bis bist dann das dass dem den denn der des die dies diese diesem diesen dieser dir doch dort durch ein eine einem einen einer eines etwas euch für gegen hab habe haben hat hatte hier ihr ihre ihm ihn ich ist jetzt kann kein keine man mehr mein meine mich mir mit muss nach nicht noch nur oder ohne schon sehr sein seine sich sie sind so soll über um und uns unser vom von vor war waren was weil wenn werden wie wieder wir wird wo zu zum zur sollte könnte würde mal immer einfach heute morgen dann denke glaube the and for that this with from have are was you not but`.split(/\s+/));

let state = { day: localDay(), sort: 'eigene', filter: null, mode: 'day' };

export function openReview(container, opts = {}) {
  state = { ...state, day: opts.day ?? localDay(), filter: null, mode: opts.mode ?? 'day' };
  return render(container);
}

const matches = (n, f) => f.startsWith('#') ? (n.tags || []).includes(f.slice(1)) : n.text.toLowerCase().includes(f);

function topTags(notes) {
  const c = new Map();
  for (const n of notes) for (const t of n.tags || []) c.set(t, (c.get(t) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => '#' + t);
}

function modeSwitch(container) {
  return h('div', { class: 'seg mode' }, [['day', 'Tag'], ['week', 'Woche']].map(([m, label]) =>
    h('button', { type: 'button', class: state.mode === m ? 'on' : '', onclick: () => { state.mode = m; state.filter = null; render(container); } }, label)));
}

// Stabile „Zufalls“-Zahl pro Tag, damit die wiederentdeckte Notiz nicht bei jedem Öffnen wechselt.
function seed(str) { let x = 0; for (const ch of str) x = (x * 33 + ch.charCodeAt(0)) >>> 0; return x; }

async function rediscover(container) {
  if (!settings().rediscover || state.day !== localDay()) return null;
  const all = await listNotes();
  for (const [days, label] of [[365, 'vor einem Jahr'], [30, 'vor 30 Tagen'], [7, 'vor einer Woche']]) {
    const d = shiftDay(state.day, -days);
    const pool = all.filter(n => n.day === d && (n.text.trim() || n.images.length));
    if (!pool.length) continue;
    const pinned = pool.filter(n => n.pinned);
    const list = pinned.length ? pinned : pool;
    const n = list[seed(state.day) % list.length];
    return h('div', { class: 'rediscover' },
      h('div', { class: 'section-label' }, `Wiederentdecken · ${label}`),
      card(n, container, { compact: true }));
  }
  return null;
}

function keywords(notes) {
  const counts = new Map();
  for (const n of notes) {
    const seen = new Set();
    for (const raw of n.text.toLowerCase().match(/[\p{L}\p{N}#-]{4,}/gu) || []) {
      if (raw.startsWith('#')) continue; // Tags werden separat gezählt
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
  if (state.mode === 'week') return renderWeek(container);
  const all = (await notesOfDay(state.day)).filter(n => n.status !== 'archived');
  const withImages = all.filter(n => n.images.length).length;
  const words = [...topTags(all), ...keywords(all).filter(w => !all.some(n => (n.tags || []).includes(w.replace(/^#/, ''))))].slice(0, 10);
  const byCat = new Map();
  for (const n of all) if (n.category) byCat.set(n.category, (byCat.get(n.category) || 0) + 1);
  const unsorted = all.filter(n => n.status === 'inbox').length;

  let visible = all;
  if (state.filter) visible = all.filter(n => matches(n, state.filter));
  sortNotes(visible);

  const isToday = state.day === localDay();
  const closedDays = (await db.getMeta('closedDays')) || [];

  const summary = all.length === 0 ? null : [
    `${all.length} ${all.length === 1 ? 'Gedanke' : 'Gedanken'}`,
    withImages ? `${withImages} mit ${withImages === 1 ? 'Bild' : 'Bildern'}` : null,
    unsorted ? `${unsorted} unsortiert` : 'alles sortiert',
  ].filter(Boolean).join(' · ');

  const catLine = byCat.size ? [...byCat].map(([c, n]) => `${c} ${n}`).join(' · ') : null;

  const cards = h('div', { class: 'cards' }, visible.map(n => swipeNote(n, card(n, container), () => render(container))));
  if (state.sort === 'eigene') enableDrag(cards, container);

  container.replaceChildren(...[
    h('div', { class: 'head' },
      h('h2', {}, isToday ? 'Heute' : fmtDay(state.day)),
      h('div', { class: 'nav' },
        h('button', { type: 'button', 'aria-label': 'Vorheriger Tag', onclick: () => { state.day = shiftDay(state.day, -1); state.filter = null; render(container); } }, '‹'),
        h('button', { type: 'button', 'aria-label': 'Nächster Tag', disabled: isToday, onclick: () => { state.day = shiftDay(state.day, 1); state.filter = null; render(container); } }, '›'),
      ),
    ),
    modeSwitch(container),
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
        h('p', { class: 'swipe-hint' }, '→ archivieren · ← löschen'),
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
    await rediscover(container),
  ].flat().filter(Boolean));
}

// ---------- Woche ----------

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const rangeFmt = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short' });

function weekStart(day) {
  const [y, m, d] = day.split('-').map(Number);
  const wd = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mo = 0
  return shiftDay(day, -wd);
}

async function renderWeek(container) {
  const start = weekStart(state.day);
  const days = [...Array(7)].map((_, i) => shiftDay(start, i));
  const today = localDay();
  const notes = (await listNotes()).filter(n => days.includes(n.day) && n.status !== 'archived');
  const isThisWeek = days.includes(today);
  const toDate = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); };
  const title = isThisWeek ? 'Diese Woche' : `${rangeFmt.format(toDate(days[0]))} – ${rangeFmt.format(toDate(days[6]))}`;

  const perDay = days.map(d => notes.filter(n => n.day === d));
  const activeDays = perDay.filter(x => x.length).length;
  const unsorted = notes.filter(n => n.status === 'inbox');
  const words = [...topTags(notes), ...keywords(notes)].slice(0, 10);
  const byCat = new Map();
  for (const n of notes) { const c = n.category || 'ohne Kategorie'; byCat.set(c, (byCat.get(c) || 0) + 1); }
  const maxCat = Math.max(1, ...byCat.values());
  const pinned = notes.filter(n => n.pinned);

  const goDay = d => { state.mode = 'day'; state.day = d; state.filter = null; render(container); };

  container.replaceChildren(...[
    h('div', { class: 'head' },
      h('h2', {}, title),
      h('div', { class: 'nav' },
        h('button', { type: 'button', 'aria-label': 'Vorherige Woche', onclick: () => { state.day = shiftDay(start, -7); render(container); } }, '‹'),
        h('button', { type: 'button', 'aria-label': 'Nächste Woche', disabled: isThisWeek, onclick: () => { state.day = shiftDay(start, 7); render(container); } }, '›'),
      ),
    ),
    modeSwitch(container),
    notes.length === 0
      ? h('div', { class: 'empty-state' }, 'In dieser Woche gibt es keine Notizen.')
      : [
        h('div', { class: 'summary' },
          `${notes.length} ${notes.length === 1 ? 'Gedanke' : 'Gedanken'} an ${activeDays} ${activeDays === 1 ? 'Tag' : 'Tagen'}`,
          unsorted.length ? ` · ${unsorted.length} unsortiert` : ' · alles sortiert'),
        h('div', { class: 'week-days' }, days.map((d, i) => h('button', {
          type: 'button',
          class: 'week-day' + (perDay[i].length ? ' has' : '') + (perDay[i].some(n => n.status === 'inbox') ? ' open' : '') + (d === today ? ' today' : ''),
          onclick: () => goDay(d),
          'aria-label': `${DAY_NAMES[i]}: ${perDay[i].length} Notizen${perDay[i].some(n => n.status === 'inbox') ? ', unsortierte dabei' : ''}`,
        }, h('span', {}, DAY_NAMES[i]), h('span', { class: 'dot' }, perDay[i].length || '')))),
        words.length ? [h('div', { class: 'section-label' }, 'Themen'), h('div', { class: 'chips' }, words.map(w => h('span', { class: 'chip' }, w)))] : null,
        h('div', { class: 'section-label' }, 'Kategorien'),
        h('div', { class: 'bars' }, [...byCat].sort((a, b) => b[1] - a[1]).map(([c, n]) =>
          h('div', { class: 'bar' }, h('span', {}, c), h('i', { style: `width:${Math.round(n / maxCat * 100)}%` }), h('span', {}, n)))),
        pinned.length ? [
          h('div', { class: 'section-label' }, 'Gepinnt'),
          h('div', { class: 'cards' }, pinned.map(n => card(n, container, { compact: true }))),
        ] : null,
        unsorted.length ? h('button', {
          type: 'button', class: 'primary',
          onclick: () => goDay(unsorted.map(n => n.day).sort()[0]),
        }, `${unsorted.length} unsortierte ansehen`) : null,
      ],
  ].flat(2).filter(Boolean));
}

function card(n, container, { compact = false } = {}) {
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
    if (src) thumbs.append(h('div', { class: 'thumb' }, thumbImg(src)));
  });

  return h('article', { class: 'card', 'data-id': n.id },
    h('div', { class: 'card-top' },
      h('span', {}, compact ? `${fmtDay(n.day)} · ${fmtTime(n.created_at)}` : fmtTime(n.created_at)),
      n.pinned ? h('span', {}, '★') : null,
      h('span', { class: 'grow' }),
      compact ? (n.category ? h('span', {}, n.category) : null) : select,
      !compact && state.sort === 'eigene' ? h('span', { class: 'handle', 'aria-label': 'Verschieben' }, '⋮⋮') : null,
    ),
    h('div', {
      class: 'card-text' + (n.text.trim() ? '' : ' empty'),
      onclick: () => container.dispatchEvent(new CustomEvent('open-note', { bubbles: true, detail: n.id })),
    }, n.text.trim() ? linkify(n.text.trim()) : 'Nur Bild'),
    thumbs,
    compact ? null : h('div', { class: 'card-actions' },
      h('button', { type: 'button', class: n.pinned ? 'on' : '', onclick: async () => { n.pinned = !n.pinned; await saveNote(n); render(container); } }, n.pinned ? 'gepinnt' : 'pinnen'),
      reminderControl(n, () => render(container)),
    ),
  );
}

// Drag & Drop per Pointer-Events am Griff (funktioniert mit Touch und Maus).
// Bewegung wird am window verfolgt – so geht nichts verloren, wenn die Karte im DOM verschoben wird.
function enableDrag(list, container) {
  list.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.handle');
    if (!handle) return;
    e.preventDefault();
    const item = handle.closest('.swipe');
    const pid = e.pointerId;
    item.classList.add('dragging');

    const move = ev => {
      if (ev.pointerId !== pid) return;
      ev.preventDefault();
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.swipe');
      if (!over || over === item || over.parentNode !== list) return;
      const r = over.getBoundingClientRect();
      list.insertBefore(item, ev.clientY < r.top + r.height / 2 ? over : over.nextSibling);
    };
    const up = async ev => {
      if (ev.pointerId !== pid) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      item.classList.remove('dragging');
      const ids = [...list.children].map(c => c.dataset.id);
      for (const [i, id] of ids.entries()) {
        const n = await db.get('notes', id);
        if (n && n.sort_order !== i) { n.sort_order = i; await saveNote(n); }
      }
      render(container);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}
