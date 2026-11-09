// Erinnerungen für Aufgaben: Datum/Uhrzeit an einer Notiz, native Mitteilung in der iOS-App.
import { saveNote } from './db.js';
import { scheduleTask } from './native.js';
import { h } from './ui.js';
import { t, locale } from './i18n.js';

const fmt = { format: d => new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d) };

const TASK_TAGS = ['aufgabe', 'aufgaben', 'task', 'tasks', 'todo'];
// Auch wenn ein anderes #Tag die Kategorie bestimmt (z. B. „#app #aufgabe“) bleibt es eine Aufgabe.
export const isTask = n => n.category === 'Aufgabe' || n.category === 'Task' || !!n.remind_at || (n.tags || []).some(x => TASK_TAGS.includes(x));

function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000);
  if (!iso) d.setMinutes(0, 0, 0);
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function setReminder(n, iso) {
  n.remind_at = iso || null;
  await saveNote(n);
  await scheduleTask(n);
}

// Kleines Bedienelement für die Kartenleiste.
export function reminderControl(n, rerender) {
  if (!isTask(n)) return null;
  // iOS meldet „change“ schon bei jedem Drehen am Rad. Neu zeichnen würde die Auswahl schliessen,
  // deshalb erst speichern, wenn die Auswahl zu ist (blur).
  let picked = null;
  const isDue = n.remind_at && new Date(n.remind_at) <= new Date();
  const text = h('span', {}, n.remind_at ? `⏰ ${fmt.format(new Date(n.remind_at))}${isDue ? ` · ${t('fällig')}` : ''}` : t('erinnern'));
  const commit = async () => {
    if (!picked) return;
    const iso = picked; picked = null;
    await setReminder(n, iso);
    rerender();
  };
  const input = h('input', {
    type: 'datetime-local', class: 'remind-input', value: toLocalInput(n.remind_at),
    'aria-label': t('Erinnerung'),
    onchange: e => {
      if (!e.target.value) return;
      picked = new Date(e.target.value).toISOString();
      text.textContent = `⏰ ${fmt.format(new Date(picked))}`;
      if (document.activeElement !== e.target) commit(); // Desktop: Auswahl schon geschlossen
    },
    onblur: commit,
  });
  const due = n.remind_at && new Date(n.remind_at) <= new Date();
  return h('span', { class: 'remind' + (n.remind_at ? ' on' : '') + (due ? ' due' : '') },
    h('label', { class: 'remind-label' }, text, input),
    n.remind_at ? h('button', {
      type: 'button', 'aria-label': t('Erinnerung entfernen'),
      onclick: async () => { await setReminder(n, null); rerender(); },
    }, '×') : null,
  );
}
