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
const WEEKLY_ID = 2002;

export const appPlugin = () => plugin('App');

export async function initNative({ onOpenReview, onOpenWeek, onOpenNote, onNewThought, onAppState } = {}) {
  if (!isNative()) return;
  document.documentElement.classList.add('native');
  const ln = plugin('LocalNotifications');
  ln?.addListener?.('localNotificationActionPerformed', ({ notification } = {}) => {
    const extra = notification?.extra || {};
    if (extra.open === 'note' && extra.id) onOpenNote?.(extra.id);
    else if (extra.open === 'week') onOpenWeek?.();
    else onOpenReview?.();
  });
  const app = plugin('App');
  app?.addListener?.('appStateChange', ({ isActive }) => onAppState?.(isActive));
  app?.addListener?.('appUrlOpen', ({ url }) => {
    if (/^secondbrain:\/\/new/i.test(url || '')) onNewThought?.();
  });
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
  const res = await apple.authorize({ clientId: 'ch.fabioberta.secondbrain', redirectURI: '', scopes: 'email name', nonce });
  return { idToken: res.response.identityToken, rawNonce };
}

// ---------- Face ID ----------

export async function biometryAvailable() {
  const bio = plugin('NativeBiometric');
  if (!bio) return false;
  try { return (await bio.isAvailable({ useFallback: true })).isAvailable; } catch { return false; }
}

export async function verifyIdentity() {
  const bio = plugin('NativeBiometric');
  if (!bio) return true;
  try {
    await bio.verifyIdentity({ reason: '2nd Brain entsperren', title: '2nd Brain', useFallback: true });
    return true;
  } catch {
    return false;
  }
}

// ---------- Wochenrückblick ----------

export async function scheduleWeekly({ enabled, time }) {
  const ln = plugin('LocalNotifications');
  if (!ln) return;
  try {
    await ln.cancel({ notifications: [{ id: WEEKLY_ID }] });
    if (!enabled) return;
    if ((await ln.checkPermissions()).display !== 'granted') {
      if ((await ln.requestPermissions()).display !== 'granted') return;
    }
    const [hour, minute] = time.split(':').map(Number);
    await ln.schedule({
      notifications: [{
        id: WEEKLY_ID,
        title: 'Deine Woche',
        body: 'Ein ruhiger Blick zurück auf deine Gedanken der Woche.',
        schedule: { on: { weekday: 1, hour, minute }, repeats: true, allowWhileIdle: true }, // 1 = Sonntag
        extra: { open: 'week' },
      }],
    });
  } catch (err) {
    console.warn('Wochenrückblick konnte nicht geplant werden', err);
  }
}

// ---------- Aufgaben-Erinnerungen ----------

// Stabile numerische ID aus der Notiz-ID (LocalNotifications braucht int32).
export function reminderId(noteId) {
  let h = 0;
  for (const ch of noteId) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return 100000 + (Math.abs(h) % 2_000_000_000);
}

export async function scheduleTask(note) {
  const ln = plugin('LocalNotifications');
  if (!ln) return;
  const id = reminderId(note.id);
  try {
    await ln.cancel({ notifications: [{ id }] });
    const at = note.remind_at ? new Date(note.remind_at) : null;
    if (!at || at <= new Date() || note.deleted || note.status === 'archived') return;
    if ((await ln.checkPermissions()).display !== 'granted') {
      if ((await ln.requestPermissions()).display !== 'granted') return;
    }
    const text = note.text.replace(/\s+/g, ' ').trim();
    await ln.schedule({
      notifications: [{
        id,
        title: 'Erinnerung',
        body: text.length > 120 ? text.slice(0, 117) + '…' : (text || 'Notiz mit Bild'),
        schedule: { at, allowWhileIdle: true },
        extra: { open: 'note', id: note.id },
      }],
    });
  } catch (err) {
    console.warn('Erinnerung konnte nicht geplant werden', err);
  }
}

export async function rescheduleTasks(notes) {
  const ln = plugin('LocalNotifications');
  if (!ln) return;
  try {
    const { notifications = [] } = await ln.getPending();
    const stale = notifications.filter(n => n.id >= 100000).map(n => ({ id: n.id }));
    if (stale.length) await ln.cancel({ notifications: stale });
  } catch { /* egal */ }
  for (const n of notes) if (n.remind_at) await scheduleTask(n);
}
