// Kopiert die Web-App nach www/ – das ist der Ordner, den Capacitor in die iOS-App packt.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const files = ['index.html', 'privacy.html', 'styles.css', 'sw.js', 'manifest.webmanifest', 'js', 'icons', 'onboarding'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of files) cpSync(join(root, f), join(out, f), { recursive: true });
console.log(`www/ gebaut (${files.join(', ')})`);
