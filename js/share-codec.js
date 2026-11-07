// Notiz ⇄ Link-Text. Die Notiz steckt komprimiert im Link (#…), es wird nichts auf einem Server gespeichert.
// Wird von der App (js/share.js) benutzt. Kopie im Repo 2ndbrain-webseite (note.html) – bei Änderungen dort mitziehen.

const b64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

// { text, category, created_at } → "z…" (komprimiert) oder "p…" (ohne Komprimierung, ältere Geräte)
export async function encodeNote({ text, category, created_at }) {
  const json = new TextEncoder().encode(JSON.stringify({ v: 1, t: text, c: category || null, d: created_at || null }));
  if (typeof CompressionStream === 'function') return 'z' + b64url(await pipe(json, new CompressionStream('deflate-raw')));
  return 'p' + b64url(json);
}

export async function decodeNote(code) {
  const kind = code?.[0];
  let bytes = unb64url(String(code).slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'p') throw new Error('Unbekanntes Format');
  const o = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof o?.t !== 'string') throw new Error('Keine Notiz');
  return { text: o.t.slice(0, 20000), category: typeof o.c === 'string' ? o.c.slice(0, 40) : null, created_at: o.d };
}
