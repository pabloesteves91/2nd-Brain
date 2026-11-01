// Face-ID-Sperre (nur iOS-App). Beim Verlassen wird der Inhalt sofort verdeckt
// (auch im App-Umschalter), beim Zurückkehren je nach Zeit Face ID verlangt.
import { settings } from './settings.js';
import { isNative, verifyIdentity } from './native.js';
import { focusEditor } from './editor.js';

const el = () => document.getElementById('lock');
let leftAt = 0;
let unlocking = false;

export const lockEnabled = () => isNative() && settings().faceId;

export async function unlock() {
  if (unlocking) return;
  unlocking = true;
  const ok = await verifyIdentity();
  unlocking = false;
  if (ok) { el().hidden = true; document.body.classList.remove('locked'); focusEditor(); }
  else el().querySelector('.lock-hint').textContent = 'Nicht entsperrt – nochmal versuchen';
}

function show() {
  el().hidden = false;
  document.body.classList.add('locked');
  el().querySelector('.lock-hint').textContent = '';
  document.activeElement?.blur();
}

export function initLock() {
  el().querySelector('button').addEventListener('click', unlock);
  if (lockEnabled()) { show(); unlock(); }
}

// Vom App-Status (Capacitor App-Plugin) aufgerufen.
export function onAppState(active) {
  if (!lockEnabled()) return;
  if (!active) { leftAt = Date.now(); show(); return; }
  const mins = settings().freshAfterMin;
  if (Date.now() - leftAt >= mins * 60000) unlock();
  else { el().hidden = true; document.body.classList.remove('locked'); }
}
