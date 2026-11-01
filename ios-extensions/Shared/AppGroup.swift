// Gemeinsamer Speicher zwischen App und Teilen-Erweiterung.
// Target Membership: App UND ShareExtension.
import Foundation

enum AppGroup {
    static let id = "group.ch.fabioberta.secondbrain"

    static var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
    }

    /// Ordner, in dem die Teilen-Erweiterung neue Notizen ablegt.
    static var inbox: URL? {
        guard let base = container else { return nil }
        let dir = base.appendingPathComponent("inbox", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static var defaults: UserDefaults? { UserDefaults(suiteName: id) }

    static let pendingActionKey = "pendingAction"
    static let pendingActionNotification = Notification.Name("SecondBrainPendingAction")
}
