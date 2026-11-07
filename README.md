# 2nd Brain

**Öffnen. Schreiben. Schliessen.**

Eine minimalistische Notiz-App ohne Ablenkung. Beim Öffnen wartet sofort ein leeres Blatt –
kein Ordner, keine Liste, keine Buttons. Gedanken aufschreiben, optional Bilder anhängen, App schliessen.
Am Abend gibt's einen ruhigen Tagesrückblick, in dem man die Ideen des Tages sortiert.

Zuerst als Web-App (PWA) über GitHub Pages, später per Capacitor als iOS-App.

## Funktionen

- **Sofort schreiben** – Cursor steht beim Start im Textfeld, Auto-Save beim Tippen.
- **Immer ein leeres Blatt** – nach X Minuten im Hintergrund (Standard 5, einstellbar; 0 = jedes Mal).
- **Bilder** – über „bild“ (Kamera/Galerie) oder per Einfügen; werden automatisch verkleinert.
- **Heute** – Tagesrückblick: Anzahl Gedanken, häufige Stichworte (antippen = filtern),
  Kategorie zuweisen, pinnen, archivieren, löschen, per Griff (⋮⋮) umsortieren, „Tag abschliessen“.
  Mit ‹ › durch frühere Tage blättern.
- **Alle** – alle Notizen nach Tagen, Suche, Filter nach Kategorie, Archiv.
- **Einstellungen (···)** – Schrift (Sans/Serif/Mono), Grösse, Hell/Dunkel/Auto, Abend-Hinweis,
  eigene Kategorien, Cloud-Sync, Export/Import (JSON).
- **Offline-first** – alles liegt zuerst lokal (IndexedDB); funktioniert auch ohne Netz und ohne Konto.
- **Cloud-Sync (optional)** – Firebase: Notizen in Firestore, Bilder in Firebase Storage.

Das Menü unten ist bewusst leise und blendet sich beim Tippen fast ganz aus.

## Lokal starten

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen.

## Website

Die Website **https://2ndbrain.ch** (Startseite, Datenschutz, Empfangsseite für geteilte Notizen, Universal Links)
liegt im eigenen Repo [`pabloesteves91/2ndbrain-webseite`](https://github.com/pabloesteves91/2ndbrain-webseite).
Eine Web-App wird nicht mehr veröffentlicht; dieser Ordner läuft lokal im Browser nur noch zum Entwickeln.

## Cloud-Sync mit Firebase einrichten

1. **Firebase Console** → dein Projekt → Projekteinstellungen → *Meine Apps* → **Web-App (`</>`) hinzufügen**.
   Die angezeigte `firebaseConfig` in [`js/config.js`](js/config.js) als `FIREBASE_CONFIG` eintragen.
2. **Authentication** → *Sign-in method* → **E-Mail/Passwort** und **Google** aktivieren.
3. **Authentication → Settings → Authorized domains** → `<user>.github.io` hinzufügen (für `localhost` ist es schon drin).
4. **Firestore Database** → *Regeln* → Inhalt von [`firestore.rules`](firestore.rules) einfügen → Veröffentlichen.
5. **Storage** → *Erste Schritte* (Bucket anlegen) → *Regeln* → Inhalt von [`storage.rules`](storage.rules) einfügen → Veröffentlichen.

   Alternativ mit der Firebase-CLI: `firebase deploy --only firestore:rules,storage`.
6. App öffnen → ··· → *Cloud-Sync* → anmelden. Fertig – auf jedem Gerät mit demselben Konto anmelden.

Die Werte in `firebaseConfig` sind öffentlich gedacht. Geschützt werden die Daten durch die Regeln:
jede Person kann nur unter `users/{eigene uid}/…` lesen und schreiben.

### Datenmodell

```
Firestore  users/{uid}/notes/{noteId}
           { text, images: [imageId], created_at, updated_at, day, category,
             pinned, status: inbox|sorted|archived, sort_order, deleted, server_updated_at }
Storage    users/{uid}/images/{imageId}.jpg
```

Sync: lokale Änderungen werden markiert und hochgeladen; abgeholt wird alles mit
`server_updated_at` seit dem letzten Abgleich. Bei Konflikten gewinnt die jüngste Änderung.
Gelöschte Notizen werden als `deleted` markiert, damit das Löschen auf allen Geräten ankommt.

## Projektstruktur

```
index.html            App-Shell
styles.css            Design (Hell/Dunkel, Safe-Areas fürs iPhone)
manifest.webmanifest  PWA-Manifest
sw.js                 Service Worker (offline)
js/app.js             Start, Menü, Sheets, „leeres Blatt beim Öffnen“
js/editor.js          Schreibfeld, Auto-Save, Bilder
js/review.js          Tagesrückblick
js/all.js             Alle Notizen / Suche / Archiv
js/settings*.js       Einstellungen
js/db.js              IndexedDB
js/images.js          Bilder verkleinern & speichern
js/sync.js            Firebase-Sync
js/native.js          iOS-Funktionen (Capacitor), im Browser ohne Wirkung
js/config.js          Firebase-Konfiguration
firestore.rules       Firestore-Regeln
storage.rules         Storage-Regeln
```

## iOS-App (Xcode / App Store)

Die App wird mit [Capacitor](https://capacitorjs.com) zur nativen iOS-App – ohne Umbau des Codes.
In der iOS-App gibt es zusätzlich echte Abend-Mitteilungen, „Mit Apple anmelden“ und Haptik.

**Schritt-für-Schritt-Anleitung: [IOS.md](IOS.md)**

Kurzfassung auf dem Mac:

```bash
npm install && npm run build && npx cap add ios --packagemanager SPM && npx cap open ios
```

Datenschutzerklärung (für den App Store): <https://2ndbrain.ch/privacy.html> (im Website-Repo)
