// Kurzbefehl „Neuer Gedanke“ – für Siri, Spotlight, die Kurzbefehle-App und den Action-Button.
// Target Membership: App.
import AppIntents
import Foundation

@available(iOS 16.0, *)
struct NewThoughtIntent: AppIntent {
    static let title: LocalizedStringResource = "Neuer Gedanke"
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
                "Neuer Gedanke in \(.applicationName)",
                "\(.applicationName) neuer Gedanke",
                "Gedanke in \(.applicationName) notieren",
                "Notiz in \(.applicationName)",
                "Neue Notiz in \(.applicationName)",
            ],
            shortTitle: "Neuer Gedanke",
            systemImageName: "square.and.pencil"
        )
    }
}
