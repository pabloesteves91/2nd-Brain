// Erinnerungen für Aufgaben: Datum/Uhrzeit an einer Notiz, native Mitteilung in der iOS-App.
import { saveNote } from './db.js';
import { scheduleTask } from './native.js';
import { h } from './ui.js';

const fmt = new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const isTask = n => n.category === 'Aufgabe' || !!n.remind_at;

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
  const input = h('input', {
    type: 'datetime-local', class: 'remind-input', value: toLocalInput(n.remind_at),
    'aria-label': 'Erinnerung',
    onchange: async e => {
      if (!e.target.value) return;
      await setReminder(n, new Date(e.target.value).toISOString());
      rerender();
    },
  });
  const due = n.remind_at && new Date(n.remind_at) <= new Date();
  const label = n.remind_at ? `⏰ ${fmt.format(new Date(n.remind_at))}` : 'erinnern';
  return h('span', { class: 'remind' + (n.remind_at ? ' on' : '') + (due ? ' due' : '') },
    h('label', { class: 'remind-label' }, label, input),
    n.remind_at ? h('button', {
      type: 'button', 'aria-label': 'Erinnerung entfernen',
      onclick: async () => { await setReminder(n, null); rerender(); },
    }, '×') : null,
  );
}
