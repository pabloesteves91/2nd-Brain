// Kleines eigenes Capacitor-Plugin: holt geteilte Notizen ab und meldet Kurzbefehl-Aktionen.
// Target Membership: App.
import Foundation
import Capacitor
import Photos
import Speech
import AVFoundation
import StoreKit

@objc(SecondBrainNativePlugin)
public class SecondBrainNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecondBrainNativePlugin"
    public let jsName = "SecondBrainNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "readInbox", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearInbox", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePendingAction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveToPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startDictation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopDictation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveBackup", returnType: CAPPluginReturnPromise),
    ]

    // Spracheingabe
    private let audioEngine = AVAudioEngine()
    private var speechRequest: SFSpeechAudioBufferRecognitionRequest?
    private var speechTask: SFSpeechRecognitionTask?

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

    // MARK: Spracheingabe – Erkennung auf dem Gerät, keine Aufnahme wird gespeichert.

    /// Startet die Erkennung; Ergebnisse kommen als Event „dictation“ { text, final }, Ende als „dictationEnd“.
    @objc func startDictation(_ call: CAPPluginCall) {
        let lang = call.getString("lang") ?? Locale.current.identifier
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                call.reject("speech-denied")
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                guard granted else {
                    call.reject("mic-denied")
                    return
                }
                DispatchQueue.main.async { self.beginDictation(lang: lang, call: call) }
            }
        }
    }

    private func beginDictation(lang: String, call: CAPPluginCall) {
        endAudio()
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: lang)) ?? SFSpeechRecognizer(),
              recognizer.isAvailable else {
            call.reject("unavailable")
            return
        }
        do {
            // Zuerst die Audio-Sitzung auf Aufnahme stellen – erst danach stimmt das Format des Mikrofons
            // (sonst stürzt installTap mit einem veralteten Format ab).
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let input = audioEngine.inputNode
            let format = input.outputFormat(forBus: 0)
            guard format.channelCount > 0, format.sampleRate > 0 else { // z. B. Mac ohne Mikrofon
                endAudio()
                call.reject("unavailable")
                return
            }

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
            if #available(iOS 16.0, *) { request.addsPunctuation = true }
            speechRequest = request

            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }
            audioEngine.prepare()
            try audioEngine.start()

            speechTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self = self else { return }
                if let result = result {
                    self.notifyListeners("dictation", data: [
                        "text": result.bestTranscription.formattedString,
                        "final": result.isFinal,
                    ])
                }
                if error != nil || result?.isFinal == true {
                    DispatchQueue.main.async {
                        self.endAudio()
                        self.notifyListeners("dictationEnd", data: [:])
                    }
                }
            }
            call.resolve()
        } catch {
            endAudio()
            call.reject(error.localizedDescription)
        }
    }

    /// Aufnahme beenden – das Endergebnis kommt danach noch als „dictation“ mit final = true.
    @objc func stopDictation(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.audioEngine.isRunning {
                self.audioEngine.stop()
                self.audioEngine.inputNode.removeTap(onBus: 0)
            }
            self.speechRequest?.endAudio()
            call.resolve()
        }
    }

    private func endAudio() {
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        speechRequest?.endAudio()
        speechRequest = nil
        speechTask?.cancel()
        speechTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    // MARK: Bewertung & Auto-Backup

    /// Apples Bewertungsabfrage – iOS entscheidet selbst, ob und wie oft sie erscheint.
    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let scene = UIApplication.shared.connectedScenes
                .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                SKStoreReviewController.requestReview(in: scene)
            }
            call.resolve()
        }
    }

    /// Sicherung in Dokumente/Backups (sichtbar in der Dateien-App unter „Auf meinem iPhone › 2nd Brain“), die 4 neuesten bleiben.
    @objc func saveBackup(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let data = json.data(using: .utf8) else {
            call.reject("Keine Daten")
            return
        }
        let name = call.getString("name") ?? "2nd-Brain-Backup.json"
        let fm = FileManager.default
        do {
            let docs = try fm.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            let dir = docs.appendingPathComponent("Backups", isDirectory: true)
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
            try data.write(to: dir.appendingPathComponent(name), options: .atomic)
            let old = try fm.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
                .filter { $0.pathExtension == "json" }
                .sorted { $0.lastPathComponent > $1.lastPathComponent }
                .dropFirst(4)
            for url in old { try? fm.removeItem(at: url) }
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }
}
