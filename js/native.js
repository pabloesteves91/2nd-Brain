// Brücke zu nativen iOS-Funktionen (Capacitor). Im Browser ist alles ein No-op.
// Ohne Bundler: Capacitor stellt window.Capacitor in der App bereit.

import { toast } from './ui.js';
import { t } from './i18n.js';

const C = globalThis.Capacitor;
const cache = {};

export const isNative = () => !!C?.isNativePlatform?.();
export const isAndroid = () => C?.getPlatform?.() === 'android';

function plugin(name) {
  if (!isNative()) return null;
  cache[name] ??= C.registerPlugin ? C.registerPlugin(name) : C.Plugins?.[name];
  return cache[name];
}

const REMINDER_ID = 2001;
const WEEKLY_ID = 2002;

export const appPlugin = () => plugin('App');

export async function initNative({ onOpenReview, onOpenWeek, onOpenNote, onNewThought, onAppState, onPendingAction, onImport, onPhoto, onTodo } = {}) {
  if (!isNative()) return;
  document.documentElement.classList.add('native');
  // iPad-App auf dem Mac: kein Touchscreen, keine Bildschirmtastatur → keinen Platz dafür reservieren
  if (navigator.maxTouchPoints === 0) {
    document.documentElement.classList.add('mac');
    const kb = plugin('Keyboard');
    kb?.setResizeMode?.({ mode: 'none' })?.catch?.(() => {});
    kb?.setAccessoryBarVisible?.({ isVisible: false })?.catch?.(() => {}); // grauer Eingabe-Balken verdeckt sonst das Menü
  }
  const ln = plugin('LocalNotifications');
  ln?.addListener?.('localNotificationActionPerformed', ({ notification } = {}) => {
    const extra = notification?.extra || {};
    if (extra.open === 'note' && extra.id) onOpenNote?.(extra.id);
    else if (extra.open === 'week') onOpenWeek?.();
    else onOpenReview?.();
  });
  const app = plugin('App');
  app?.addListener?.('appStateChange', ({ isActive }) => onAppState?.(isActive));
  // Eigenes Plugin (Kurzbefehl/Teilen) – fehlt es im Xcode-Projekt, passiert einfach nichts.
  plugin('SecondBrainNative')?.addListener?.('pendingAction', () => onPendingAction?.())?.catch?.(() => {});
  app?.addListener?.('appUrlOpen', ({ url }) => {
    if (/^secondbrain:\/\/new/i.test(url || '')) onNewThought?.();
    if (/^secondbrain:\/\/photo/i.test(url || '')) onPhoto?.();   // Widget „Schnellaktionen“
    if (/^secondbrain:\/\/today/i.test(url || '')) onOpenReview?.();
    if (/^secondbrain:\/\/todo/i.test(url || '')) onTodo?.();         // Android-Verknüpfung
    const m = /^secondbrain:\/\/import\?d=([\w-]+)/i.exec(url || '')
      || /^https:\/\/(?:www\.)?2ndbrain\.ch\/note\.html#([\w-]+)/i.exec(url || ''); // Universal Link
    if (m) onImport?.(m[1]);
  });
  // Android-Zurück-Taste: wie Escape (schliesst Blatt, Bild, Rückfrage, Einführung); sonst App in den Hintergrund
  app?.addListener?.('backButton', () => {
    const pick = document.querySelector('.pick');
    if (pick) pick.remove();
    else if (document.querySelector('.confirm, .imgview, .onboarding, #overlay:not([hidden])')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    else app.minimizeApp?.();
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
        title: t('Dein Tag'),
        body: t('Ein kurzer Blick auf deine Gedanken von heute?'),
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
  if (!apple) throw new Error(t('Mit Apple anmelden gibt es nur in der iOS-App.'));
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
    await bio.verifyIdentity({ reason: t('2nd Brain entsperren'), title: '2nd Brain', useFallback: true });
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
        title: t('Deine Woche'),
        body: t('Ein ruhiger Blick zurück auf deine Gedanken der Woche.'),
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
        title: t('Erinnerung'),
        body: text.length > 120 ? text.slice(0, 117) + '…' : (text || t('Notiz mit Bild')),
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

// ---------- Kurzbefehl & Teilen-Menü (eigenes Plugin „SecondBrainNative“) ----------

export async function takePendingAction() {
  const p = plugin('SecondBrainNative');
  if (!p) return '';
  try { return (await p.takePendingAction()).action || ''; } catch { return ''; }
}

// Holt Notizen ab, die über „Teilen → 2nd Brain“ abgelegt wurden.
export async function readSharedInbox() {
  const p = plugin('SecondBrainNative');
  if (!p) return [];
  try { return (await p.readInbox()).items || []; } catch { return []; }
}

export async function clearSharedInbox(ids) {
  const p = plugin('SecondBrainNative');
  if (!p || !ids.length) return;
  try { await p.clearInbox({ ids }); } catch { /* egal */ }
}

// ---------- Spracheingabe (eigenes Plugin: Apple Speech / Android SpeechRecognizer, auf dem Gerät) ----------

export const canDictate = () => isNative() && !!C.isPluginAvailable?.('SecondBrainNative');
let dictHandles = [];

// onText(text, final): text ist jeweils alles bisher Gesagte; onEnd(): Erkennung beendet.
export async function startDictation(lang, onText, onEnd) {
  const p = plugin('SecondBrainNative');
  endDictationListeners();
  dictHandles = await Promise.all([
    p.addListener('dictation', d => onText(d?.text || '', !!d?.final)),
    p.addListener('dictationEnd', () => onEnd()),
  ]);
  try { await p.startDictation({ lang }); }
  catch (err) { endDictationListeners(); throw err; }
}

export async function stopDictation() {
  try { await plugin('SecondBrainNative')?.stopDictation(); } catch { /* schon gestoppt */ }
}

export function endDictationListeners() {
  dictHandles.forEach(h => h?.remove?.());
  dictHandles = [];
}

// ---------- Bewertung & Auto-Backup (eigenes Plugin) ----------

export async function askReview() {
  try { await plugin('SecondBrainNative')?.requestReview(); } catch { /* ältere App-Version */ }
}

export const canBackup = () => isNative() && !!C.isPluginAvailable?.('SecondBrainNative');
export async function saveBackup(json) {
  await plugin('SecondBrainNative').saveBackup({ json, name: `2nd-Brain-${new Date().toISOString().slice(0, 10)}.json` });
}

// ---------- Kamera ----------

// Nur iPhone/iPad (nicht Mac): Fotos laufen über das Kamera-Plugin, damit sie auch in der Mediathek landen.
export const canUseCamera = () => isNative() && navigator.maxTouchPoints > 0 && !!C.isPluginAvailable?.('Camera');

// Liefert Blobs; leer, wenn abgebrochen.
export async function cameraPhotos(fromLibrary) {
  const cam = plugin('Camera');
  try {
    const photos = fromLibrary
      ? (await cam.pickImages({ quality: 90, limit: 0 })).photos
      : [await cam.getPhoto({ source: 'CAMERA', resultType: 'uri', quality: 90, correctOrientation: true, saveToGallery: true })];
    if (!fromLibrary && photos[0]?.saved === false) toast(t('Nicht in Fotos gesichert – Zugriff in den Einstellungen erlauben'));
    return Promise.all(photos.map(async ph => (await fetch(ph.webPath)).blob()));
  } catch (err) {
    if (!/cancel/i.test(err?.message || '')) toast(t('Kamera: {e}', { e: err?.message || t('Fehler') }));
    return [];
  }
}

// In der Fotos-App sichern (eigenes Plugin). false = nicht verfügbar (z. B. ältere App-Version).
export const canSaveToPhotos = () => isNative() && !!C.isPluginAvailable?.('SecondBrainNative');
export async function saveToPhotos(dataUrl) {
  await plugin('SecondBrainNative').saveToPhotos({ dataUrl });
}

// Teilen-Menü von iOS (Plugin @capacitor/share). false = nicht verfügbar → Aufrufer nimmt Web-Teilen.
export async function shareNative({ text, url }) {
  if (!isNative() || !C.isPluginAvailable?.('Share')) return false;
  try { await plugin('Share').share({ text, url }); } catch { /* abgebrochen */ }
  return true;
}

// ---------- In-App-Käufe (Plugin @capgo/native-purchases, StoreKit 2) ----------

export const canBuy = () => isNative() && !!C.isPluginAvailable?.('NativePurchases');

// type: 'subs' (Abo) oder 'inapp' (Einmalkauf). Leere Liste, wenn der Store nichts liefert.
export async function storeProducts(ids, type) {
  try { return (await plugin('NativePurchases').getProducts({ productIdentifiers: ids, productType: type })).products || []; }
  catch { return []; }
}

// Google Play: Abos brauchen den Basis-Plan – in der Play Console heisst er wie das Ende der ID („monthly“, „yearly“).
export async function buyProduct(id, type) {
  const planIdentifier = isAndroid() && type === 'subs' ? id.split('.').pop() : undefined;
  return plugin('NativePurchases').purchaseProduct({ productIdentifier: id, productType: type, quantity: 1, planIdentifier });
}

export async function ownedPurchases() {
  try { return (await plugin('NativePurchases').getPurchases()).purchases || []; } catch { return null; } // null = unbekannt (offline)
}

// Apples Abo-Verwaltung direkt in der App (zeigt auch Sandbox-Abos); sonst die Webseite.
export async function manageSubscriptions() {
  try { await plugin('NativePurchases').manageSubscriptions(); }
  catch { window.open(isAndroid() ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions', '_blank'); }
}

export async function restoreStore() {
  await plugin('NativePurchases').restorePurchases();
}

export async function appInfo() {
  const app = plugin('App');
  if (!app) return null;
  try { return await app.getInfo(); } catch { return null; }
}
