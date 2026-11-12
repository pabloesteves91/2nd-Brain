// Kopiert die Swift- und Text-Dateien aus ios-extensions/ über ihre Kopien im Xcode-Projekt (ios/).
// Xcode hat beim Einrichten Kopien angelegt („Copy items if needed“) – so kommen Updates ohne ⌘A/⌘V an.
// Überschreibt nur Dateien, die es im Projekt schon gibt; legt nichts an und löscht nichts.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, basename, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'ios-extensions');
const ios = join(root, process.argv[2] || 'ios');
const SKIP_DIRS = new Set(['Pods', 'build', 'DerivedData', 'public', 'node_modules', '.build', 'SourcePackages', 'xcuserdata', '.git']);

function walk(dir, skip = false, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!(skip && SKIP_DIRS.has(name))) walk(p, skip, out); }
    else out.push(p);
  }
  return out;
}

// Schlüssel: Dateiname, bei Übersetzungen mit Sprachordner (de.lproj/AppShortcuts.strings)
const key = p => (/\.lproj$/.test(basename(dirname(p))) ? `${basename(dirname(p))}/` : '') + basename(p);

if (!existsSync(ios)) {
  console.log('ios-files: kein Ordner ios/ – nichts zu kopieren.');
  process.exit(0);
}
const targets = new Map();
for (const p of walk(ios, true)) {
  const k = key(p);
  targets.set(k, [...(targets.get(k) || []), p]);
}

const stats = { updated: [], same: [], missing: [] };
for (const file of walk(src)) {
  const name = basename(file);
  if (name.endsWith('.txt') || name.endsWith('.md') || name === 'Info.plist' || name.startsWith('.')) continue; // Vorlagen bleiben manuell
  const dests = targets.get(key(file));
  if (!dests) { stats.missing.push(relative(src, file)); continue; }
  const data = readFileSync(file);
  for (const d of dests) {
    if (readFileSync(d).equals(data)) { stats.same.push(relative(ios, d)); continue; }
    writeFileSync(d, data);
    stats.updated.push(relative(ios, d));
  }
}

// Info.plist der App: fehlende Pflicht-Einträge ergänzen (ohne sie beendet iOS die App beim Mikrofon-Zugriff).
const PLIST_KEYS = {
  NSMicrophoneUsageDescription: '\t<key>NSMicrophoneUsageDescription</key>\n\t<string>Um Gesprochenes in Text umzuwandeln.</string>\n',
  NSSpeechRecognitionUsageDescription: '\t<key>NSSpeechRecognitionUsageDescription</key>\n\t<string>Um Gesprochenes in Text umzuwandeln – auf deinem Gerät.</string>\n',
  INAlternativeAppNames: readFileSync(join(src, 'App', 'Info-Siri.plist.txt'), 'utf8').replace(/<!--[\s\S]*?-->\s*/, ''),
};
const appPlist = [...(targets.get('Info.plist') || [])].find(p => p.split(sep).slice(-3).join('/') === 'App/App/Info.plist');
const plistAdded = [];
if (appPlist) {
  let xml = readFileSync(appPlist, 'utf8');
  for (const [k, snippet] of Object.entries(PLIST_KEYS)) {
    if (xml.includes(`<key>${k}</key>`)) continue;
    const end = xml.lastIndexOf('</dict>');
    if (end < 0) break;
    xml = xml.slice(0, end) + snippet.trimEnd() + '\n' + xml.slice(end);
    plistAdded.push(k);
  }
  if (plistAdded.length) writeFileSync(appPlist, xml);
}

const list = a => a.map(x => `   · ${x.split(sep).join('/')}`).join('\n');
console.log(`\nios-files: Xcode-Dateien aus ios-extensions/ aktualisiert`);
if (stats.updated.length) console.log(` ✓ aktualisiert (${stats.updated.length}):\n${list(stats.updated)}`);
console.log(` = unverändert: ${stats.same.length}`);
if (stats.missing.length) console.log(` ! nicht im Xcode-Projekt (dort einmal hinzufügen, siehe IOS.md):\n${list(stats.missing)}`);
if (plistAdded.length) console.log(` ✓ Info.plist ergänzt: ${plistAdded.join(', ')}`);
if (stats.updated.length || plistAdded.length) console.log(' → In Xcode: Product → Clean Build Folder (⇧⌘K), dann ▶ Run.\n');
