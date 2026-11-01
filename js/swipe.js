// Wischen nach links/rechts auf einer Karte (Touch + Maus), wie in iOS-Mail.
// left  = Aktion beim Wischen nach links  (Hintergrund rechts sichtbar)
// right = Aktion beim Wischen nach rechts (Hintergrund links sichtbar)
import { h } from './ui.js';

const START = 10;        // ab so vielen px gilt es als Wischen
const TRIGGER = 0.35;    // Anteil der Breite, ab dem die Aktion ausgelöst wird

export function swipeable(card, { left, right }) {
  const bgLeft = right ? h('div', { class: `swipe-bg swipe-bg-left ${right.tone || ''}` }, right.label) : null;
  const bgRight = left ? h('div', { class: `swipe-bg swipe-bg-right ${left.tone || ''}` }, left.label) : null;
  const wrap = h('div', { class: 'swipe' }, bgLeft, bgRight, card);

  let start = null;
  let dx = 0;
  let mode = null;       // null | 'swipe' | 'scroll'
  let swiped = false;

  const set = (x, animate) => {
    card.style.transition = animate ? 'transform .22s ease' : 'none';
    card.style.transform = x ? `translateX(${x}px)` : '';
    wrap.dataset.dir = x > 0 ? 'right' : x < 0 ? 'left' : '';
    const armed = Math.abs(x) > wrap.offsetWidth * TRIGGER;
    wrap.classList.toggle('armed', armed);
  };

  card.addEventListener('pointerdown', e => {
    if (e.button > 0 || e.target.closest('button, select, input, .handle')) return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dx = 0; mode = null; swiped = false;
  });

  card.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    const mx = e.clientX - start.x;
    const my = e.clientY - start.y;
    if (!mode) {
      if (Math.abs(mx) > START && Math.abs(mx) > Math.abs(my)) {
        mode = 'swipe';
        card.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > START) {
        mode = 'scroll';
      }
    }
    if (mode !== 'swipe') return;
    e.preventDefault();
    dx = mx;
    if ((dx > 0 && !right) || (dx < 0 && !left)) dx /= 4; // Widerstand, wenn keine Aktion
    set(dx, false);
  });

  const end = async e => {
    if (!start || (e.pointerId !== undefined && e.pointerId !== start.id)) return;
    const wasSwipe = mode === 'swipe';
    start = null; mode = null;
    if (!wasSwipe) return;
    swiped = true;
    const action = dx > 0 ? right : left;
    if (action && Math.abs(dx) > wrap.offsetWidth * TRIGGER) {
      set(Math.sign(dx) * wrap.offsetWidth, true);
      wrap.style.transition = 'height .22s ease .18s, opacity .22s ease .18s';
      wrap.style.height = `${wrap.offsetHeight}px`;
      requestAnimationFrame(() => { wrap.style.height = '0px'; wrap.style.opacity = '0'; });
      setTimeout(() => action.run(), 400);
    } else {
      set(0, true);
    }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);

  // Nach einem Wisch kein „Antippen“ auslösen
  card.addEventListener('click', e => {
    if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; }
  }, true);

  return wrap;
}
