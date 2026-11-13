// Mini-Helfer zum Bauen von DOM ohne innerHTML (kein XSS über Notiztext).
import { t, locale } from './i18n.js';
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

const timeFmt = () => new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' });
const dayFmt = () => new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

export const fmtTime = iso => timeFmt().format(new Date(iso));

export function fmtDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - date) / 86400000);
  if (diff === 0) return t('Heute');
  if (diff === 1) return t('Gestern');
  return dayFmt().format(date);
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

// ---------- Bedienungshilfen ----------

// Nur die oberste Ebene ist für VoiceOver/Tastatur erreichbar, alles dahinter ist inert.
// Nach jedem Öffnen/Schliessen einer Ebene aufrufen.
const LAYERS = ['#lock:not([hidden])', '.confirm', '.onboarding', '.imgview', '#overlay:not([hidden])'];
export function updateInert() {
  const top = LAYERS.map(s => document.querySelector(s)).find(Boolean);
  for (const el of document.body.children) el.inert = !!top && el !== top && !el.classList.contains('toast') && !el.classList.contains('pick');
}

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Vorschaubild, das per Tippen/Enter/VoiceOver gross aufgeht.
export function thumbImg(src, onDelete) {
  const open = e => { e.stopPropagation(); viewImage(src, onDelete); };
  return h('img', { src, alt: t('Bild'), role: 'button', tabindex: '0', 'aria-label': t('Bild öffnen'), onclick: open,
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } } });
}

// Kleines Auswahlmenü an einem Knopf: items = [[Beschriftung, Aktion], …]
export function popMenu(anchor, items) {
  document.querySelector('.pick')?.remove();
  const close = () => { pop.remove(); document.removeEventListener('pointerdown', outside, true); };
  const outside = e => { if (!pop.contains(e.target)) close(); };
  const pop = h('div', { class: 'pick', role: 'menu' },
    items.map(([label, run]) => h('button', { type: 'button', role: 'menuitem', onclick: () => { close(); run(); } }, label)));
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.min(Math.max(r.left + r.width / 2, 100), innerWidth - 100)}px`;
  if (r.top > 150) pop.style.bottom = `${innerHeight - r.top + 4}px`; else pop.style.top = `${r.bottom + 4}px`;
  document.body.append(pop);
  // breite Einträge: ganz auf dem Bildschirm halten (Mitte = left, siehe .pick translateX(-50%))
  const w = pop.offsetWidth;
  pop.style.left = `${Math.min(Math.max(r.left + r.width / 2, w / 2 + 8), innerWidth - w / 2 - 8)}px`;
  pop.querySelector('button').focus({ preventScroll: true });
  setTimeout(() => document.addEventListener('pointerdown', outside, true));
}

// Eigene Rückfrage statt confirm() – das Systemfenster erscheint in der iOS-App nicht zuverlässig.
// Liefert true nur bei Klick auf den roten Knopf; Abbrechen ist vorausgewählt.
export function askConfirm({ title, text, ok }) {
  return new Promise(resolve => {
    const done = v => { box.remove(); document.removeEventListener('keydown', onKey, true); updateInert(); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    const cancel = h('button', { type: 'button', class: 'confirm-cancel', onclick: () => done(false) }, t('Abbrechen'));
    const box = h('div', { class: 'confirm', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-t', 'aria-describedby': 'confirm-d' },
      h('div', { class: 'confirm-card' },
        h('h2', { id: 'confirm-t' }, title),
        h('p', { id: 'confirm-d' }, text),
        h('div', { class: 'confirm-actions' }, cancel,
          h('button', { type: 'button', class: 'confirm-ok', onclick: () => done(true) }, ok))));
    document.addEventListener('keydown', onKey, true);
    document.activeElement?.blur();
    document.body.append(box);
    updateInert();
    cancel.focus({ preventScroll: true });
  });
}

// ---------- Bild gross anzeigen ----------

// App: in die Fotos-App; Browser/ältere App: als Datei herunterladen.
async function saveImage(src) {
  const { canSaveToPhotos, saveToPhotos } = await import('./native.js');
  const blob = await (await fetch(src)).blob();
  if (canSaveToPhotos()) {
    try {
      await saveToPhotos(await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); }));
      toast(t('In Fotos gesichert'));
    } catch (err) { toast(err?.message || t('Sichern fehlgeschlagen')); }
    return;
  }
  const a = h('a', { href: src, download: `2nd-brain-${Date.now()}.jpg` });
  document.body.append(a); a.click(); a.remove();
}

// Antippen/Klicken/Esc schliesst; mit onDelete gibt es unten „löschen“.
// Zoomen: zwei Finger, Doppeltippen, Trackpad-Pinch (⌃/⌘ + Scrollrad); gezoomt mit einem Finger verschieben.
export function viewImage(src, onDelete) {
  const img = h('img', { src, alt: t('Bild'), draggable: false });
  let z = 1, x = 0, y = 0, base = null, moved = false, lastTap = 0, tapTimer;
  const pts = new Map();
  const apply = (anim) => {
    img.style.transition = anim ? 'transform .2s ease' : 'none';
    img.style.transform = `translate(${x}px, ${y}px) scale(${z})`;
  };
  const reset = () => { z = 1; x = 0; y = 0; apply(true); };
  const snap = () => { // Ausgangslage, wenn ein Finger dazukommt oder weggeht
    const [a, b] = [...pts.values()];
    base = { z, x, y, a: { ...a }, d: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0, m: b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a };
  };
  const opener = document.activeElement;
  const close = () => { clearTimeout(tapTimer); view.remove(); updateInert(); document.removeEventListener('keydown', onKey, true); opener?.focus?.({ preventScroll: true }); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const view = h('div', { class: 'imgview', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('Bild') },
    img,
    h('div', { class: 'imgview-bar' },
      h('button', { type: 'button', onclick: () => close() }, t('schliessen')),
      h('button', { type: 'button', onclick: () => saveImage(src) }, t('sichern')),
      onDelete ? h('button', { type: 'button', class: 'danger', onclick: () => { close(); onDelete(); } }, t('löschen')) : null));

  view.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    try { view.setPointerCapture(e.pointerId); } catch { /* egal */ }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) moved = false;
    snap();
  });
  view.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pts.values()];
    if (b && base.d) {
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      z = Math.min(5, Math.max(1, base.z * Math.hypot(a.x - b.x, a.y - b.y) / base.d));
      x = base.x + m.x - base.m.x; y = base.y + m.y - base.m.y;
      moved = true;
    } else if (Math.hypot(a.x - base.a.x, a.y - base.a.y) > 8 || moved) {
      moved = true;
      if (z > 1) { x = base.x + a.x - base.a.x; y = base.y + a.y - base.a.y; }
    }
    apply(false);
  });
  const up = e => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size) { snap(); return; }
    if (z <= 1.02) reset();
    if (moved || e.type === 'pointercancel') return;
    // Doppeltippen zoomt, einfaches Tippen schliesst (nur ungezoomt)
    if (Date.now() - lastTap < 300) {
      clearTimeout(tapTimer); lastTap = 0;
      if (z > 1) reset(); else { z = 2.5; x = 0; y = 0; apply(true); }
      return;
    }
    lastTap = Date.now();
    tapTimer = setTimeout(() => { if (z === 1) close(); }, 300);
  };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) z = Math.min(5, Math.max(1, z * Math.exp(-e.deltaY / 100)));
    else if (z > 1) { x -= e.deltaX; y -= e.deltaY; } // shortcut: Verschieben ohne Rand-Begrenzung, bei Bedarf an Bildgrösse klemmen
    if (z === 1) { x = 0; y = 0; }
    apply(false);
  }, { passive: false });

  document.addEventListener('keydown', onKey, true);
  document.body.append(view);
  updateInert();
  view.tabIndex = -1;
  view.focus({ preventScroll: true });
}

// ---------- Todo-Zeilen in Karten ----------

const TODO = /^(\s*)([○✓]) ?(.*)$/;

// Notiztext für Karten: Zeilen mit ○/✓ als antippbare Kästchen; save(text) speichert den geänderten Text.
export function noteBody(text, save) {
  const lines = text.split('\n');
  if (!lines.some(l => TODO.test(l))) return linkify(text);
  const todos = lines.filter(l => TODO.test(l));
  const done = todos.filter(l => TODO.exec(l)[2] === '✓').length;
  const out = lines.map((line, i) => {
    const m = TODO.exec(line);
    if (!m) return h('div', { class: 'line' }, line ? linkify(line) : '\u00a0');
    const isDone = m[2] === '✓';
    return h('div', { class: 'todo' + (isDone ? ' done' : '') },
      h('button', {
        type: 'button', class: 'todo-box', 'aria-pressed': String(isDone), 'aria-label': t(isDone ? 'Erledigt' : 'Abhaken'),
        onclick: e => {
          e.stopPropagation();
          lines[i] = `${m[1]}${isDone ? '○' : '✓'} ${m[3]}`;
          save(lines.join('\n'));
        },
      }, isDone ? '✓' : ''),
      h('span', {}, linkify(m[3])));
  });
  if (todos.length > 1) out.push(h('div', { class: 'todo-count' }, t('{d}/{n} erledigt', { d: done, n: todos.length })));
  return out;
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
