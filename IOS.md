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

> **Bundle-ID:** Voreingestellt ist `ch.fabioberta.secondbrain` in `capacitor.config.json`. Sie muss weltweit eindeutig sein.
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
   | Privacy - Photo Library Additions Usage Description | `Um Fotos, die du in 2nd Brain aufnimmst, in deiner Mediathek zu sichern.` |
   | Privacy - Face ID Usage Description | `Um deine Notizen mit Face ID zu schützen.` |
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
- **Datenschutzrichtlinie-URL:** `https://2ndbrain.ch/privacy.html`
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
- **Support-URL:** `https://2ndbrain.ch/#kontakt` · **Marketing-URL:** `https://2ndbrain.ch`
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

---

# Erweiterungen: Widget, Kurzbefehl, Teilen-Menü

Die Swift-Dateien liegen im Repo unter [`ios-extensions/`](ios-extensions). Du legst in Xcode zwei neue Targets an
und ziehst die Dateien hinein. Einmalig ca. 20–30 Minuten.

| Datei | gehört zu Target |
|---|---|
| `ios-extensions/Shared/AppGroup.swift` | **App** und **ShareExtension** |
| `ios-extensions/App/SecondBrainNativePlugin.swift` | **App** |
| `ios-extensions/App/MainViewController.swift` | **App** |
| `ios-extensions/App/NewThoughtIntent.swift` | **App** |
| `ios-extensions/App/de.lproj/AppShortcuts.strings` | **App** (Lokalisierung German, siehe E5b) |
| `ios-extensions/Widget/SecondBrainWidget.swift` | **SecondBrainWidget** |
| `ios-extensions/Share/ShareViewController.swift` | **ShareExtension** |

Vorher im Terminal:

```bash
git pull && npm install && npm run sync
```

## E1. App Group anlegen (für App und Teilen-Menü)

1. Xcode → links **App** (blau) → Target **App** → **Signing & Capabilities** → **+ Capability** → **App Groups**.
2. Im neuen Feld **+** → `group.ch.fabioberta.secondbrain` eintragen → OK. Das Häkchen muss gesetzt sein.

## E2. Dateien für die App hinzufügen

1. Im Finder den Ordner `2nd-Brain/ios-extensions/` öffnen.
2. Die Dateien `Shared/AppGroup.swift` und alle drei aus `App/` in Xcode links auf den gelben Ordner **App → App** ziehen.
3. Im Dialog: **Copy items if needed** anhaken, bei *Add to targets* nur **App** anhaken → **Finish**.

## E3. Plugin registrieren

1. Links **App → App → Main.storyboard** öffnen.
2. In der Mitte (Szene) den **Bridge View Controller** anklicken (links in der Szenen-Liste).
3. Rechts oben das Symbol **Identity Inspector** (Ausweis-Symbol, 4. Reiter) → bei **Class** `MainViewController` eintragen, Enter.
   *Module* auf **App** lassen bzw. „Inherit Module From Target“ anhaken.

## E4. URL-Schema `secondbrain://`

1. Target **App** → Reiter **Info** → ganz unten **URL Types** aufklappen → **+**.
2. *Identifier*: `ch.fabioberta.secondbrain` · *URL Schemes*: `secondbrain` · *Role*: Editor.

Test: App einmal starten, dann in Safari `secondbrain://new` eingeben → die App öffnet sich mit leerem Blatt.

## E5. Kurzbefehl „Neuer Gedanke“

Nichts weiter zu tun – kommt mit `NewThoughtIntent.swift` aus Schritt E2.
Nach dem nächsten Start der App findest du ihn in der **Kurzbefehle**-App unter *2nd Brain*, in Spotlight und bei Siri
(„Neuer Gedanke in 2nd Brain“). **Action-Button:** *Einstellungen → Action-Button → Kurzbefehl → 2nd Brain → Neuer Gedanke*.

## E5b. Siri auf Deutsch

Damit Siri „2nd Brain“ versteht (sonst denkt Siri z. B. an WhatsApp):

1. **Deutsch hinzufügen:** links das blaue **App** → oben unter **PROJECT** (nicht Targets) **App** → Reiter **Info** →
   **Localizations** → **+** → **German (de)** → im Dialog alles angehakt lassen → **Finish**.
2. **Phrasen-Datei:** gelben Ordner **App** anklicken → **File → Add Files to "App"…** → `~/2nd-Brain/ios-extensions/App/de.lproj`
   (den **Ordner** `de.lproj` wählen) → *Copy items if needed* ✓, Target **App** ✓ → Add.
   Prüfen: Datei `AppShortcuts.strings` anklicken → rechts unter *Localization* ist **German** angehakt.
3. **Alternativ-Namen:** **App → Info** → Rechtsklick → **Open As → Source Code** → den Inhalt von
   `ios-extensions/App/Info-Siri.plist.txt` (ab `<key>INAlternativeAppNames</key>`) direkt vor dem letzten `</dict>` einfügen → ⌘S.
4. **Wichtig:** Siri lernt die Sätze nur bei der Installation. App vom iPhone **löschen** und mit ▶︎ neu installieren,
   danach die App einmal öffnen und 1–2 Minuten warten.

Testen – sag zu Siri:
- „**Neuer Gedanke in Second Brain**“
- „**Second Brain neuer Gedanke**“
- „**Notiz in Second Brain**“

Tipp: Am zuverlässigsten ist der **Action-Button** oder ein Kurzbefehl auf dem Homescreen
(Kurzbefehle-App → *Neuer Gedanke* lange drücken → *Zum Home-Bildschirm*).

## E6. Widget

1. Xcode → **File → New → Target…** → **iOS** → **Widget Extension** → Next.
2. *Product Name*: `SecondBrainWidget` · **Include Live Activity** und **Include Control** und **Include Configuration App Intent**: **aus** → Finish.
   Frage „Activate scheme?“ → **Activate**.
3. Links erscheint der Ordner **SecondBrainWidget**. Darin alle `.swift`-Dateien **löschen** (Rechtsklick → Delete → Move to Trash).
   `Info.plist` und `Assets.xcassets` bleiben.
4. `ios-extensions/Widget/SecondBrainWidget.swift` in den Ordner **SecondBrainWidget** ziehen → *Copy items if needed*,
   Target nur **SecondBrainWidget** → Finish.
5. Target **SecondBrainWidget** → **General** → *Minimum Deployments*: **iOS 16.0** (oder höher).
6. **Signing & Capabilities**: Team wählen. Bundle-ID ist automatisch `ch.fabioberta.secondbrain.SecondBrainWidget`.

Test: App auf dem iPhone starten → Homescreen lange drücken → **Bearbeiten → Widget hinzufügen** → „2nd Brain“.
Für den Sperrbildschirm: Sperrbildschirm lange drücken → **Anpassen** → Sperrbildschirm → Widgets → 2nd Brain.

## E7. Teilen-Menü

1. **File → New → Target…** → **iOS** → **Share Extension** → Next.
2. *Product Name*: `ShareExtension` → Finish → **Activate**.
3. Im neuen Ordner **ShareExtension**: `ShareViewController.swift` und `MainInterface.storyboard` **löschen** (Move to Trash).
4. `ios-extensions/Share/ShareViewController.swift` **und** `ios-extensions/Shared/AppGroup.swift` hineinziehen →
   *Copy items if needed*, Target nur **ShareExtension**.
   (AppGroup.swift ist dann zweimal im Projekt – das ist richtig: je eine Kopie pro Target.)
5. **ShareExtension → Info.plist** → Rechtsklick → **Open As → Source Code** → den Block `<key>NSExtension</key> <dict>…</dict>`
   durch den Inhalt von `ios-extensions/Share/Info-NSExtension.plist.txt` ersetzen → ⌘S.
6. Target **ShareExtension** → **Signing & Capabilities**: Team wählen → **+ Capability → App Groups** →
   dasselbe `group.ch.fabioberta.secondbrain` anhaken.
7. Target **ShareExtension** → **General** → *Minimum Deployments* gleich wie die App (z. B. iOS 15.0) und *Display Name* `2nd Brain`.

Test: In Safari eine Seite öffnen → **Teilen** → in der App-Reihe ganz rechts **Mehr** → „2nd Brain“ aktivieren und nach vorne ziehen.
Dann Teilen → 2nd Brain → Gedanke schreiben → **Sichern**. Beim nächsten Öffnen von 2nd Brain erscheint
„1 geteilte Notiz übernommen“, die Notiz ist unter *heute* zu finden.

## E8. Starten

Oben links das Schema wieder auf **App** stellen (nicht SecondBrainWidget/ShareExtension) → iPhone wählen → **▶︎**.

## Probleme bei den Erweiterungen

| Problem | Lösung |
|---|---|
| `Cannot find 'AppGroup' in scope` | `AppGroup.swift` fehlt im betroffenen Target → Datei anklicken → rechts *Target Membership* anhaken |
| Geteilte Notizen kommen nicht an | App Group in **beiden** Targets exakt gleich geschrieben und angehakt? Storyboard-Klasse `MainViewController` gesetzt (E3)? |
| `'main' attribute can only apply to one type` (Widget) | In E6.3 nicht alle Vorlagen-Dateien gelöscht – die übrige `…Bundle.swift` löschen |
| Widget fehlt in der Auswahl | App einmal per ▶︎ starten; iPhone neu starten hilft manchmal |
| Kurzbefehl fehlt | App einmal öffnen; in der Kurzbefehle-App unter *App-Kurzbefehle* nachsehen |
| Fehler beim Archivieren wegen Extensions | Alle drei Targets brauchen dasselbe Team; Build-Nummern von Widget/Share = App |

Bei einem Kompilierfehler: Screenshot der roten Meldung schicken.

---

# App Store auf Englisch

App Store Connect → App → links **„+“ neben der Sprache** (oben rechts bei der Version) → **English (U.S.)** und
**English (U.K.)** hinzufügen. Bildschirmfotos: Ordner `en-…` aus `appstore-en.zip`.

- **Name:** `2nd Brain`
- **Subtitle:** `Thoughts without distraction`
- **Promotional Text:**
  > Open. Write. Close. A blank page is ready the moment you open the app – sort your thoughts calmly in the evening. New: 2nd Brain Plus with sync and weekly review.
- **Keywords:** `notes,ideas,thoughts,journal,minimal,focus,diary,quick note,memo,brain dump,inbox,daily review`
- **Description:**
  > Open. Write. Close.
  >
  > 2nd Brain is a blank page for your thoughts – no folders, no distractions. Open the app and start typing right away. Attach photos, add a #category, put the note away. In the evening you calmly sort what stuck with you during the day.
  >
  > • Write instantly – a blank page with the cursor ready, everything saves automatically
  > • Images – take or attach photos, view them large, zoom and save to Photos
  > • #Categories & lists – type # and 2nd Brain suggests categories, lists continue by themselves
  > • Evening review – your day at a glance, sort, pin and archive
  > • Reminders – turn a #task into a reminder at the time you choose
  > • Share – as text or as a link that opens in the other person’s 2nd Brain
  > • Widget, Siri & share sheet – a new thought in one tap
  > • Face ID – private thoughts stay private
  > • iPad & Mac – large layout, keyboard shortcuts, mouse and trackpad
  > • Accessibility – VoiceOver, larger text, high contrast, reduced motion
  >
  > 2nd Brain Plus (optional): sync on iPhone, iPad and Mac plus the weekly review. Monthly, yearly (14 days free) or once for a lifetime. Everyone who used 2nd Brain before Plus gets it free forever.
  >
  > No ads. No tracking. Without an account everything stays on your device.
  >
  > Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
  > Privacy Policy: https://2ndbrain.ch/en/privacy.html
- **What’s New (2.3):**
  > New: 2nd Brain is now available in English. 2nd Brain Plus brings sync on all your devices and the weekly review – monthly, yearly (14 days free) or once for a lifetime. Everyone who used 2nd Brain before gets Plus free forever. Plus: safer delete confirmations and no keyboard during the introduction.
- **Support URL:** `https://2ndbrain.ch/en/#kontakt` · **Marketing URL:** `https://2ndbrain.ch/en/` ·
  **Privacy Policy URL (App Information, English):** `https://2ndbrain.ch/en/privacy.html`

### iOS-Texte auf Englisch (Xcode, einmalig)
1. Projekt **App** (blau) → **Info** → **Localizations**: **English** und **German** müssen in der Liste stehen
   (sonst **+** → German).
2. Basissprache ist **German** (Default) – so lassen. Finder: die Ordner `ios-extensions/App/en.lproj`
   (InfoPlist, Localizable, AppShortcuts) und `ios-extensions/App/de.lproj` (InfoPlist, AppShortcuts) in Xcode auf
   **App → App** ziehen → *Copy items if needed*, Target nur **App**. Danach steht bei English „3 Files Localized“.
3. Den Inhalt von `NewThoughtIntent.swift`, `Widget/SecondBrainWidget.swift` und `Share/ShareViewController.swift`
   in Xcode ersetzen (`pbcopy < …`, dann ⌘A ⌘V ⌘S).

---

# Update 2.4 in Xcode (Widget „Schnellaktionen“, Spracheingabe, Siri „Gedanken aufschreiben“)

```bash
cd ~/2nd-Brain && git pull && npm run sync
```

1. **Swift- und Text-Dateien** kopiert `npm run sync` jetzt automatisch über die Kopien im Xcode-Projekt
   (Skript `scripts/ios-files.mjs`, einzeln: `npm run ios:files`). Die Ausgabe zeigt, was aktualisiert wurde.
2. Steht dort **„nicht im Xcode-Projekt“**, die genannte Datei **einmal** in Xcode hinzufügen (Finder →
   `ios-extensions/…` auf den passenden gelben Ordner ziehen, *Copy items if needed*, richtiges Target) – danach
   aktualisiert `npm run sync` sie ebenfalls.
3. **Info.plist** (App → App → Info) – zwei Zeilen mit **+** hinzufügen:
   - *Privacy – Microphone Usage Description*: `Um Gesprochenes in Text umzuwandeln.`
   - *Privacy – Speech Recognition Usage Description*: `Um Gesprochenes in Text umzuwandeln – auf deinem Gerät.`
4. **Version 2.4**, Build 1 (App, SecondBrainWidget, ShareExtension) → **⇧⌘K** (Clean Build Folder), App auf dem
   iPhone löschen → ▶ Run → auf dem iPhone testen:
   - Menü **sprechen** → Erlaubnis geben → sprechen → Text erscheint, nach kurzer Stille stoppt es.
   - „Hey Siri, Neuer Gedanke in 2nd Brain“ → 2nd Brain öffnet sich, das Mikrofon hört sofort zu → sprechen → Text wird gespeichert →
     App öffnen: die Notiz ist da. (Neue Siri-Phrasen erkennt iOS erst nach dem ersten Start der neuen Version.)
   - ··· → Konto → **Passwort vergessen?** mit deiner E-Mail → Mail kommt.

---

# App-Store-Texte ab 2.3 (Notizen, Journal & Erinnerungen in einer App)

> **Pflicht bei Abos:** Der EULA-Link muss in der Beschreibung **jeder** Sprache stehen (sonst stoppt Apple die Prüfung).
> App-Informationen → Lizenzvereinbarung = „Standardlizenzvereinbarung von Apple“.

## Deutsch
- **Untertitel:** `Notizen, Journal & Erinnerung`
- **Werbetext:**
  > Notizen, Journal und Erinnerungen in einer ruhigen App – öffnen, schreiben, fertig. Am Abend in Ruhe sortieren. Gratis, ohne Werbung.
- **Keywords:** `notizen,journal,tagebuch,erinnerungen,aufgaben,ideen,gedanken,minimal,fokus,todo,memo,rückblick`
- **Beschreibung:**
  > Öffnen. Schreiben. Schliessen.
  >
  > 2nd Brain vereint drei Apps in einer – Notizen, Journal und Erinnerungen. Ruhig, schnell und gratis.
  >
  > 📝 NOTIZEN
  > Beim Öffnen wartet ein leeres Blatt mit Cursor. Gedanke aufschreiben, Foto anhängen, weglegen – fertig. Tippe # und 2nd Brain schlägt Kategorien vor, Listen setzen sich selbst fort, Links lassen sich antippen.
  >
  > 📖 JOURNAL
  > Am Abend zeigt dir der Tagesrückblick alle Gedanken des Tages – sortieren, pinnen, archivieren. Ab und zu tauchen alte Gedanken von vor einer Woche, einem Monat oder einem Jahr wieder auf. Mit Plus kommt der Wochenrückblick mit Themen und Kategorien dazu.
  >
  > ⏰ ERINNERUNGEN
  > Mit #aufgabe wird jede Notiz zur Aufgabe. Ein Tipp auf „erinnern“, Zeit wählen – und 2nd Brain erinnert dich mit einer Mitteilung. Funktioniert auch, wenn die Notiz mehrere #Tags hat.
  >
  > UND AUSSERDEM
  > • Widget, Siri-Kurzbefehl „Neuer Gedanke“ und Teilen-Menü
  > • Notizen als Text oder Link teilen
  > • Face ID für private Gedanken
  > • iPhone, iPad und Mac – mit Tastaturkürzeln und Trackpad
  > • Bedienungshilfen: VoiceOver, grössere Schrift, hoher Kontrast, reduzierte Bewegung
  > • Deutsch und Englisch
  >
  > GRATIS – UND PLUS, WENN DU MAGST
  > Notizen, Journal und Erinnerungen sind gratis, ohne Werbung und ohne Tracking. Mit 2nd Brain Plus unterstützt du die App und bekommst Sync auf iPhone, iPad und Mac und den Wochenrückblick: CHF 1 im Monat, CHF 9 im Jahr (14 Tage gratis) oder einmalig CHF 24. Wer 2nd Brain schon vor Plus genutzt hat, bekommt Plus für immer geschenkt.
  >
  > Nutzungsbedingungen (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
  > Datenschutz: https://2ndbrain.ch/privacy.html
- **Neuerungen in dieser Version (2.3):**
  > • Notizen, Journal & Erinnerungen in einer App – jetzt auch auf Englisch
  > • Neu: 2nd Brain Plus mit Sync auf allen Geräten und Wochenrückblick – monatlich, jährlich (14 Tage gratis) oder einmalig für immer. Wer 2nd Brain schon vorher genutzt hat, bekommt Plus für immer geschenkt.
  > • Eigene Kategorien werden jetzt mit synchronisiert – auch nach Neuinstallation und auf neuen Geräten
  > • Erinnerungen auch bei Notizen mit mehreren #Tags (z. B. #app #aufgabe)
  > • Foto aufnehmen mit der Kamera repariert
  > • Abo direkt in der App verwalten, sichere Rückfrage beim Löschen, keine Tastatur während der Einführung

## English
- **Subtitle:** `Notes, journal & reminders`
- **Promotional Text:**
  > Notes, journal and reminders in one calm app – open, write, done. Sort it all calmly in the evening. Free, no ads.
- **Keywords:** `notes,journal,diary,reminders,tasks,ideas,thoughts,minimal,focus,todo,memo,review,daily`
- **Description:**
  > Open. Write. Close.
  >
  > 2nd Brain combines three apps in one – notes, journal and reminders. Calm, fast and free.
  >
  > 📝 NOTES
  > A blank page with a cursor is waiting when you open the app. Write down a thought, attach a photo, put it away – done. Type # and 2nd Brain suggests categories, lists continue by themselves, links are tappable.
  >
  > 📖 JOURNAL
  > In the evening the daily review shows all of the day’s thoughts – sort, pin, archive. Now and then old thoughts from a week, a month or a year ago resurface. With Plus you also get the weekly review with topics and categories.
  >
  > ⏰ REMINDERS
  > Add #task and any note becomes a task. Tap “remind me”, pick a time – and 2nd Brain reminds you with a notification. Works even when a note has several #tags.
  >
  > AND ALSO
  > • Widget, Siri shortcut “New thought” and share sheet
  > • Share notes as text or as a link
  > • Face ID for private thoughts
  > • iPhone, iPad and Mac – with keyboard shortcuts and trackpad
  > • Accessibility: VoiceOver, larger text, high contrast, reduced motion
  > • English and German
  >
  > FREE – AND PLUS IF YOU LIKE
  > Notes, journal and reminders are free, without ads and tracking. With 2nd Brain Plus you support the app and get sync on iPhone, iPad and Mac plus the weekly review: monthly, yearly (14 days free) or once for a lifetime. Everyone who used 2nd Brain before Plus gets it free forever.
  >
  > Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
  > Privacy Policy: https://2ndbrain.ch/en/privacy.html
- **What’s New (2.3):**
  > • Notes, journal & reminders in one app – now also in English
  > • New: 2nd Brain Plus with sync on all devices and the weekly review – monthly, yearly (14 days free) or once for a lifetime. Everyone who used 2nd Brain before gets Plus free forever.
  > • Your own categories now sync too – also after reinstalling and on new devices
  > • Reminders also for notes with several #tags (e.g. #app #task)
  > • Taking photos with the camera fixed
  > • Manage your subscription right in the app, safer delete confirmation, no keyboard during the introduction
