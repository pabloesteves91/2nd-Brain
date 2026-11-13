// „Was ist neu“: nach einem Update einmal die Neuerungen zeigen. Neue Nutzer sehen stattdessen die Einführung.
import { APP_VERSION, siteUrl } from './config.js';
import { settings, setSetting } from './settings.js';
import { h, updateInert } from './ui.js';
import { t } from './i18n.js';
import { isAndroid } from './native.js';

const WHATS_NEW = {
  '2.5': [
    'Notizen gemeinsam bearbeiten: Teilen → „Gemeinsam bearbeiten“ und Einladungslink senden',
    'Änderungen der anderen erscheinen sofort',
    'Lange Notizen: die Schreibstelle bleibt über der Tastatur sichtbar',
    'iPad: öffnet im Vollbild',
  ],
  '2.4': [
    'Todo-Listen: im Menü „todo“ – Kreise zum Abhaken',
    'Spracheingabe: „sprechen“ antippen und erzählen',
    'Siri: „Neuer Gedanke in 2nd Brain“ – auch ohne die App zu öffnen',
    'Widget „Schnellaktionen“ für neuen Gedanken, Foto und Heute',
    'Notizen, die du heute ergänzt, stehen im Tagesrückblick',
    'Einstellungen und #Kategorien werden mit synchronisiert',
  ],
};

export const markSeen = () => setSetting('seenVersion', APP_VERSION);

// true, wenn der Dialog gezeigt wurde
export function showWhatsNew() {
  const items = WHATS_NEW[APP_VERSION]?.filter(x => !(isAndroid() && x.startsWith('Siri'))); // Siri nur auf Apple-Geräten
  if (!settings().onboarded || settings().seenVersion === APP_VERSION) return false;
  markSeen();
  if (!items) return false;
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey, true); updateInert(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const ok = h('button', { type: 'button', class: 'confirm-ok whatsnew-ok', onclick: close }, t('OK'));
  const box = h('div', { class: 'confirm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wn-t' },
    h('div', { class: 'confirm-card' },
      h('h2', { id: 'wn-t' }, t('Neu in {v}', { v: APP_VERSION })),
      h('ul', { class: 'whatsnew' }, items.map(x => h('li', {}, t(x)))),
      h('div', { class: 'confirm-actions' },
        h('a', { class: 'confirm-cancel whatsnew-more', href: siteUrl('updates.html'), target: '_blank', rel: 'noopener', onclick: close }, t('Alles ansehen')),
        ok)));
  document.addEventListener('keydown', onKey, true);
  document.activeElement?.blur();
  document.body.append(box);
  updateInert();
  ok.focus({ preventScroll: true });
  return true;
}
