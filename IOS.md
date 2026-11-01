# 2nd Brain als iOS-App – Schritt für Schritt

Die Web-App wird mit **Capacitor** in eine echte iOS-App verpackt. Den Code musst du nicht umbauen,
alles Nötige liegt schon im Repo. Du brauchst nur deinen Mac, Xcode und deinen Apple-Developer-Account.

Dauer beim ersten Mal: etwa 45–60 Minuten (ohne Wartezeit auf die App-Prüfung).

---

## 1. Mac vorbereiten (einmalig)

1. **Xcode** aus dem Mac App Store installieren, einmal öffnen und die Zusatzkomponenten installieren lassen
   (inkl. „iOS“-Plattform).
2. **Xcode Command Line Tools** im Terminal installieren:
   ```bash
   xcode-select --install
   ```
3. **Node.js 20 oder neuer** von <https://nodejs.org> (LTS) installieren. Prüfen:
   ```bash
   node -v
   ```
4. In Xcode → *Settings → Accounts* → **+** → mit deiner Apple-ID (Developer-Account) anmelden.

## 2. Projekt holen und iOS-Projekt erzeugen (einmalig)

```bash
git clone https://github.com/pabloesteves91/2nd-Brain.git
```
```bash
cd 2nd-Brain
```
```bash
npm install
```
```bash
npm run build
```
```bash
npx cap add ios --packagemanager SPM
```
```bash
npx cap open ios
```

`npx cap add ios` legt den Ordner `ios/` an (das Xcode-Projekt). Danach öffnet sich Xcode.
Es wird der in Xcode eingebaute **Swift Package Manager** verwendet – CocoaPods brauchst du nicht.
Warte nach dem Öffnen, bis Xcode unten „Resolving Package Graph“ abgeschlossen hat.

> **Bundle-ID:** Voreingestellt ist `ch.secondbrain.app` in `capacitor.config.json`. Sie muss weltweit eindeutig sein.
> Falls Xcode meldet, sie sei vergeben, nimm z. B. `ch.pabloesteves.secondbrain`, trage sie in
> `capacitor.config.json` **und** in Xcode ein und führe `npx cap sync ios` aus.

## 3. In Xcode einrichten (einmalig)

Links im Navigator **App** (blaues Symbol) → Target **App** auswählen.

1. **General**
   - *Display Name*: `2nd Brain`
   - *Minimum Deployments*: iOS 15.0 (Standard ist ok)
   - *Device Orientation*: nur **Portrait** anhaken
2. **Signing & Capabilities**
   - *Automatically manage signing* anhaken
   - *Team*: dein Developer-Team wählen
   - *Bundle Identifier*: wie oben
   - **+ Capability** → **Sign in with Apple** hinzufügen
3. **Info** (das ist die `Info.plist`) – mit **+** diese Zeilen hinzufügen:

   | Key | Wert |
   |---|---|
   | Privacy - Camera Usage Description | `Um Fotos zu deinen Notizen hinzuzufügen.` |
   | Privacy - Photo Library Usage Description | `Um Bilder aus deiner Mediathek zu Notizen hinzuzufügen.` |
   | App Uses Non-Exempt Encryption | `NO` |

4. **App-Icon:** Im Navigator `App → App → Assets` → **AppIcon** öffnen und `icons/icon-1024.png`
   aus dem Repo in das 1024-Feld ziehen.
5. **Splash-Screen (optional):** `Assets → Splash` – die Bilder durch eine schlichte Fläche in `#fbfaf7` ersetzen
   oder so lassen.

## 4. Firebase für „Mit Apple anmelden“ (einmalig)

1. Firebase Console → **Projekteinstellungen → Allgemein → App hinzufügen → iOS (Apple)** →
   *Apple-Bundle-ID* = deine Bundle-ID aus Xcode → App registrieren. Die angebotene `GoogleService-Info.plist`
   brauchst du **nicht** (einfach „Weiter“ bis zum Ende). Firebase erkennt so die Apple-Anmeldungen deiner App.
2. Firebase Console → **Authentication → Sign-in method → Neuer Anbieter → Apple** → aktivieren → Speichern.
   Die Felder Services-ID, Team-ID und Key kannst du **leer lassen**, sie werden nur für Apple-Login im Web gebraucht.
3. **Authentication → Settings → Authorized domains:** `localhost` muss in der Liste stehen (ist Standard).
   Die App läuft intern unter `capacitor://localhost`.
4. Prüfen, dass die **Firestore-** und **Storage-Regeln** aus `firestore.rules` / `storage.rules` veröffentlicht sind.

## 5. Auf deinem iPhone testen

1. iPhone per Kabel anschliessen und entsperren, bei der Frage „Diesem Computer vertrauen?“ auf Vertrauen tippen.
2. Auf dem iPhone: *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus* → an (Neustart).
3. In Xcode oben dein iPhone als Ziel wählen → **▶︎ (Run)**.
4. Testen:
   - App öffnen → sofort schreiben → App schliessen → nach 5 Min. wieder öffnen → leeres Blatt
   - **bild** → Kamera/Mediathek
   - ··· → **Mit Apple anmelden** bzw. E-Mail → Notiz auf einem zweiten Gerät oder im Web prüfen
   - Abend-Hinweis einschalten → Zeit 1–2 Minuten in die Zukunft stellen → Mitteilung erlauben → Mitteilung kommt,
     Antippen öffnet den Rückblick

## 6. App in App Store Connect anlegen (einmalig)

<https://appstoreconnect.apple.com> → **Apps → + → Neue App**

- Plattform: iOS · Name: `2nd Brain` (falls vergeben z. B. `2nd Brain – Notizen`) · Sprache: Deutsch
- Bundle-ID: die aus Xcode · SKU: z. B. `2ndbrain001`
- **App-Datenschutz:** *Datenerfassung: Ja* →
  - **Kontaktinformationen → E-Mail-Adresse**: App-Funktionalität, mit Identität verknüpft, kein Tracking
  - **Nutzerinhalte → Andere Nutzerinhalte** und **Fotos**: App-Funktionalität, mit Identität verknüpft, kein Tracking
- **Datenschutzrichtlinie-URL:** `https://pabloesteves91.github.io/2nd-Brain/privacy.html`
- Kategorie: *Produktivität*

## 7. Hochladen (TestFlight)

1. In Xcode oben als Ziel **Any iOS Device (arm64)** wählen.
2. **Product → Archive**. Nach dem Build öffnet sich der *Organizer*.
3. **Distribute App → App Store Connect → Upload** → Standardoptionen → Upload.
4. Nach 5–30 Min. erscheint der Build in App Store Connect unter **TestFlight**.
   Dort dich selbst als internen Tester eintragen → TestFlight-App auf dem iPhone → installieren.

## 8. Zur Prüfung einreichen

In App Store Connect → deine App → Version **1.0**:

- **Screenshots:** mindestens für 6,9" bzw. 6,7" iPhone (z. B. im Simulator *iPhone 16 Pro Max* mit ⌘S aufnehmen).
  Vorschlag: leeres Blatt · Notiz mit Bild · Rückblick „Heute“ · Einstellungen in Dunkel.
- **Beschreibung** (Vorschlag):
  > Öffnen. Schreiben. Schliessen.
  > 2nd Brain ist ein leeres Blatt für deine Gedanken – ohne Ordner, ohne Ablenkung. Beim Öffnen kannst du sofort
  > schreiben und Bilder anhängen. Am Abend sortierst du im Tagesrückblick, was hängen geblieben ist.
- **Untertitel:** `Gedanken ohne Ablenkung` · **Keywords:** `notizen,ideen,gedanken,minimal,journal,tagebuch,fokus`
- **Support-URL:** `https://github.com/pabloesteves91/2nd-Brain`
- **App-Prüfungsinformationen:** Ein **Demo-Konto** (E-Mail + Passwort) angeben, das du vorher in der App angelegt hast,
  und dazu schreiben: „Die App funktioniert auch ohne Konto; das Konto dient nur dem optionalen Sync.“
- Build auswählen → **Zur Prüfung hinzufügen** → Einreichen. Die Prüfung dauert meist 1–2 Tage.

## 9. Updates veröffentlichen

Nach jeder Änderung am Code:

```bash
git pull
```
```bash
npm run sync
```

Dann in Xcode unter *General* die **Build**-Nummer erhöhen (1 → 2 → 3 …, bei neuen Funktionen auch die *Version*),
**Product → Archive** → hochladen → in App Store Connect einreichen.

---

### Häufige Probleme

| Problem | Lösung |
|---|---|
| „No signing certificate“ | Xcode → Settings → Accounts → Team auswählen → *Manage Certificates* → **+ Apple Development** |
| „Bundle identifier is not available“ | andere Bundle-ID wählen (siehe Schritt 2) |
| Apple-Login: „Anmeldung abgebrochen“ oder Fehler 1000 | Capability *Sign in with Apple* fehlt (Schritt 3.2) oder Apple ist in Firebase nicht aktiviert (Schritt 4) |
| Apple-Login: `auth/invalid-credential` / „audience“ | iOS-App mit genau dieser Bundle-ID in Firebase registrieren (Schritt 4.1); Apple-Anbieter aktiv? |
| Keine Mitteilung | iPhone-Einstellungen → Mitteilungen → 2nd Brain → erlauben |
| Änderungen fehlen in der App | `npm run sync` vergessen |
