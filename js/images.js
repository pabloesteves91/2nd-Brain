import { db, uid } from './db.js';

const MAX = 1600;
const QUALITY = 0.82;
const urls = new Map();

// Bild verkleinern und als JPEG-Blob zurückgeben.
export async function shrink(file, { max = MAX, quality = QUALITY } = {}) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width, h = bmp.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export async function storeImage(file, noteId) {
  const blob = await shrink(file);
  const id = uid();
  await db.put('images', { id, note_id: noteId, blob, dirty: true });
  return id;
}

export async function imageUrl(id) {
  if (urls.has(id)) return urls.get(id);
  const rec = await db.get('images', id);
  if (!rec?.blob) return null;
  const url = URL.createObjectURL(rec.blob);
  urls.set(id, url);
  return url;
}

export async function removeImage(id) {
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
  await db.del('images', id);
}

export function blobToDataUrl(blob) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
}
