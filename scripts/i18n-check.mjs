// Prüft, dass jeder Text in t('…') / tr('…') und jedes data-t in index.html eine englische Übersetzung hat.
// Aufruf: node scripts/i18n-check.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { EN } from '../js/i18n.js';

const keys = new Set();
for (const f of readdirSync('js').filter(f => f.endsWith('.js') && f !== 'i18n.js')) {
  const s = readFileSync(`js/${f}`, 'utf8');
  for (const m of s.matchAll(/\b(?:t|tr)\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"));
  // Arrays/Objekte, die erst später durch t() laufen (Einführung, Wochentage, seg-Beschriftungen)
  if (f === 'onboarding.js') for (const m of s.matchAll(/(?:title: |^\s+)'([^']{3,})'/gm)) keys.add(m[1]);
}
const html = readFileSync('index.html', 'utf8');
for (const m of html.matchAll(/data-t>([^<]+)</g)) keys.add(m[1].trim());
for (const m of html.matchAll(/(placeholder|aria-label)="([^"]+)"[^>]*data-t-attr/g)) keys.add(m[2]);
for (const d of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So', 'eigene', 'zeit', 'kategorie', 'Deutsch', 'English']) keys.add(d);

const missing = [...keys].filter(k => !(k in EN) && !['Deutsch', 'English', '2nd Brain'].includes(k));
if (missing.length) { console.error('Fehlende englische Texte:\n  ' + missing.join('\n  ')); process.exit(1); }
console.log(`i18n ok: ${keys.size} Texte übersetzt`);
