// Cloud-Sync über Firebase Auth + Firestore (Notizen) + Storage (Bilder).
// Lokal (IndexedDB) bleibt die Quelle; Firestore ist der Abgleich zwischen Geräten.
import { FIREBASE_CONFIG } from './config.js';
import { db } from './db.js';
import { isNative, appleSignIn } from './native.js';

const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;
const NOTE_FIELDS = ['id', 'text', 'images', 'created_at', 'updated_at', 'day', 'category', 'pinned', 'status', 'sort_order', 'deleted', 'tags', 'remind_at'];

export const syncEnabled = !!FIREBASE_CONFIG;

let fb;          // { auth, fs, st, A (auth), F (firestore), S (storage) }
let readyUser;   // Promise auf den ersten Auth-Status
let running = false;
let again = false;
let timer;
let status = { state: 'idle', at: null, error: null };

function setStatus(s) {
  status = { ...status, ...s };
  document.dispatchEvent(new CustomEvent('sync-status', { detail: status }));
}
export const syncStatus = () => status;

async function load() {
  if (fb) return fb;
  const [{ initializeApp }, A, F, S] = await Promise.all([
    import(`${CDN}/firebase-app.js`),
    import(`${CDN}/firebase-auth.js`),
    import(`${CDN}/firebase-firestore.js`),
    import(`${CDN}/firebase-storage.js`),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  // In der iOS-App (WKWebView) ohne Popup/Redirect-Resolver initialisieren – sonst hängt Auth.
  const auth = isNative()
    ? A.initializeAuth(app, { persistence: A.indexedDBLocalPersistence })
    : A.getAuth(app);
  if (!isNative()) await A.setPersistence(auth, A.indexedDBLocalPersistence).catch(() => {});
  fb = { auth, fs: F.getFirestore(app), st: S.getStorage(app), A, F, S };
  readyUser = new Promise(resolve => {
    const off = A.onAuthStateChanged(auth, u => { off(); resolve(u); });
  });
  A.onAuthStateChanged(auth, u => {
    document.dispatchEvent(new CustomEvent('auth-changed', { detail: u }));
    if (u) scheduleSync(0);
  });
  // Ergebnis eines Redirect-Logins (iOS-Homescreen-App) abholen
  if (!isNative()) A.getRedirectResult(auth).catch(err => setStatus({ state: 'error', error: msg(err) }));
  return fb;
}

export async function initSync() {
  if (!syncEnabled) return;
  try { await load(); } catch (err) { setStatus({ state: 'error', error: 'Firebase konnte nicht geladen werden (offline?)' }); }
}

export async function currentUser() {
  if (!syncEnabled) return null;
  await load();
  await readyUser;
  return fb.auth.currentUser;
}

function msg(err) {
  const code = err?.code || '';
  if (code.includes('configuration-not-found') || code.includes('operation-not-allowed')) return 'Diese Anmeldeart ist in Firebase noch nicht aktiviert (Authentication → Sign-in method).';
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'E-Mail oder Passwort falsch.';
  if (code.includes('email-already-in-use')) return 'Diese E-Mail ist schon registriert – bitte anmelden.';
  if (code.includes('weak-password')) return 'Passwort zu kurz (mind. 6 Zeichen).';
  if (code.includes('invalid-email')) return 'Ungültige E-Mail.';
  if (code.includes('unauthorized-domain')) return 'Diese Domain ist in Firebase nicht freigegeben (Authentication → Settings → Authorized domains).';
  if (code.includes('popup-closed')) return 'Anmeldung abgebrochen.';
  if (code.includes('permission-denied')) return 'Kein Zugriff – Firestore-Regeln prüfen (firestore.rules).';
  if (code.includes('storage/unauthorized')) return 'Kein Zugriff auf Bilder – Storage-Regeln prüfen (storage.rules).';
  return err?.message || String(err);
}

export async function signInGoogle() {
  const { auth, A } = await load();
  const provider = new A.GoogleAuthProvider();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  try {
    if (standalone) await A.signInWithRedirect(auth, provider);
    else await A.signInWithPopup(auth, provider);
  } catch (err) { throw new Error(msg(err)); }
}

export async function signInEmail(email, password, create = false) {
  const { auth, A } = await load();
  try {
    if (create) await A.createUserWithEmailAndPassword(auth, email, password);
    else await A.signInWithEmailAndPassword(auth, email, password);
  } catch (err) { throw new Error(msg(err)); }
}

export async function signInApple() {
  const { auth, A } = await load();
  try {
    const { idToken, rawNonce } = await appleSignIn();
    const credential = new A.OAuthProvider('apple.com').credential({ idToken, rawNonce });
    await A.signInWithCredential(auth, credential);
  } catch (err) {
    if (String(err?.message || err).includes('1001')) throw new Error('Anmeldung abgebrochen.');
    throw new Error(msg(err));
  }
}

// Konto inkl. aller Cloud-Daten löschen (App-Store-Pflicht).
export async function deleteAccount() {
  const { auth, A, fs, F, st, S } = await load();
  const user = auth.currentUser;
  if (!user) return;
  const snap = await F.getDocs(F.collection(fs, 'users', user.uid, 'notes'));
  for (const d of snap.docs) {
    for (const id of d.data().images || []) {
      await S.deleteObject(S.ref(st, imagePath(user.uid, id))).catch(() => {});
    }
    await F.deleteDoc(d.ref);
  }
  try {
    await A.deleteUser(user);
  } catch (err) {
    if (err?.code === 'auth/requires-recent-login') throw new Error('Bitte ab- und wieder anmelden und dann erneut löschen.');
    throw new Error(msg(err));
  }
  await db.setMeta('lastPull', 0);
  await db.setMeta('syncUser', null);
}

export async function signOut() {
  const { auth, A } = await load();
  await A.signOut(auth);
  await db.setMeta('lastPull', 0);
  await db.setMeta('syncUser', null);
}

export function scheduleSync(delay = 2500) {
  if (!syncEnabled) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export async function syncNow() {
  if (!syncEnabled) return;
  if (running) { again = true; return; }
  if (!navigator.onLine) { setStatus({ state: 'offline' }); return; }
  running = true;
  try {
    const { auth } = await load();
    await readyUser;
    const user = auth.currentUser;
    if (!user) { setStatus({ state: 'signed-out' }); return; }

    // Anderer Account als beim letzten Sync → alles neu abgleichen
    if ((await db.getMeta('syncUser')) !== user.uid) {
      await db.setMeta('lastPull', 0);
      for (const n of await db.all('notes')) await db.put('notes', { ...n, dirty: true });
      for (const i of await db.all('images')) await db.put('images', { ...i, dirty: true });
      await db.setMeta('syncUser', user.uid);
    }

    setStatus({ state: 'syncing', error: null });
    await push(user.uid);
    const changed = await pull(user.uid);
    setStatus({ state: 'ok', at: new Date().toISOString() });
    if (changed) document.dispatchEvent(new CustomEvent('remote-changed'));
  } catch (err) {
    console.error(err);
    setStatus({ state: 'error', error: msg(err) });
  } finally {
    running = false;
    if (again) { again = false; scheduleSync(500); }
  }
}

async function push(uid) {
  const { fs, F } = fb;

  const { st, S } = fb;
  for (const img of (await db.all('images')).filter(i => i.dirty && i.blob)) {
    await S.uploadBytes(S.ref(st, imagePath(uid, img.id)), img.blob, {
      contentType: img.blob.type || 'image/jpeg',
      customMetadata: { note_id: img.note_id },
    });
    const now = await db.get('images', img.id);
    if (now) await db.put('images', { ...now, dirty: false });
  }

  const dirty = (await db.all('notes')).filter(n => n.dirty);
  for (let i = 0; i < dirty.length; i += 400) {
    const batch = F.writeBatch(fs);
    for (const n of dirty.slice(i, i + 400)) {
      const row = Object.fromEntries(NOTE_FIELDS.map(k => [k, n[k] ?? null]));
      batch.set(F.doc(fs, 'users', uid, 'notes', n.id), { ...row, server_updated_at: F.serverTimestamp() });
    }
    await batch.commit();
    for (const n of dirty.slice(i, i + 400)) {
      const now = await db.get('notes', n.id);
      if (now && now.updated_at === n.updated_at) await db.put('notes', { ...now, dirty: false });
    }
  }
}

const imagePath = (uid, id) => `users/${uid}/images/${id}.jpg`;

async function pull(uid) {
  const { fs, F, st, S } = fb;
  const last = (await db.getMeta('lastPull')) || 0;
  const q = F.query(
    F.collection(fs, 'users', uid, 'notes'),
    F.where('server_updated_at', '>', F.Timestamp.fromMillis(last)),
    F.orderBy('server_updated_at'),
  );
  const snap = await F.getDocs(q);
  let max = last;
  let changed = false;
  const needImages = new Set();

  for (const d of snap.docs) {
    const remote = d.data();
    const ts = remote.server_updated_at?.toMillis?.() ?? 0;
    if (ts > max) max = ts;
    delete remote.server_updated_at;
    const local = await db.get('notes', d.id);
    if (local?.dirty && local.updated_at >= remote.updated_at) continue; // lokal neuer
    if (!local || remote.updated_at > local.updated_at || (!local.dirty && remote.updated_at !== local.updated_at)) {
      await db.put('notes', { ...remote, images: remote.images || [], dirty: false });
      changed = true;
    }
    if (!remote.deleted) for (const id of remote.images || []) needImages.add([id, d.id]);
  }

  // Fehlende Bilder nachladen
  for (const [id, note_id] of needImages) {
    if (await db.get('images', id)) continue;
    try {
      const blob = await S.getBlob(S.ref(st, imagePath(uid, id)));
      await db.put('images', { id, note_id, blob, dirty: false });
      changed = true;
    } catch (err) {
      if (err?.code !== 'storage/object-not-found') throw err;
    }
  }

  await db.setMeta('lastPull', max);
  return changed;
}
