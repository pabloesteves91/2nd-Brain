# 2nd Brain als Android-App – Schritt für Schritt

Die Android-App ist dieselbe App wie unter iOS (gleicher Code in `js/`), verpackt mit **Capacitor**.
Anders als bei iOS liegt das ganze Android-Projekt schon fertig im Repo (Ordner `android/`) –
Widgets, „Teilen mit 2nd Brain“, Verknüpfungen und Icons sind drin. Du musst keine Dateien von Hand kopieren.

Stand: Version **2.4** (mit Todo-Listen und Widget „Schnellaktionen“).

---

## 1. Mac vorbereiten (einmalig)

1. **Android Studio** von <https://developer.android.com/studio> herunterladen
   („Mac mit Apple-Chip“ oder „Mac mit Intel-Chip“ – siehe  → Über diesen Mac).
2. `.dmg` öffnen, **Android Studio** in **Programme** ziehen, starten.
3. Einrichtungsassistent: **Standard** → Lizenzen akzeptieren → **Finish** (lädt SDK und Emulator, dauert ein paar Minuten).

Node.js und Git hast du schon von iOS.

## 2. Projekt holen und öffnen

```bash
cd ~/2nd-Brain
```
```bash
git pull && npm install && npm run sync:android
```

Android Studio → **Open** → Ordner `2nd-Brain/android` → **Open**. Beim ersten Mal lädt Gradle ein paar Minuten
(Balken unten rechts). Fragt es nach einem Gradle-/AGP-Update: **nicht** aktualisieren („Don't ask again“).

> Nach jeder Änderung am Code: `npm run sync:android` und in Android Studio nochmals ▶.

## 3. Im Emulator testen (ohne Android-Handy)

1. Rechts **Device Manager** (Handy-Symbol) → **+** → **Create Virtual Device** → **Pixel 8** → Next.
2. System-Image mit **Play-Store-Symbol** wählen (empfohlen) → Download → Next → **Finish**.
3. Oben in der Leiste den Pixel wählen → **▶ Run**.

Testliste:

| Was | So testen |
|---|---|
| Notiz, #Kategorie, Foto | schreiben, `#` tippen, Bild-Knopf |
| Todo | Menü **todo** → Kreise antippen, 2× Enter beendet die Liste |
| Erinnerung | Notiz mit `#aufgabe` → „erinnern“ → in 2 Minuten → App schliessen, warten |
| Tagesrückblick | ··· → Abend-Erinnerung einschalten |
| Zurück-Taste | Einstellungen öffnen → unten ◁ (oder Wisch vom Rand) schliesst das Blatt |
| Widgets | Home-Bildschirm lange drücken → **Widgets** → 2nd Brain → „Neuer Gedanke“ und „Schnellaktionen“ |
| Verknüpfungen | App-Icon lange drücken → Neuer Gedanke / Todo-Liste / Foto / Heute |
| Teilen | Chrome → Seite → Teilen → **2nd Brain** → App öffnen → Notiz ist da |
| Fingerabdruck | ··· → „Mit Fingerabdruck sperren“; im Emulator: ⋯ (Extended Controls) → **Fingerprint** → Touch Sensor |
| Sync | ··· → Konto → E-Mail + Passwort (Google-Anmeldung gibt es auf Android vorerst nicht) |

## 4. Google Play Console (einmalig)

1. <https://play.google.com/console> → Konto erstellen (**25 USD einmalig**), Identität bestätigen.
2. **App erstellen**: Name `2nd Brain`, Standardsprache **Deutsch (Schweiz)** oder Deutsch, **App**, **Kostenlos**.
3. Unter **App-Inhalte** alles ausfüllen:
   - **Datenschutzerklärung:** `https://2ndbrain.ch/privacy.html`
   - **Werbung:** Nein
   - **App-Zugriff:** Alle Funktionen ohne Anmeldung verfügbar
   - **Inhaltseinstufung:** Fragebogen → Kategorie „Dienstprogramm/Produktivität“, überall Nein
   - **Zielgruppe:** 13+ (oder 18+)
   - **Datensicherheit:** Daten werden erhoben: **E-Mail-Adresse** (Konto, optional) und **Nutzerinhalte**
     (Notizen/Fotos, nur bei Sync, optional); verschlüsselt übertragen; Löschung möglich (Konto löschen in der App);
     **keine** Weitergabe, **kein** Tracking.
   - **Behörden-/Finanz-/Gesundheits-Apps:** Nein

## 5. Plus-Produkte anlegen

Erst möglich, wenn ein erster Build hochgeladen ist (Schritt 7). Danach: **Monetarisieren → Produkte**.

**Abos** (Monetarisieren → Abos → Abo erstellen):

| Produkt-ID | Basis-Plan-ID | Laufzeit | Preis |
|---|---|---|---|
| `ch.fabioberta.secondbrain.plus.monthly` | `monthly` | 1 Monat, automatisch verlängern | CHF 1.– |
| `ch.fabioberta.secondbrain.plus.yearly` | `yearly` | 1 Jahr, automatisch verlängern | CHF 9.– |

Die **Basis-Plan-IDs müssen genau** `monthly` bzw. `yearly` heissen – die App sucht danach.
Preise: bei CHF eintragen → „Preise für andere Länder umrechnen“. Basis-Plan jeweils **aktivieren**.

> Vorerst **kein** Gratis-Test-Angebot anlegen: das Kauf-Plugin zeigt sonst „Gratis“ als Jahrespreis.
> Die 14 Tage gratis gibt es vorerst nur auf iOS.

**Einmalprodukt** (Monetarisieren → In-App-Produkte → Produkt erstellen):
`ch.fabioberta.secondbrain.plus.lifetime`, Name „2nd Brain Plus – für immer“, CHF 24.–, **aktivieren**.

**Testkäufe:** Einstellungen (Play Console, links unten) → **Lizenztests** → deine Google-Mail eintragen →
Lizenzantwort „RESPOND_NORMALLY“. Mit diesem Konto im Emulator (Play Store) anmelden → Käufe kosten nichts.

Gratis-Plus für frühe Nutzer und Geschenke über Firebase (`plusGifts`) funktioniert auf Android genau gleich.

## 6. Signierschlüssel (einmalig – gut aufbewahren!)

Android Studio → **Build → Generate Signed App Bundle or APK** → **Android App Bundle** → Next →
**Create new…**:
- Speicherort: z. B. `~/Dokumente/2ndbrain-upload.jks` (**nicht** in den Ordner `2nd-Brain`)
- Passwort zweimal, Alias `upload`, Gültigkeit 25 Jahre, Name eintragen → OK

> Datei und Passwort sicher aufbewahren (z. B. im Passwort-Manager). Ohne sie kannst du keine Updates hochladen.

Weiter → **release** → **Create**. Das Bundle liegt dann unter `android/app/release/app-release.aab`.

## 7. Hochladen und geschlossener Test

1. Play Console → **Testen → Geschlossene Tests** → **Track erstellen** (z. B. „Freunde“).
2. **Tester**: E-Mail-Liste mit **mindestens 12 Personen** (Google-Konten mit Android-Handy).
3. **Neuer Release** → **Play App Signing** akzeptieren → `app-release.aab` hochladen →
   Versionshinweise (siehe unten) → **Überprüfen → Einführen**.
4. Den **Einladungslink** an die Tester schicken. Sie müssen ihn öffnen, „Tester werden“ antippen und die App installieren.
5. **14 Tage** müssen mindestens 12 Tester dabei bleiben. Danach unter **Dashboard → Zugriff auf Produktion beantragen**.

## 8. App Links (geteilte Notizen öffnen direkt die App)

Play Console → **Testen und veröffentlichen → App-Integrität → App-Signatur** → den **SHA-256-Fingerabdruck**
des *App-Signaturschlüssels* kopieren und mir schicken. Ich lege damit auf der Webseite
`https://2ndbrain.ch/.well-known/assetlinks.json` an. Bis dahin fragt Android beim Antippen eines Links,
womit er geöffnet werden soll – das funktioniert trotzdem.

## 9. Updates

In `android/app/build.gradle` **versionCode** um 1 erhöhen (2, 3, …) und **versionName** setzen (z. B. `2.5`),
dann `npm run sync:android` → Signed Bundle (Schritt 6, gleicher Schlüssel) → hochladen.

---

## Store-Eintrag

### Deutsch

**App-Name:** `2nd Brain: Notizen & Journal`

**Kurzbeschreibung** (max. 80 Zeichen):
```
Notizen, Journal und Erinnerungen in einer ruhigen App. Gratis, ohne Werbung.
```

**Vollständige Beschreibung:**
```
Öffnen. Schreiben. Schliessen.

2nd Brain vereint drei Apps in einer – Notizen, Journal und Erinnerungen. Ruhig, schnell und gratis.

📝 NOTIZEN
Beim Öffnen wartet ein leeres Blatt. Gedanke aufschreiben, Foto anhängen, weglegen – fertig. Tippe # und 2nd Brain schlägt Kategorien vor, Listen setzen sich selbst fort.

✅ TODO-LISTEN
Im Menü „todo“ antippen – ein leeres Blatt mit Kreisen zum Abhaken. Offene Todos erscheinen auch in deinem Tag.

📖 JOURNAL
Am Abend erinnert dich 2nd Brain an den Tagesrückblick: alle Gedanken des Tages – sortieren, pinnen, archivieren. Ab und zu tauchen alte Gedanken von vor einer Woche, einem Monat oder einem Jahr wieder auf.

⏰ ERINNERUNGEN
Mit #aufgabe wird jede Notiz zur Aufgabe. Zeit wählen – und 2nd Brain erinnert dich.

UND AUSSERDEM
• Zwei Widgets: „Neuer Gedanke“ und „Schnellaktionen“
• Teilen mit 2nd Brain aus jeder App
• Notizen als Text oder Link teilen
• Mit Fingerabdruck sperren
• Deutsch und Englisch

GRATIS – UND PLUS, WENN DU MAGST
Notizen, Journal und Erinnerungen sind gratis, ohne Werbung und ohne Tracking. Mit 2nd Brain Plus unterstützt du die App und bekommst Sync auf allen Geräten und den Wochenrückblick: CHF 1 im Monat, CHF 9 im Jahr oder einmalig CHF 24.

Datenschutz: https://2ndbrain.ch/privacy.html
```

### English

**App name:** `2nd Brain: Notes & Journal`

**Short description:**
```
Notes, journal and reminders in one calm app. Free, no ads.
```

**Full description:**
```
Open. Write. Close.

2nd Brain combines three apps in one – notes, journal and reminders. Calm, fast and free.

📝 NOTES
A blank page is waiting when you open the app. Write a thought, add a photo, put it away – done. Type # and 2nd Brain suggests categories; lists continue by themselves.

✅ TODO LISTS
Tap “todo” in the menu – a blank page with circles to tick off. Open todos also show up in your day.

📖 JOURNAL
In the evening, 2nd Brain reminds you of your daily review: all of the day’s thoughts – sort, pin, archive. Now and then, old thoughts from a week, a month or a year ago come back.

⏰ REMINDERS
Add #task and any note becomes a task. Pick a time – and 2nd Brain reminds you.

AND ALSO
• Two widgets: “New thought” and “Quick actions”
• Share to 2nd Brain from any app
• Share notes as text or link
• Lock with your fingerprint
• English and German

FREE – AND PLUS IF YOU LIKE
Notes, journal and reminders are free, with no ads and no tracking. With 2nd Brain Plus you support the app and get sync across devices and the weekly review: CHF 1 a month, CHF 9 a year or CHF 24 once.

Privacy Policy: https://2ndbrain.ch/en/privacy.html
```

### Versionshinweise (erster Release)
```
<de-CH>
Erste Android-Version von 2nd Brain – mit Notizen, Journal, Erinnerungen, Todo-Listen und zwei Widgets.
</de-CH>
<en-US>
First Android version of 2nd Brain – with notes, journal, reminders, todo lists and two widgets.
</en-US>
```

**Grafiken:** App-Icon 512 × 512 (`icons/icon-512.png`), Vorstellungsgrafik 1024 × 500, mindestens 2 Handy-Screenshots
(Bildschirmfotos aus dem Emulator: Kamera-Symbol in der Emulator-Leiste).

---

## Bekannte Unterschiede zu iOS

- **Anmelden:** nur mit E-Mail (Apple gibt es auf Android nicht, Google kommt später).
- **14 Tage gratis** beim Jahresabo: vorerst nur auf iOS.
- **Bild in der Galerie sichern** (Knopf in der Bildansicht): ab Android 10.
- **Erinnerungen:** Erlaubt Android keine exakten Wecker, kommen sie ungefähr pünktlich (wenige Minuten Abweichung).
- **Siri** gibt es nicht – dafür die Verknüpfungen am App-Icon.
