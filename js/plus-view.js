// Kaufbildschirm „Unterstütze 2nd Brain“. Preise kommen immer von Apple (lokalisiert), nie hart codiert.
import { h, toast } from './ui.js';
import { PLUS_IDS, TERMS_URL, PRIVACY_URL } from './config.js';
import { storeProducts, buyProduct, restoreStore } from './native.js';
import { refreshPurchases, isPlus, answered } from './plus.js';

const OPTIONS = [
  { key: 'monthly', type: 'subs', name: 'Monat', hint: '🥐 weniger als ein Gipfeli' },
  { key: 'yearly', type: 'subs', name: 'Jahr', hint: '🥪 wie ein Sandwich – fürs ganze Jahr' },
  { key: 'lifetime', type: 'inapp', name: 'Für immer', hint: '📖 wie ein Taschenbuch – einmalig' },
];

export async function openPlus(container, close) {
  container.replaceChildren(h('p', { class: 'small', style: 'text-align:center;padding:40px 0' }, 'lädt …'));
  const [subs, once] = await Promise.all([
    storeProducts([PLUS_IDS.monthly, PLUS_IDS.yearly], 'subs'),
    storeProducts([PLUS_IDS.lifetime], 'inapp'),
  ]);
  const byId = Object.fromEntries([...subs, ...once].map(p => [p.identifier, p]));
  const opts = OPTIONS.map(o => ({ ...o, id: PLUS_IDS[o.key], product: byId[PLUS_IDS[o.key]] })).filter(o => o.product);
  let pick = opts.find(o => o.key === 'yearly') || opts[0];

  const trial = o => o?.key === 'yearly' && o.product.introductoryPrice && o.product.introductoryPrice.price === 0;
  const save = () => {
    const m = byId[PLUS_IDS.monthly], y = byId[PLUS_IDS.yearly];
    return m && y && m.price > 0 ? Math.round((1 - y.price / (m.price * 12)) * 100) : 0;
  };

  const cta = h('button', { type: 'button', class: 'primary plus-cta' });
  const legal = h('p', { class: 'plus-legal' });
  const list = h('div', { class: 'plus-options', role: 'radiogroup', 'aria-label': 'Plus wählen' });

  const paint = () => {
    list.replaceChildren(...opts.map(o => {
      const on = o === pick;
      const badge = o.key === 'yearly' ? [trial(o) ? '14 Tage gratis' : null, save() > 0 ? `spare ${save()} %` : null].filter(Boolean).join(' · ') : '';
      return h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(on), class: 'plus-opt' + (on ? ' on' : ''),
        onclick: () => { pick = o; paint(); },
      },
      badge ? h('span', { class: 'plus-badge' }, badge) : null,
      h('span', { class: 'plus-radio', 'aria-hidden': 'true' }),
      h('span', { class: 'plus-txt' }, h('b', {}, o.name), h('span', {}, o.hint)),
      h('span', { class: 'plus-price' }, o.product.priceString));
    }));
    if (!pick) return;
    cta.textContent = trial(pick) ? '14 Tage gratis testen' : pick.key === 'lifetime' ? `Für ${pick.product.priceString} kaufen` : 'Abonnieren';
    const per = pick.key === 'monthly' ? 'pro Monat' : 'pro Jahr';
    legal.replaceChildren(
      pick.key === 'lifetime' ? 'Einmaliger Kauf, kein Abo. ' :
        `${trial(pick) ? `Nach 14 Tagen ${pick.product.priceString} ${per}` : `${pick.product.priceString} ${per}`}. Das Abo verlängert sich automatisch und ist jederzeit in den Apple-ID-Einstellungen kündbar. `,
      h('a', { href: TERMS_URL, target: '_blank', rel: 'noopener' }, 'Nutzungsbedingungen'), ' · ',
      h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener' }, 'Datenschutz'));
  };

  const busy = on => { cta.disabled = on; };
  cta.onclick = async () => {
    busy(true);
    try {
      await buyProduct(pick.id, pick.type);
      await refreshPurchases();
      if (isPlus()) { toast('Danke! Plus ist aktiv ❤︎'); close(); return; }
    } catch (err) {
      if (!/cancel/i.test(err?.message || '')) toast(`Kauf nicht möglich: ${err?.message || 'Fehler'}`);
    }
    busy(false);
  };

  const restore = async () => {
    try { await restoreStore(); await refreshPurchases(); } catch { /* gleich unten gemeldet */ }
    if (isPlus()) { toast('Plus wiederhergestellt ❤︎'); close(); } else toast('Kein Kauf gefunden');
  };

  container.replaceChildren(
    h('div', { class: 'plus' },
      h('div', { class: 'plus-mark', 'aria-hidden': 'true' }),
      h('h2', {}, 'Unterstütze 2nd Brain'),
      h('p', { class: 'plus-sub' }, '2nd Brain ist ohne Werbung und ohne Tracking. Mit Plus hilfst du, dass das so bleibt – und bekommst noch etwas dazu.'),
      h('ul', { class: 'plus-points' },
        h('li', {}, h('b', {}, 'Sync'), ' auf iPhone, iPad und Mac'),
        h('li', {}, h('b', {}, 'Wochenrückblick'), ' mit Themen und Kategorien'),
        h('li', {}, h('b', {}, 'Alles andere'), ' bleibt sowieso gratis')),
      opts.length ? [list, cta] : h('p', { class: 'small', style: 'text-align:center' }, 'Der App Store ist gerade nicht erreichbar. Bitte später nochmals versuchen.'),
      h('div', { class: 'plus-later' },
        h('button', { type: 'button', onclick: () => { answered('later'); close(); } }, 'Vielleicht später'),
        h('button', { type: 'button', onclick: () => { answered('never'); close(); } }, 'Nein danke')),
      h('button', { type: 'button', class: 'link plus-restore', onclick: restore }, 'Kauf wiederherstellen'),
      opts.length ? legal : null,
    ));
  paint();
}
