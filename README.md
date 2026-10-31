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

## Auf GitHub Pages veröffentlichen

1. Repo → **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
2. Auf `main` pushen (oder den Workflow „Deploy to GitHub Pages“ manuell starten).
3. Die App liegt dann unter `https://<user>.github.io/2nd-Brain/`.
4. Auf dem iPhone in Safari öffnen → Teilen → **„Zum Home-Bildschirm“** – startet dann wie eine App.

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
js/config.js          Firebase-Konfiguration
firestore.rules       Firestore-Regeln
storage.rules         Storage-Regeln
```

## Später: App Store

Die App hat keinen Build-Schritt und lässt sich direkt mit [Capacitor](https://capacitorjs.com) einpacken:

```bash
npm init -y && npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "2nd Brain" ch.secondbrain.app --web-dir .
npx cap add ios && npx cap open ios
```

Native Extras für die Store-Version: echte Abend-Erinnerung (`@capacitor/local-notifications`),
Kamera (`@capacitor/camera`), Haptik. Für Google-Login in der nativen App eignet sich
`@capacitor-firebase/authentication`; zusätzlich verlangt Apple „Mit Apple anmelden“, sobald Google-Login angeboten wird.
