// Kleines eigenes Capacitor-Plugin: holt geteilte Notizen ab und meldet Kurzbefehl-Aktionen.
// Target Membership: App.
import Foundation
import Capacitor
import Photos

@objc(SecondBrainNativePlugin)
public class SecondBrainNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecondBrainNativePlugin"
    public let jsName = "SecondBrainNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readInbox", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearInbox", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePendingAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveToPhotos", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        NotificationCenter.default.addObserver(
            self, selector: #selector(onPendingAction),
            name: AppGroup.pendingActionNotification, object: nil)
    }

    @objc private func onPendingAction() {
        notifyListeners("pendingAction", data: [:])
    }

    /// Alle von der Teilen-Erweiterung abgelegten Einträge (Bilder als data-URLs).
    @objc func readInbox(_ call: CAPPluginCall) {
        guard let dir = AppGroup.inbox else {
            call.resolve(["items": [Any]()])
            return
        }
        let files = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
        var items: [[String: Any]] = []
        for file in files where file.pathExtension == "json" {
            guard let data = try? Data(contentsOf: file),
                  let raw = try? JSONSerialization.jsonObject(with: data),
                  var obj = raw as? [String: Any] else { continue }
            let names = obj["images"] as? [String] ?? []
            obj["images"] = names.compactMap { name -> String? in
                guard let img = try? Data(contentsOf: dir.appendingPathComponent(name)) else { return nil }
                return "data:image/jpeg;base64," + img.base64EncodedString()
            }
            items.append(obj)
        }
        items.sort { ($0["created_at"] as? String ?? "") < ($1["created_at"] as? String ?? "") }
        call.resolve(["items": items])
    }

    /// Übernommene Einträge löschen.
    @objc func clearInbox(_ call: CAPPluginCall) {
        let ids = call.getArray("ids")?.compactMap { $0 as? String } ?? []
        if let dir = AppGroup.inbox {
            let files = (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
            for file in files where ids.contains(where: { file.lastPathComponent.hasPrefix($0) }) {
                try? FileManager.default.removeItem(at: file)
            }
        }
        call.resolve()
    }

    /// Vom Kurzbefehl gesetzte Aktion abholen (z. B. "new") und zurücksetzen.
    @objc func takePendingAction(_ call: CAPPluginCall) {
        let defaults = AppGroup.defaults
        let action = defaults?.string(forKey: AppGroup.pendingActionKey) ?? ""
        defaults?.removeObject(forKey: AppGroup.pendingActionKey)
        call.resolve(["action": action])
    }

    /// Bild (data-URL) in der Fotos-App sichern – mit iCloud-Fotos landet es auf allen Geräten.
    @objc func saveToPhotos(_ call: CAPPluginCall) {
        let raw = call.getString("dataUrl") ?? ""
        guard let comma = raw.firstIndex(of: ","),
              let data = Data(base64Encoded: String(raw[raw.index(after: comma)...])) else {
            call.reject("Kein Bild")
            return
        }
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                call.reject("Kein Zugriff auf Fotos")
                return
            }
            PHPhotoLibrary.shared().performChanges({
                PHAssetCreationRequest.forAsset().addResource(with: .photo, data: data, options: nil)
            }) { ok, error in
                if ok { call.resolve() } else { call.reject(error?.localizedDescription ?? "Sichern fehlgeschlagen") }
            }
        }
    }
}
