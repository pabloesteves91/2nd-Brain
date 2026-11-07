// Face-ID-Sperre (nur iOS-App). Beim Verlassen wird der Inhalt sofort verdeckt
// (auch im App-Umschalter), beim Zurückkehren je nach Zeit Face ID verlangt.
//
// Achtung: Der Face-ID-Dialog selbst macht die App kurz „inaktiv“ und wieder „aktiv“.
// Diese Ereignisse dürfen keinen zweiten Scan auslösen.
import { settings } from './settings.js';
import { isNative, verifyIdentity } from './native.js';
import { focusEditor } from './editor.js';
import { updateInert } from './ui.js';

const el = () => document.getElementById('lock');
const QUIET_MS = 1500;   // so lange nach einem Face-ID-Dialog App-Status-Ereignisse ignorieren

let leftAt = 0;
let unlocking = false;
let promptEndedAt = 0;
let ignoreNextActive = false;

export const lockEnabled = () => isNative() && settings().faceId;
const isShown = () => !el().hidden;

function hide() {
  el().hidden = true;
  updateInert();
  document.body.classList.remove('locked');
}

function show() {
  el().hidden = false;
  document.body.classList.add('locked');
  el().querySelector('.lock-hint').textContent = '';
  document.activeElement?.blur();
  updateInert();
  el().tabIndex = -1;
  el().focus({ preventScroll: true });
}

export async function unlock() {
  if (unlocking) return;
  unlocking = true;
  const ok = await verifyIdentity();
  unlocking = false;
  promptEndedAt = Date.now();
  if (ok) { hide(); focusEditor(); }
  else el().querySelector('.lock-hint').textContent = 'Nicht entsperrt – nochmal versuchen';
}

export function initLock() {
  el().querySelector('button').addEventListener('click', unlock);
  if (lockEnabled()) {
    ignoreNextActive = true; // Capacitor meldet beim Kaltstart selbst „aktiv“
    setTimeout(() => { ignoreNextActive = false; }, 3000);
    show();
    unlock();
  }
}

// Vom App-Status (Capacitor App-Plugin) aufgerufen.
export function onAppState(active) {
  if (!lockEnabled()) return;
  // Während/kurz nach dem Face-ID-Dialog: nichts tun
  if (unlocking || Date.now() - promptEndedAt < QUIET_MS) return;

  if (!active) {
    leftAt = Date.now();
    show();
    return;
  }
  if (ignoreNextActive) { ignoreNextActive = false; return; }
  if (!isShown()) return;

  const mins = settings().freshAfterMin;
  if (leftAt && Date.now() - leftAt < mins * 60000) hide();
  else unlock();
}
