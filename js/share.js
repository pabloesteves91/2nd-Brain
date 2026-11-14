// Notiz teilen: als Text oder als Link, den eine andere Person in ihrem 2nd Brain öffnen kann.
import { db, newNote, saveNote } from './db.js';
import { encodeNote, decodeNote } from './share-codec.js';
import { applyTags, ensureCategory, tagLabel } from './tags.js';
import { popMenu, toast, h, updateInert } from './ui.js';
import { shareNative } from './native.js';
import { createShared, leaveShared, sharedMembers, removeMember, setMyName } from './shared.js';
import { settings, setSetting } from './settings.js';
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
  if (!isPlus()) { bubble(anchor, 'open-plus'); return; } // gemeinsame Notizen gehören für alle Beteiligten zu Plus
  if (!(await ensureName())) return;
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

// Anzeigename für gemeinsame Notizen: einmal fragen (wichtig bei verborgener Apple-E-Mail)
export function askName(current = '') {
  return new Promise(resolve => {
    const done = v => { box.remove(); updateInert(); resolve(v); };
    const input = h('input', { type: 'text', maxlength: 40, value: current, placeholder: t('z. B. Lea'), autocomplete: 'given-name', 'aria-label': t('Dein Name') });
    const save = () => { const v = input.value.trim(); if (v) { setSetting('displayName', v); done(v); } else input.focus(); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
    const box = h('div', { class: 'confirm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'name-t' },
      h('div', { class: 'confirm-card' },
        h('h2', { id: 'name-t' }, t('Wie sollen dich die anderen sehen?')),
        h('p', {}, t('Der Name erscheint bei gemeinsamen Notizen in der Liste „Zugriff“.')),
        h('div', { class: 'name-field' }, input),
        h('div', { class: 'confirm-actions' },
          h('button', { type: 'button', class: 'confirm-cancel', onclick: () => done(null) }, t('Abbrechen')),
          h('button', { type: 'button', class: 'confirm-ok whatsnew-ok', onclick: save }, t('Weiter')))));
    document.body.append(box);
    updateInert();
    input.focus();
  });
}

export async function ensureName() {
  return settings().displayName || (await askName());
}

const isRelay = mail => /@privaterelay\.appleid\.com$/i.test(mail || '');

// 👥 antippen: wer hat Zugriff? Besitzer kann Personen entfernen.
export async function showMembers(n, anchor) {
  let list;
  try { list = await sharedMembers(n); } catch { toast(t('Teilen ist gerade nicht möglich – bist du online?')); return; }
  const owner = list.find(m => m.me)?.owner;
  const close = () => { box.remove(); document.removeEventListener('keydown', onKey, true); updateInert(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  const row = m => h('li', { class: 'member' },
    h('span', {},
      m.name || (isRelay(m.email) ? t('Apple-ID (verborgen)') : m.email || t('ohne E-Mail')),
      m.me ? h('small', {}, ` · ${t('du')}`) : null, m.owner ? h('small', {}, ` · ${t('Besitzer')}`) : null,
      m.name && m.email && !isRelay(m.email) ? h('small', { class: 'mail' }, m.email) : null),
    m.me ? h('button', {
      type: 'button', class: 'link',
      onclick: async () => { const v = await askName(m.name || settings().displayName || ''); if (!v) return; try { await setMyName(n, v); close(); showMembers(n, anchor); } catch { toast(t('Teilen ist gerade nicht möglich – bist du online?')); } },
    }, t('Name ändern')) : null,
    owner && !m.me ? h('button', {
      type: 'button', class: 'link danger',
      onclick: async e => {
        e.currentTarget.disabled = true;
        try { await removeMember(n, m.uid); e.currentTarget.closest('li').remove(); toast(t('Person entfernt')); }
        catch { e.currentTarget.disabled = false; toast(t('Teilen ist gerade nicht möglich – bist du online?')); }
      },
    }, t('entfernen')) : null);
  const box = h('div', { class: 'confirm', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mem-t' },
    h('div', { class: 'confirm-card' },
      h('h2', { id: 'mem-t' }, t('Zugriff auf diese Notiz')),
      h('ul', { class: 'members' }, list.map(row)),
      h('div', { class: 'confirm-actions' },
        h('button', { type: 'button', class: 'confirm-cancel', onclick: () => { close(); inviteLink(n, anchor); } }, t('Einladen')),
        h('button', { type: 'button', class: 'confirm-ok whatsnew-ok', onclick: close }, t('OK')))));
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', onKey, true);
  document.body.append(box);
  updateInert();
  box.querySelector('.whatsnew-ok').focus({ preventScroll: true });
}
