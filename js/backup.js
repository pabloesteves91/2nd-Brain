// Sicherung aller Notizen (+ Bilder) als JSON – für „JSON sichern“ und das wöchentliche Auto-Backup der App.
import { db } from './db.js';
import { blobToDataUrl } from './images.js';
import { canBackup, saveBackup } from './native.js';

const MAX_IMAGES = 50 * 1024 * 1024; // shortcut: grössere Bildmengen nicht ins Auto-Backup (Brücke/Speicher), dann nur Notizen

export async function buildBackup({ limitImages = false } = {}) {
  const notes = (await db.all('notes')).filter(n => !n.deleted).map(({ dirty, dirtyLocal, ...n }) => n);
  const images = [];
  let size = 0;
  for (const img of await db.all('images')) {
    if (!img.blob) continue;
    size += img.blob.size;
    if (limitImages && size > MAX_IMAGES) { images.length = 0; break; }
    images.push({ id: img.id, note_id: img.note_id, data: await blobToDataUrl(img.blob) });
  }
  return JSON.stringify({ app: '2nd-brain', version: 1, exported_at: new Date().toISOString(), notes, images });
}

// Einmal pro Woche still sichern (iOS: Dateien-App › Auf meinem iPhone › 2nd Brain, Android: Downloads/2nd Brain).
export async function autoBackup() {
  if (!canBackup()) return;
  const last = (await db.getMeta('backupAt')) || 0;
  if (Date.now() - last < 7 * 86400000) return;
  if (!(await db.all('notes')).some(n => !n.deleted)) return;
  try {
    await saveBackup(await buildBackup({ limitImages: true }));
    await db.setMeta('backupAt', Date.now());
  } catch (err) { console.warn('Auto-Backup fehlgeschlagen', err); }
}
