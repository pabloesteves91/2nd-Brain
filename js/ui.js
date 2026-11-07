// Mini-Helfer zum Bauen von DOM ohne innerHTML (kein XSS über Notiztext).
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const timeFmt = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' });

export const fmtTime = iso => timeFmt.format(new Date(iso));

export function fmtDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - date) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  return dayFmt.format(date);
}

export function shiftDay(day, delta) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

let statusTimer;
export function flash(text) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.remove('show'), 1200);
}

// Kurzer Hinweis unten mit optionaler Aktion (z. B. „Rückgängig“).
let toastEl, toastTimer, toastDone;
export function toast(text, actionLabel, onAction, onExpire) {
  if (toastDone) { const d = toastDone; toastDone = null; d(); }
  toastEl?.remove();
  clearTimeout(toastTimer);
  const finish = () => { toastEl?.classList.remove('show'); const el = toastEl; setTimeout(() => el?.remove(), 250); };
  toastEl = h('div', { class: 'toast', role: 'status' }, h('span', {}, text),
    actionLabel ? h('button', {
      type: 'button',
      onclick: () => { clearTimeout(toastTimer); toastDone = null; finish(); onAction?.(); },
    }, actionLabel) : null);
  document.body.append(toastEl);
  requestAnimationFrame(() => toastEl.classList.add('show'));
  toastDone = onExpire || null;
  toastTimer = setTimeout(() => { const d = toastDone; toastDone = null; finish(); d?.(); }, 4500);
}

// ---------- Bild gross anzeigen ----------

// Antippen/Klicken/Esc schliesst; mit onDelete gibt es unten „löschen“.
export function viewImage(src, onDelete) {
  const close = () => { view.remove(); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const view = h('div', { class: 'imgview', role: 'dialog', 'aria-label': 'Bild', onclick: close },
    h('img', { src, alt: '' }),
    h('div', { class: 'imgview-bar' },
      h('button', { type: 'button', onclick: close }, 'schliessen'),
      onDelete ? h('button', { type: 'button', class: 'danger', onclick: e => { e.stopPropagation(); close(); onDelete(); } }, 'löschen') : null));
  document.addEventListener('keydown', onKey, true);
  document.activeElement?.blur();
  document.body.append(view);
}

// ---------- Links ----------

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']*[^\s<>"'.,;:!?)\]}»“”]/gi;

export function findLinks(text) {
  return [...new Set((text.match(URL_RE) || []))];
}

export const hrefOf = url => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

export function shortUrl(url) {
  try {
    const u = new URL(hrefOf(url));
    const path = (u.pathname + u.search).replace(/\/$/, '');
    const short = u.hostname.replace(/^www\./, '') + (path.length > 22 ? path.slice(0, 20) + '…' : path);
    return short;
  } catch { return url; }
}

export function linkEl(url, text = url) {
  return h('a', {
    href: hrefOf(url), target: '_blank', rel: 'noopener noreferrer', class: 'note-link',
    onclick: e => e.stopPropagation(),     // nicht gleichzeitig die Notiz öffnen
    onpointerdown: e => e.stopPropagation(),
  }, text);
}

// Text mit klickbaren Links (ohne innerHTML).
export function linkify(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(linkEl(m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
