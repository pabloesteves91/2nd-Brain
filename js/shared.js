// Geteilte Notizen: mehrere Personen bearbeiten eine Notiz gemeinsam (Firestore shared/{sid}, live).
// Lokal ist es eine normale Notiz mit shared_id; shared_base = letzter gemeinsamer Stand (für das Zusammenführen).
// shortcut: nur Text wird geteilt (keine Bilder) – Bilder liegen pro Konto in Storage; bei Bedarf eigenen Speicherort.
import { db, newNote, saveNote, listNotes } from './db.js';
import { applyTags } from './tags.js';
import { toast } from './ui.js';
import { t } from './i18n.js';
import { settings } from './settings.js';

export const JOIN_PREFIX = 'j';
let fbGet = null;          // () => Promise<{ auth, fs, F }> – von sync.js gesetzt
let stopListen = null;
const pushTimers = new Map();

export function initShared(getFirebase) { fbGet = getFirebase; }

const key = line => line.replace(/^\s*[○✓]\s*/, '').trim(); // Todo-Punkt ohne Kreis/Haken
const nowIso = () => new Date().toISOString();
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);

// Zeilenweise zusammenführen: Änderungen von „local“ gegenüber „base“ auf „remote“ anwenden.
// Gelöschte Zeilen fallen weg, neue Zeilen kommen hinter ihre Vorgängerzeile, ○/✓ eines Punkts übernimmt local.
export function mergeLines(base, local, remote) {
  if (local === base) return remote;
  if (remote === base || remote === local) return local;
  const B = base.split('\n'), L = local.split('\n');
  const out = remote.split('\n');
  const baseKeys = new Set(B.map(key));
  const localKeys = new Set(L.map(key));
  // 1) lokal gelöschte Zeilen entfernen
  for (const b of B) if (!localKeys.has(key(b))) { const i = out.findIndex(r => key(r) === key(b)); if (i >= 0) out.splice(i, 1); }
  // 2) lokal geänderte Haken (gleicher Punkt, anderes Zeichen) übernehmen
  for (const l of L) {
    const b = B.find(x => key(x) === key(l));
    if (b !== undefined && b !== l) { const i = out.findIndex(r => key(r) === key(l)); if (i >= 0) out[i] = l; }
  }
  // 3) lokal neue Zeilen nach ihrer Vorgängerzeile einfügen
  L.forEach((l, idx) => {
    if (baseKeys.has(key(l)) || out.some(r => key(r) === key(l) && key(l) !== '')) return;
    const prev = idx > 0 ? key(L[idx - 1]) : null;
    const at = prev === null ? 0 : out.findIndex(r => key(r) === prev) + 1;
    out.splice(at > 0 ? at : prev === null ? 0 : out.length, 0, l);
  });
  return out.join('\n');
}

// Lokale Notiz zu einer geteilten Notiz. Doppelte (Kopie sh-… neben dem Original, ältere Versionen) werden aufgeräumt.
async function noteForShared(sid) {
  const all = (await listNotes()).filter(n => n.shared_id === sid);
  const keep = all.find(n => !n.id.startsWith('sh-')) || all[0] || (await db.get('notes', `sh-${sid}`)) || null;
  for (const n of all) if (n !== keep && n.id.startsWith('sh-')) { n.deleted = true; n.shared_id = null; await saveNote(n); }
  return keep;
}

const myEmail = auth => auth.currentUser?.email || '';
const myName = () => String(settings().displayName || '').trim().slice(0, 40);

// Eigene Notiz teilen → Einladungslink. Voraussetzung (Konto, Plus) prüft der Aufrufer.
export async function createShared(note) {
  const { auth, fs, F } = await fbGet();
  const uid = auth.currentUser.uid;
  let sid = note.shared_id;
  if (!sid) {
    const ref = F.doc(F.collection(fs, 'shared'));
    sid = ref.id;
    // zuerst lokal verknüpfen – sonst legt der Live-Abgleich beim Anlegen eine zweite Notiz an
    note.shared_id = sid; note.shared_base = note.text; note.shared_owner = true; note.shared_count = 1;
    await saveNote(note);
    try {
      await F.setDoc(ref, { owner: uid, members: [uid], names: { [uid]: myEmail(auth) }, display: { [uid]: myName() }, invite: randomToken(), text: note.text, updated_at: nowIso(), updated_by: uid });
    } catch (err) { await detach(note); throw err; }
  }
  const snap = await F.getDoc(F.doc(fs, 'shared', sid));
  return `${JOIN_PREFIX}${sid}_${snap.data().invite}`;
}

// Einladungslink öffnen → Mitglied werden. Liefert die lokale Notiz-ID (kommt per Live-Abgleich).
export async function joinShared(code) {
  const m = new RegExp(`^${JOIN_PREFIX}([A-Za-z0-9]+)_([a-z0-9]+)$`).exec(code);
  if (!m) throw new Error('code');
  const [, sid, token] = m;
  const { auth, fs, F } = await fbGet();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('signed-out');
  const ref = F.doc(fs, 'shared', sid);
  try { await F.updateDoc(ref, { members: F.arrayUnion(uid), joinToken: token, [`names.${uid}`]: myEmail(auth), [`display.${uid}`]: myName() }); }
  catch { /* schon Mitglied (z. B. zweites eigenes Gerät) → Regeln lehnen das Beitreten ab; Lesen klappt dann */ }
  const snap = await F.getDoc(ref); // wirft, wenn Code falsch und nicht Mitglied
  await applyRemote(sid, snap.data());
  return (await noteForShared(sid))?.id;
}

// Teilen beenden (Besitzer) bzw. verlassen (Mitglied). Die Notiz bleibt lokal als normale Notiz.
export async function leaveShared(note) {
  const { auth, fs, F } = await fbGet();
  const ref = F.doc(fs, 'shared', note.shared_id);
  if (note.shared_owner) await F.deleteDoc(ref);
  else await F.updateDoc(ref, { members: F.arrayRemove(auth.currentUser.uid), [`names.${auth.currentUser.uid}`]: F.deleteField(), [`display.${auth.currentUser.uid}`]: F.deleteField() });
  await detach(note);
}

async function detach(note) {
  note.shared_id = null; note.shared_base = null; note.shared_owner = false; note.shared_count = 0;
  await saveNote(note);
}

// Lokale Änderung an einer geteilten Notiz hochladen (gebündelt), mit Zusammenführen bei gleichzeitigen Änderungen.
export function pushShared(note) {
  if (!note?.shared_id || !fbGet) return;
  clearTimeout(pushTimers.get(note.id));
  pushTimers.set(note.id, setTimeout(() => push(note.id).catch(err => console.warn('Geteilte Notiz', err)), 800));
}

async function push(id) {
  const note = await db.get('notes', id);
  if (!note?.shared_id || note.text === note.shared_base) return;
  const { auth, fs, F } = await fbGet();
  const ref = F.doc(fs, 'shared', note.shared_id);
  const merged = await F.runTransaction(fs, async tx => {
    const doc = await tx.get(ref);
    if (!doc.exists()) return null;
    const remote = doc.data().text;
    const text = remote === note.shared_base ? note.text : mergeLines(note.shared_base ?? remote, note.text, remote);
    tx.update(ref, { text, updated_at: nowIso(), updated_by: auth.currentUser.uid });
    return text;
  });
  if (merged === null) return detach(note);
  const fresh = await db.get('notes', id);
  fresh.shared_base = merged;
  if (fresh.text === note.text && merged !== note.text) { fresh.text = merged; applyTags(fresh); }
  await saveNote(fresh);
  if (merged !== note.text) document.dispatchEvent(new CustomEvent('remote-changed'));
}

async function applyRemote(sid, data) {
  if (!data) return;
  let note = await noteForShared(sid);
  if (!note) {
    note = newNote();
    note.id = `sh-${sid}`;
    note.text = data.text; note.shared_base = data.text;
  } else if (note.text === note.shared_base || note.shared_base == null) {
    if (note.text === data.text && note.shared_count === data.members.length) return;
    note.text = data.text; note.shared_base = data.text;
  } else {
    if (data.text === note.shared_base) return; // nur lokal geändert → pushShared kümmert sich
    note.text = mergeLines(note.shared_base, note.text, data.text);
    note.shared_base = data.text;
    pushShared(note);
  }
  note.shared_id = sid;
  note.shared_owner = data.owner === (await fbGet()).auth.currentUser?.uid;
  note.shared_count = data.members.length;
  applyTags(note);
  await saveNote(note);
  document.dispatchEvent(new CustomEvent('remote-changed'));
}

// Live-Abgleich aller geteilten Notizen, in denen ich Mitglied bin.
export async function startShared(uid) {
  stopShared();
  if (!uid || !fbGet) return;
  const { fs, F } = await fbGet();
  const q = F.query(F.collection(fs, 'shared'), F.where('members', 'array-contains', uid));
  stopListen = F.onSnapshot(q, async snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type === 'removed') {
        const n = await noteForShared(ch.doc.id);
        if (n) { await detach(n); toast(t('Eine Notiz wird nicht mehr geteilt.')); document.dispatchEvent(new CustomEvent('remote-changed')); }
      } else await applyRemote(ch.doc.id, ch.doc.data());
    }
  }, err => console.warn('Geteilte Notizen', err));
}

export function stopShared() { stopListen?.(); stopListen = null; }

// Wer hat Zugriff? → [{ uid, email, owner, me }]
export async function sharedMembers(note) {
  const { auth, fs, F } = await fbGet();
  const d = (await F.getDoc(F.doc(fs, 'shared', note.shared_id))).data();
  if (!d) return [];
  const me = auth.currentUser?.uid;
  return d.members.map(uid => ({ uid, email: d.names?.[uid] || '', name: d.display?.[uid] || '', owner: uid === d.owner, me: uid === me }));
}

// Besitzer entfernt eine Person
export async function removeMember(note, uid) {
  const { fs, F } = await fbGet();
  await F.updateDoc(F.doc(fs, 'shared', note.shared_id), { members: F.arrayRemove(uid), [`names.${uid}`]: F.deleteField(), [`display.${uid}`]: F.deleteField() });
}

// Eigenen Anzeigenamen in einer geteilten Notiz ändern
export async function setMyName(note, name) {
  const { auth, fs, F } = await fbGet();
  await F.updateDoc(F.doc(fs, 'shared', note.shared_id), { [`display.${auth.currentUser.uid}`]: String(name).trim().slice(0, 40) });
}

// Name in allen eigenen gemeinsamen Notizen aktualisieren (Einstellungen oder „Name ändern“)
export async function updateMyNameEverywhere(name) {
  for (const n of (await listNotes()).filter(x => x.shared_id)) {
    try { await setMyName(n, name); } catch (err) { console.warn('Name nicht aktualisiert', err); }
  }
}
