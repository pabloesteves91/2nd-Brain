// Kurze Bilder-Einführung beim ersten Start (und jederzeit über die Einstellungen).
import { h } from './ui.js';
import { setSetting } from './settings.js';
import { focusEditor } from './editor.js';

const SLIDES = [
  ['01.jpg', 'Öffnen. Schreiben. Schliessen.'],
  ['02.jpg', 'Gedanken mit Bild festhalten'],
  ['03.jpg', 'Tippe # – sortiert nebenbei'],
  ['04.jpg', 'Am Abend in Ruhe sortieren'],
  ['05.jpg', 'Deine Woche – ohne Druck'],
  ['06.jpg', 'Alles wiederfinden'],
];

export function showOnboarding() {
  if (document.querySelector('.onboarding')) return;
  document.activeElement?.blur();
  const track = h('div', { class: 'ob-track' },
    SLIDES.map(([src, alt]) => h('div', { class: 'ob-slide' }, h('img', { src: `onboarding/${src}`, alt, draggable: false }))));
  const dots = h('div', { class: 'ob-dots', 'aria-hidden': 'true' }, SLIDES.map(() => h('i')));
  const next = h('button', { type: 'button', class: 'primary ob-next' }, 'Weiter');
  const el = h('div', { class: 'onboarding', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Einführung' },
    h('button', { type: 'button', class: 'ob-skip', onclick: () => done() }, 'Überspringen'),
    track, dots, next);

  const index = () => Math.round(track.scrollLeft / track.clientWidth);
  const update = () => {
    const i = index();
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    next.textContent = i === SLIDES.length - 1 ? 'Los geht’s' : 'Weiter';
  };
  const done = () => { el.remove(); setSetting('onboarded', true); focusEditor(); };

  track.addEventListener('scroll', update, { passive: true });
  next.addEventListener('click', () => {
    const i = index();
    if (i >= SLIDES.length - 1) done();
    else track.scrollTo({ left: (i + 1) * track.clientWidth, behavior: 'smooth' });
  });
  document.body.append(el);
  update();
}
