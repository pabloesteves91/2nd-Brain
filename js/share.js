// Notiz teilen: als Text oder als Link, den eine andere Person in ihrem 2nd Brain öffnen kann.
import { db, newNote, saveNote } from './db.js';
import { encodeNote, decodeNote } from './share-codec.js';
import { applyTags } from './tags.js';
import { popMenu, toast } from './ui.js';
import { shareNative } from './native.js';
import { t } from './i18n.js';

export const SHARE_PAGE = 'https://2ndbrain.ch/note.html';
const MAX_CODE = 6000; // längere Links gehen in manchen Apps kaputt

async function share({ text, url }) {
  if (await shareNative({ text, url })) return;
  if (navigator.share) {
    try { await navigator.share(url ? { text, url } : { text }); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url ? `${text}\n${url}` : text); toast(url ? t('Link kopiert') : t('Text kopiert')); }
  catch { toast(t('Teilen ist hier nicht möglich')); }
}

export function shareMenu(n, anchor) {
  popMenu(anchor, [
    [t('Als Text'), () => share({ text: n.text.trim() })],
    [t('Als Link'), async () => {
      const code = await encodeNote(n);
      if (code.length > MAX_CODE) { toast(t('Zu lang für einen Link – bitte als Text teilen')); return; }
      const first = n.text.trim().split('\n')[0].slice(0, 60);
      share({ text: t('Notiz aus 2nd Brain: {first}', { first }), url: `${SHARE_PAGE}#${code}` });
    }],
  ]);
}

// Geteilte Notiz übernehmen; liefert die ID (gleicher Link zweimal → dieselbe Notiz).
export async function importShared(code) {
  const { text, category } = await decodeNote(code);
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const id = `shared-${(h >>> 0).toString(36)}-${code.length.toString(36)}`;
  if (await db.get('notes', id)) return id;
  const n = newNote();
  n.id = id;
  n.text = text;
  n.category = category;
  applyTags(n);
  await saveNote(n);
  return id;
}
