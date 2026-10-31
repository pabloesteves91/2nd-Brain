// Cloud-Sync über Firebase (optional).
// Firebase Console → Projekteinstellungen → "Meine Apps" → Web-App (</>) → firebaseConfig hier einfügen.
// Diese Werte sind öffentlich gedacht; die Daten schützen die Firestore-Regeln (siehe firestore.rules).
// null lassen = App arbeitet nur lokal, Sync ist ausgeblendet.

export const FIREBASE_CONFIG = null;
/* Beispiel:
export const FIREBASE_CONFIG = {
  apiKey: '…',
  authDomain: 'dein-projekt.firebaseapp.com',
  projectId: 'dein-projekt',
  storageBucket: 'dein-projekt.appspot.com',
  messagingSenderId: '…',
  appId: '…',
};
*/
