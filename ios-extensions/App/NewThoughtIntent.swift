// Kurzbefehl „Neuer Gedanke“ – für Siri, Spotlight, die Kurzbefehle-App und den Action-Button.
// Target Membership: App.
import AppIntents
import Foundation

@available(iOS 16.0, *)
struct NewThoughtIntent: AppIntent {
    static let title: LocalizedStringResource = "Neuer Gedanke" // Englisch: en.lproj/Localizable.strings
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppGroup.defaults?.set("new", forKey: AppGroup.pendingActionKey)
        NotificationCenter.default.post(name: AppGroup.pendingActionNotification, object: nil)
        return .result()
    }
}

// „Hey Siri, schreib einen Gedanken in 2nd Brain“ – Siri fragt nach dem Text und legt ihn ab, ohne die App zu öffnen.
// Ablage wie beim Teilen-Menü (AppGroup.inbox); die App übernimmt die Notiz beim nächsten Öffnen.
@available(iOS 16.0, *)
struct AddThoughtIntent: AppIntent {
    static let title: LocalizedStringResource = "Gedanken aufschreiben"
    static let description = IntentDescription("Hält einen Gedanken in 2nd Brain fest, ohne die App zu öffnen.")
    static let openAppWhenRun: Bool = false

    @Parameter(title: "Gedanke", requestValueDialog: IntentDialog("Was möchtest du festhalten?"))
    var text: String

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let thought = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !thought.isEmpty, let dir = AppGroup.inbox else {
            return .result(dialog: "Nichts gesichert.")
        }
        let id = UUID().uuidString.lowercased()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let entry: [String: Any] = [
            "id": id,
            "text": thought,
            "created_at": iso.string(from: Date()),
            "images": [String](),
        ]
        let json = try JSONSerialization.data(withJSONObject: entry)
        try json.write(to: dir.appendingPathComponent("\(id).json"), options: .atomic)
        NotificationCenter.default.post(name: AppGroup.pendingActionNotification, object: nil)
        return .result(dialog: "Gesichert in 2nd Brain.")
    }
}

@available(iOS 16.0, *)
struct SecondBrainShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NewThoughtIntent(),
            phrases: [
                "Neuer Gedanke in \(.applicationName)",
                "\(.applicationName) neuer Gedanke",
                "Gedanke in \(.applicationName) notieren",
                "Notiz in \(.applicationName)",
                "Neue Notiz in \(.applicationName)",
            ],
            shortTitle: "Neuer Gedanke", // Englisch: en.lproj/Localizable.strings
            systemImageName: "square.and.pencil"
        )
        AppShortcut(
            intent: AddThoughtIntent(),
            // Ohne Verben wie „schreib“/„notiere“ – die fängt Siri sonst für Erinnerungen/Notizen ab.
            phrases: [
                "Eintrag in \(.applicationName)",
                "Neuer Eintrag in \(.applicationName)",
                "Gedanke für \(.applicationName)",
                "\(.applicationName) Eintrag",
            ],
            shortTitle: "Gedanken aufschreiben",
            systemImageName: "mic"
        )
    }
}
