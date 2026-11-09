// Kurze Bilder-Einführung beim ersten Start (und jederzeit über die Einstellungen).
import { h, updateInert, reducedMotion } from './ui.js';
import { setSetting } from './settings.js';
import { focusEditor } from './editor.js';
import { t, isEn } from './i18n.js';

const SLIDES = [
  { img: '01.jpg', title: 'Öffnen. Schreiben. Schliessen.', points: [
    'Beim Öffnen wartet ein leeres Blatt – einfach lostippen.',
    'Alles wird automatisch gespeichert.',
    'Nach 5 Minuten im Hintergrund gibt es wieder ein leeres Blatt (unter ··· einstellbar).'] },
  { img: '02.jpg', title: 'Weglegen, Bilder, Listen', points: [
    'Im Schreibfeld nach unten ziehen oder „neu“ tippen – die Notiz ist weggelegt.',
    '„bild“ hängt Fotos aus Kamera oder Mediathek an.',
    'Zeile mit „-“ oder „1.“ beginnen – Enter setzt die Liste fort.',
    '„todo“ startet eine Liste zum Abhaken – zweimal Enter beendet sie.'] },
  { img: '03.jpg', title: '#Kategorien beim Schreiben', points: [
    '# tippen und einen Vorschlag antippen – die Notiz ist einsortiert.',
    'Eigene Kategorien legst du unter ··· an.',
    'Links im Text kannst du antippen.'] },
  { img: '04.jpg', title: 'Am Abend: heute', points: [
    'Unter „heute“ siehst du alle Gedanken des Tages.',
    'Kategorie wählen, pinnen, mit ⋮⋮ umsortieren.',
    'Nach rechts wischen = archivieren, nach links = löschen (mit Rückgängig).'] },
  { img: '05.jpg', title: 'Aufgaben & Erinnerungen', points: [
    'Mit #aufgabe wird eine Notiz zur Aufgabe.',
    'In „heute“ auf „erinnern“ tippen und Zeit wählen.',
    'Zur Zeit kommt eine Mitteilung – antippen öffnet die Notiz.'] },
  { img: '06.jpg', title: 'Deine Woche', points: [
    '„heute“ → „Woche“ zeigt Themen, Kategorien und gepinnte Ideen.',
    'Einen Tagespunkt antippen springt zu diesem Tag.',
    'Im Rückblick tauchen ab und zu alte Gedanken wieder auf.'] },
  { img: '07.jpg', title: 'Alles wiederfinden', points: [
    'Unter „alle“ suchst du in allen Notizen.',
    'Nach Kategorie filtern oder das Archiv öffnen.',
    'Im Archiv nach rechts wischen = wiederherstellen.'] },
  { title: 'Immer griffbereit', points: [
    '▢  Widget auf Home- und Sperrbildschirm',
    '↗  Aus anderen Apps: Teilen → 2nd Brain',
    '◎  Kurzbefehl „Neuer Gedanke“ für Siri und Action-Button',
    '◉  Face ID und Sync zwischen Geräten unter ···',
    '?  Diese Einführung findest du unter ··· → Hilfe.'] },
];

export function showOnboarding() {
  if (document.querySelector('.onboarding')) return;
  document.activeElement?.blur();
  const track = h('div', { class: 'ob-track' },
    SLIDES.map(({ img, title, points }) => h('div', { class: 'ob-slide' + (img ? '' : ' ob-text') },
      img ? h('img', { src: `onboarding/${isEn() ? 'en/' : ''}${img}`, alt: t('Bildschirm: {title}', { title: t(title) }), draggable: false }) : null,
      h('h2', {}, t(title)),
      h('ul', {}, points.map(p => h('li', {}, t(p)))))));
  const dots = h('div', { class: 'ob-dots', 'aria-hidden': 'true' }, SLIDES.map(() => h('i')));
  const next = h('button', { type: 'button', class: 'primary ob-next' }, t('Weiter'));
  const el = h('div', { class: 'onboarding', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('Einführung') },
    h('button', { type: 'button', class: 'ob-skip', onclick: () => done() }, t('Überspringen')),
    track, dots, next);

  const index = () => Math.round(track.scrollLeft / track.clientWidth);
  const update = () => {
    const i = index();
    [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    next.textContent = i === SLIDES.length - 1 ? t('Los geht’s') : t('Weiter');
  };
  const done = () => { el.remove(); updateInert(); setSetting('onboarded', true); focusEditor(); document.dispatchEvent(new CustomEvent('onboarding-done')); };

  track.addEventListener('scroll', update, { passive: true });
  next.addEventListener('click', () => {
    const i = index();
    if (i >= SLIDES.length - 1) done();
    else track.scrollTo({ left: (i + 1) * track.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
  document.body.append(el);
  updateInert();
  el.tabIndex = -1;
  el.focus({ preventScroll: true });
  update();
}
