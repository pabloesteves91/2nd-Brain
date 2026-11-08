import { isEn } from './i18n.js';
// Cloud-Sync über Firebase.
// Diese Werte sind öffentlich gedacht; die Daten schützen die Regeln (firestore.rules, storage.rules).
// FIREBASE_CONFIG = null setzen, um die App nur lokal zu nutzen.

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD2537rgYreXFrLjzUUj-2keAHuq6PH2sE',
  authDomain: 'dnbrain-7dbe3.firebaseapp.com',
  projectId: 'dnbrain-7dbe3',
  storageBucket: 'dnbrain-7dbe3.firebasestorage.app',
  messagingSenderId: '122752634842',
  appId: '1:122752634842:web:ca7a0c18416cc4a641bae3',
};

// Version der Web-App (in der iOS-App kommt die Version aus Xcode).
export const PLUS_IDS = {
  monthly: 'ch.fabioberta.secondbrain.plus.monthly',
  yearly: 'ch.fabioberta.secondbrain.plus.yearly',
  lifetime: 'ch.fabioberta.secondbrain.plus.lifetime',
};
// Sync-Konten, die vor diesem Tag angelegt wurden, gehören frühen Nutzern → Plus für immer geschenkt.
export const PLUS_SINCE = '2026-11-08';
// Website-Seiten in der Sprache der App (englisch unter /en/).
export const siteUrl = (page = '') => `https://2ndbrain.ch/${isEn() ? 'en/' : ''}${page}`;

export const APP_VERSION = '2.3';
export const SUPPORT_EMAIL = 'fabioberta@me.com';
