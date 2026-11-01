// Brücke zu nativen iOS-Funktionen (Capacitor). Im Browser ist alles ein No-op.
// Ohne Bundler: Capacitor stellt window.Capacitor in der App bereit.

const C = globalThis.Capacitor;
const cache = {};

export const isNative = () => !!C?.isNativePlatform?.();

function plugin(name) {
  if (!isNative()) return null;
  cache[name] ??= C.registerPlugin ? C.registerPlugin(name) : C.Plugins?.[name];
  return cache[name];
}

const REMINDER_ID = 2001;

export async function initNative({ onOpenReview } = {}) {
  if (!isNative()) return;
  document.documentElement.classList.add('native');
  const ln = plugin('LocalNotifications');
  ln?.addListener?.('localNotificationActionPerformed', () => onOpenReview?.());
}

// Tägliche Abend-Erinnerung zur eingestellten Uhrzeit.
export async function scheduleReminder({ enabled, time }) {
  const ln = plugin('LocalNotifications');
  if (!ln) return;
  try {
    await ln.cancel({ notifications: [{ id: REMINDER_ID }] });
    if (!enabled) return;
    let perm = await ln.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') perm = await ln.requestPermissions();
    if (perm.display !== 'granted') return;
    const [hour, minute] = time.split(':').map(Number);
    await ln.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: 'Dein Tag',
        body: 'Ein kurzer Blick auf deine Gedanken von heute?',
        schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
      }],
    });
  } catch (err) {
    console.warn('Erinnerung konnte nicht geplant werden', err);
  }
}

export async function setStatusBar(dark) {
  const sb = plugin('StatusBar');
  try { await sb?.setStyle({ style: dark ? 'DARK' : 'LIGHT' }); } catch { /* egal */ }
}

export function tap() {
  try { plugin('Haptics')?.impact({ style: 'LIGHT' }); } catch { /* egal */ }
}

// „Mit Apple anmelden“: liefert Token + Roh-Nonce für Firebase.
export async function appleSignIn() {
  const apple = plugin('SignInWithApple');
  if (!apple) throw new Error('Mit Apple anmelden gibt es nur in der iOS-App.');
  const rawNonce = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
  const nonce = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  const res = await apple.authorize({ clientId: 'ch.secondbrain.app', redirectURI: '', scopes: 'email name', nonce });
  return { idToken: res.response.identityToken, rawNonce };
}
