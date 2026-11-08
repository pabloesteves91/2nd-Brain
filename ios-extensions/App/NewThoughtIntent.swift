// Kurzbefehl „Neuer Gedanke“ – für Siri, Spotlight, die Kurzbefehle-App und den Action-Button.
// Target Membership: App.
import AppIntents
import Foundation

@available(iOS 16.0, *)
struct NewThoughtIntent: AppIntent {
    static let title: LocalizedStringResource = "New thought" // Deutsch: de.lproj/Localizable.strings
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        AppGroup.defaults?.set("new", forKey: AppGroup.pendingActionKey)
        NotificationCenter.default.post(name: AppGroup.pendingActionNotification, object: nil)
        return .result()
    }
}

@available(iOS 16.0, *)
struct SecondBrainShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NewThoughtIntent(),
            phrases: [
                "New thought in \(.applicationName)",
                "\(.applicationName) new thought",
                "Note a thought in \(.applicationName)",
                "Note in \(.applicationName)",
                "New note in \(.applicationName)",
            ],
            shortTitle: "New thought", // Deutsch: de.lproj/Localizable.strings
            systemImageName: "square.and.pencil"
        )
    }
}
