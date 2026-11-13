// Notiz teilen: als Text oder als Link, den eine andere Person in ihrem 2nd Brain öffnen kann.
import { db, newNote, saveNote } from './db.js';
import { encodeNote, decodeNote } from './share-codec.js';
import { applyTags, ensureCategory, tagLabel } from './tags.js';
import { popMenu, toast } from './ui.js';
import { shareNative } from './native.js';
import { createShared, leaveShared } from './shared.js';
import { currentUser } from './sync.js';
import { isPlus } from './plus.js';
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

const bubble = (el, name) => el.dispatchEvent(new CustomEvent(name, { bubbles: true }));

// Gemeinsam bearbeiten: braucht ein Konto; wer eine Notiz neu teilt, braucht Plus (Eingeladene nicht).
async function inviteLink(n, anchor) {
  if (!(await currentUser())) { toast(t('Melde dich an, um Notizen gemeinsam zu bearbeiten.')); bubble(anchor, 'open-settings'); return; }
  if (!n.shared_id && !isPlus()) { bubble(anchor, 'open-plus'); return; }
  try {
    const code = await createShared(n);
    const first = n.text.trim().split('\n')[0].slice(0, 60);
    share({ text: t('Bearbeite diese Notiz gemeinsam mit mir in 2nd Brain: {first}', { first }), url: `${SHARE_PAGE}#${code}` });
  } catch (err) { console.warn(err); toast(t('Teilen ist gerade nicht möglich – bist du online?')); }
}

export function shareMenu(n, anchor) {
  const together = n.shared_id
    ? [[t('Einladungslink senden'), () => inviteLink(n, anchor)],
      [n.shared_owner ? t('Teilen beenden') : t('Gemeinsame Notiz verlassen'), async () => {
        try { await leaveShared(n); toast(n.shared_owner ? t('Notiz wird nicht mehr geteilt') : t('Du bist nicht mehr dabei')); bubble(anchor, 'shared-left'); }
        catch { toast(t('Teilen ist gerade nicht möglich – bist du online?')); }
      }]]
    : [[t('Gemeinsam bearbeiten …'), () => inviteLink(n, anchor)]];
  popMenu(anchor, [
    ...together,
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
  n.category = ensureCategory(category);
  applyTags(n);
  // #Tag aus der geteilten Notiz wird beim Empfänger zur Kategorie, auch wenn er das sonst nicht automatisch macht
  if (!n.category && n.tags.length) { n.category = ensureCategory(tagLabel(n.text, n.tags[0])); n.status = 'sorted'; }
  await saveNote(n);
  return id;
}
