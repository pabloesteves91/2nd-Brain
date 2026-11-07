const KEY = 'sb.settings';

export const DEFAULTS = {
  font: 'sans',          // sans | serif | mono
  size: 19,              // px
  theme: 'system',       // system | light | dark
  freshAfterMin: 5,      // nach so vielen Minuten im Hintergrund: leeres Blatt
  reminder: true,        // Abend-Hinweis für den Rückblick
  reviewTime: '20:00',
  categories: ['Idee', 'Aufgabe', 'Projekt', 'Persönlich'],
  tagsAsCategory: false, // neue #Tags automatisch als Kategorie anlegen
  faceId: false,         // App mit Face ID sperren (nur iOS)
  weekly: true,          // Wochenrückblick-Mitteilung am Sonntag
  weeklyTime: '18:00',
  rediscover: true,      // im Rückblick alte Gedanken wiederentdecken
  onboarded: false,      // Einführung schon gesehen
};

let current = load();

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = () => current;

export function setSetting(key, value) {
  current = { ...current, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* privat-modus */ }
  apply();
}

export function apply() {
  const root = document.documentElement;
  root.dataset.font = current.font;
  if (current.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = current.theme;
  root.style.setProperty('--fs', `${current.size / 17}rem`); // rem: folgt der iOS-Textgrösse
  document.dispatchEvent(new CustomEvent('settings-changed'));
}
