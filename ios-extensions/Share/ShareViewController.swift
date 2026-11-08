// Teilen-Erweiterung „2nd Brain“: Vorschau des Geteilten + optionaler Gedanke → Sichern.
// Die Notiz landet im App-Group-Ordner und wird beim nächsten Öffnen der App übernommen.
// Target Membership: ShareExtension (+ Shared/AppGroup.swift).
import UIKit
import UniformTypeIdentifiers

/// Deutsch, wenn das Gerät auf Deutsch steht, sonst Englisch (ohne .strings-Datei in diesem Target).
private func L(_ de: String, _ en: String) -> String {
    (Locale.preferredLanguages.first ?? "en").hasPrefix("de") ? de : en
}

final class ShareViewController: UIViewController, UITextViewDelegate {

    // MARK: Geteilte Inhalte
    private var sharedURL: URL?
    private var sharedText = ""
    private var images: [UIImage] = []

    // MARK: Farben wie in der App
    private let paper = UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.086, green: 0.086, blue: 0.082, alpha: 1)
        : UIColor(red: 0.984, green: 0.980, blue: 0.969, alpha: 1) }
    private let ink = UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.914, green: 0.906, blue: 0.886, alpha: 1)
        : UIColor(red: 0.114, green: 0.114, blue: 0.106, alpha: 1) }
    private let muted = UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.490, green: 0.478, blue: 0.455, alpha: 1)
        : UIColor(red: 0.561, green: 0.545, blue: 0.514, alpha: 1) }
    private let line = UIColor { $0.userInterfaceStyle == .dark
        ? UIColor(red: 0.149, green: 0.145, blue: 0.137, alpha: 1)
        : UIColor(red: 0.922, green: 0.910, blue: 0.882, alpha: 1) }

    // MARK: Views
    private let card = UIView()
    private let thought = UITextView()
    private let placeholder = UILabel()
    private let previewTitle = UILabel()
    private let previewDetail = UILabel()
    private let thumbs = UIStackView()
    private let saveButton = UIButton(type: .system)
    private var cardBottom: NSLayoutConstraint?

    // MARK: Lebenszyklus

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black.withAlphaComponent(0.25)
        buildUI()
        loadAttachments()
        NotificationCenter.default.addObserver(self, selector: #selector(keyboard(_:)),
                                               name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        thought.becomeFirstResponder()
    }

    // MARK: Aufbau

    private func buildUI() {
        card.backgroundColor = paper
        card.layer.cornerRadius = 18
        card.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)

        let cancel = UIButton(type: .system)
        cancel.setTitle(L("Abbrechen", "Cancel"), for: .normal)
        cancel.setTitleColor(muted, for: .normal)
        cancel.titleLabel?.font = .systemFont(ofSize: 16)
        cancel.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)

        let title = UILabel()
        title.text = "2nd Brain"
        title.font = .systemFont(ofSize: 16, weight: .semibold)
        title.textColor = ink
        title.textAlignment = .center

        saveButton.setTitle(L("Sichern", "Save"), for: .normal)
        saveButton.setTitleColor(ink, for: .normal)
        saveButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        saveButton.addTarget(self, action: #selector(saveTapped), for: .touchUpInside)

        let bar = UIStackView(arrangedSubviews: [cancel, title, saveButton])
        bar.distribution = .equalCentering
        bar.alignment = .center

        // Vorschau des Geteilten
        previewTitle.font = .systemFont(ofSize: 14, weight: .medium)
        previewTitle.textColor = ink
        previewTitle.numberOfLines = 2
        previewDetail.font = .systemFont(ofSize: 12.5)
        previewDetail.textColor = muted
        previewDetail.numberOfLines = 3
        thumbs.axis = .horizontal
        thumbs.spacing = 8

        let previewStack = UIStackView(arrangedSubviews: [previewTitle, previewDetail, thumbs])
        previewStack.axis = .vertical
        previewStack.spacing = 4
        previewStack.alignment = .leading

        let preview = UIView()
        preview.layer.cornerRadius = 12
        preview.layer.borderWidth = 1
        preview.layer.borderColor = line.cgColor
        preview.addSubview(previewStack)
        previewStack.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            previewStack.topAnchor.constraint(equalTo: preview.topAnchor, constant: 12),
            previewStack.bottomAnchor.constraint(equalTo: preview.bottomAnchor, constant: -12),
            previewStack.leadingAnchor.constraint(equalTo: preview.leadingAnchor, constant: 14),
            previewStack.trailingAnchor.constraint(equalTo: preview.trailingAnchor, constant: -14),
        ])

        // Gedanke dazu
        thought.font = .systemFont(ofSize: 18)
        thought.textColor = ink
        thought.backgroundColor = .clear
        thought.tintColor = ink
        thought.textContainerInset = .zero
        thought.textContainer.lineFragmentPadding = 0
        thought.delegate = self
        thought.heightAnchor.constraint(greaterThanOrEqualToConstant: 90).isActive = true

        placeholder.text = L("Gedanke dazu …", "Add a thought …")
        placeholder.font = thought.font
        placeholder.textColor = muted.withAlphaComponent(0.7)
        placeholder.translatesAutoresizingMaskIntoConstraints = false
        thought.addSubview(placeholder)
        NSLayoutConstraint.activate([
            placeholder.topAnchor.constraint(equalTo: thought.topAnchor),
            placeholder.leadingAnchor.constraint(equalTo: thought.leadingAnchor),
        ])

        let stack = UIStackView(arrangedSubviews: [bar, preview, thought])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)

        let bottom = card.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        cardBottom = bottom
        NSLayoutConstraint.activate([
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottom,
            card.topAnchor.constraint(greaterThanOrEqualTo: view.safeAreaLayoutGuide.topAnchor, constant: 40),
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: card.safeAreaLayoutGuide.bottomAnchor, constant: -16),
        ])
        refreshPreview()
    }

    private func refreshPreview() {
        if let url = sharedURL {
            previewTitle.text = sharedText.isEmpty ? (url.host ?? url.absoluteString) : sharedText
            previewDetail.text = url.absoluteString
        } else if !sharedText.isEmpty {
            previewTitle.text = sharedText
            previewDetail.text = nil
        } else if images.isEmpty {
            previewTitle.text = L("Wird geladen …", "Loading …")
            previewDetail.text = nil
        } else {
            previewTitle.text = images.count == 1 ? L("1 Bild", "1 image") : L("\(images.count) Bilder", "\(images.count) images")
            previewDetail.text = nil
        }
        previewDetail.isHidden = previewDetail.text == nil
        thumbs.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for image in images.prefix(5) {
            let iv = UIImageView(image: image)
            iv.contentMode = .scaleAspectFill
            iv.clipsToBounds = true
            iv.layer.cornerRadius = 8
            iv.widthAnchor.constraint(equalToConstant: 56).isActive = true
            iv.heightAnchor.constraint(equalToConstant: 56).isActive = true
            thumbs.addArrangedSubview(iv)
        }
        thumbs.isHidden = images.isEmpty
    }

    func textViewDidChange(_ textView: UITextView) {
        placeholder.isHidden = !textView.text.isEmpty
    }

    @objc private func keyboard(_ note: Notification) {
        guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
        let overlap = max(0, view.bounds.maxY - view.convert(frame, from: nil).minY)
        cardBottom?.constant = -overlap
        UIView.animate(withDuration: 0.25) { self.view.layoutIfNeeded() }
    }

    // MARK: Inhalte laden

    private func loadAttachments() {
        let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
        let group = DispatchGroup()
        var texts: [String] = []
        var urls: [URL] = []
        var loaded: [UIImage] = []
        let lock = NSLock()

        for item in items {
            if let t = item.attributedContentText?.string, !t.isEmpty { texts.append(t) }
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { obj, _ in
                        var image: UIImage?
                        if let i = obj as? UIImage { image = i }
                        else if let u = obj as? URL, let d = try? Data(contentsOf: u) { image = UIImage(data: d) }
                        else if let d = obj as? Data { image = UIImage(data: d) }
                        if let image { lock.lock(); loaded.append(image); lock.unlock() }
                        group.leave()
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { obj, _ in
                        if let u = obj as? URL, !u.isFileURL { lock.lock(); urls.append(u); lock.unlock() }
                        group.leave()
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    group.enter()
                    provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { obj, _ in
                        if let s = obj as? String { lock.lock(); texts.append(s); lock.unlock() }
                        group.leave()
                    }
                }
            }
        }

        group.notify(queue: .main) {
            self.sharedURL = urls.first
            // Text ohne die URL selbst (Safari schickt sie oft doppelt)
            var text = texts.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            if let u = self.sharedURL?.absoluteString, text == u { text = "" }
            self.sharedText = text
            self.images = loaded
            self.refreshPreview()
        }
    }

    // MARK: Sichern / Abbrechen

    @objc private func cancelTapped() {
        extensionContext?.cancelRequest(withError: NSError(domain: "SecondBrain", code: 0))
    }

    @objc private func saveTapped() {
        saveButton.isEnabled = false
        guard let dir = AppGroup.inbox else {
            showDone(L("App Group fehlt", "App Group missing"))
            return
        }
        let id = UUID().uuidString.lowercased()
        var names: [String] = []
        for (i, image) in images.prefix(5).enumerated() {
            guard let data = resized(image).jpegData(compressionQuality: 0.82) else { continue }
            let name = "\(id)-\(i).jpg"
            if (try? data.write(to: dir.appendingPathComponent(name), options: .atomic)) != nil { names.append(name) }
        }

        var parts: [String] = []
        let own = thought.text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !own.isEmpty { parts.append(own) }
        if !sharedText.isEmpty { parts.append(sharedText) }
        if let u = sharedURL?.absoluteString, !sharedText.contains(u) { parts.append(u) }

        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let entry: [String: Any] = [
            "id": id,
            "text": parts.joined(separator: "\n\n"),
            "url": sharedURL?.absoluteString ?? "",
            "created_at": iso.string(from: Date()),
            "images": names,
        ]
        if let json = try? JSONSerialization.data(withJSONObject: entry) {
            try? json.write(to: dir.appendingPathComponent("\(id).json"), options: .atomic)
        }
        showDone(L("Gesichert ✓", "Saved ✓"))
    }

    private func showDone(_ text: String) {
        thought.resignFirstResponder()
        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: 16, weight: .medium)
        label.textColor = ink
        label.textAlignment = .center
        label.backgroundColor = paper
        label.frame = card.bounds
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        card.addSubview(label)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            self.extensionContext?.completeRequest(returningItems: nil)
        }
    }

    private func resized(_ image: UIImage, max: CGFloat = 1600) -> UIImage {
        let size = image.size
        let scale = min(1, max / Swift.max(size.width, size.height))
        if scale >= 1 { return image }
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }
}
