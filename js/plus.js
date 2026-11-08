// „2nd Brain Plus“: Sync auf allen Geräten + Wochenrückblick. Alles andere bleibt gratis.
// Plus gilt, wenn gekauft (Abo/für immer), früher Nutzer (Geschenk) oder in Firebase geschenkt (plusGifts).
import { settings, setSetting } from './settings.js';
import { PLUS_IDS, PLUS_SINCE } from './config.js';
import { isNative, canBuy, ownedPurchases } from './native.js';
import { db } from './db.js';

const DAY = 86400000;
const active = g => !!g && (!g.until || new Date(g.until).getTime() > Date.now());

export function isPlus() {
  if (!canBuy()) return true; // Browser/Entwicklung oder Gerät ohne Store: nichts sperren
  const s = settings();
  return !!s.plusKind || !!s.plusEarly || active(s.plusFbGift);
}

// Art für die Anzeige: 'monthly' | 'yearly' | 'lifetime' | 'early' | 'gift' | null
export function plusKind() {
  const s = settings();
  return s.plusKind || (s.plusEarly ? 'early' : active(s.plusFbGift) ? 'gift' : null);
}

const changed = () => document.dispatchEvent(new CustomEvent('plus-changed'));

// Beim ersten Start dieser Version: Wer die App schon benutzt hat, bekommt Plus für immer geschenkt.
export async function grantEarlyUsers() {
  const s = settings();
  if (s.plusChecked) return;
  const existing = s.onboarded || (await db.all('notes')).length > 0;
  if (existing) setSetting('plusEarly', true);
  setSetting('plusChecked', true);
}

// Käufe bei Apple abfragen; Ergebnis wird gemerkt, damit Plus auch offline gilt.
export async function refreshPurchases() {
  if (!canBuy()) return;
  const list = await ownedPurchases();
  if (!list) return; // offline/unbekannt → letzten Stand behalten
  const ok = p => !p.revocationDate;
  const has = id => list.some(p => p.productIdentifier === id && ok(p)
    && (id === PLUS_IDS.lifetime || p.isActive === true || (p.expirationDate && new Date(p.expirationDate).getTime() > Date.now())));
  const kind = has(PLUS_IDS.lifetime) ? 'lifetime' : has(PLUS_IDS.yearly) ? 'yearly' : has(PLUS_IDS.monthly) ? 'monthly' : null;
  if (kind !== (settings().plusKind || null)) { setSetting('plusKind', kind); changed(); }
}

// Geschenk aus Firebase (Sammlung plusGifts) übernehmen – gift = { note, until } oder null.
// Frühe Nutzer auch auf neuem Gerät/nach Neuinstallation: Konto vor PLUS_SINCE angelegt.
export function grantEarlyAccount(user) {
  const created = new Date(user?.metadata?.creationTime || NaN);
  if (!isNaN(created) && created < new Date(PLUS_SINCE) && !settings().plusEarly) { setSetting('plusEarly', true); changed(); }
}

export function setFirebaseGift(gift) {
  const before = JSON.stringify(settings().plusFbGift || null);
  if (before !== JSON.stringify(gift || null)) { setSetting('plusFbGift', gift || null); changed(); }
}

// Kaufbildschirm von selbst: nach der Einführung (neue Nutzer) und einmal 14 Tage nach „Vielleicht später“.
export function shouldAskOnStart() {
  const s = settings();
  if (!isNative() || isPlus() || s.plusNever || s.plusAskedAgain || !s.plusLaterAt) return false;
  return Date.now() - s.plusLaterAt >= 14 * DAY;
}

export function answered(choice) { // 'later' | 'never'
  if (choice === 'never') setSetting('plusNever', true);
  else if (!settings().plusLaterAt) setSetting('plusLaterAt', Date.now());
}
