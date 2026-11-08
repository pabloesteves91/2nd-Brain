// Widget „Neuer Gedanke“ für Home- und Sperrbildschirm. Ein Tipp öffnet 2nd Brain mit leerem Blatt.
// Target Membership: nur das Widget-Target (z. B. „SecondBrainWidget“).
import WidgetKit
import SwiftUI

/// Deutsch, wenn das Gerät auf Deutsch steht, sonst Englisch (ohne .strings-Datei in diesem Target).
private func L(_ de: String, _ en: String) -> String {
    (Locale.preferredLanguages.first ?? "en").hasPrefix("de") ? de : en
}

struct ThoughtEntry: TimelineEntry {
    let date: Date
}

struct ThoughtProvider: TimelineProvider {
    func placeholder(in context: Context) -> ThoughtEntry { ThoughtEntry(date: Date()) }

    func getSnapshot(in context: Context, completion: @escaping (ThoughtEntry) -> Void) {
        completion(ThoughtEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ThoughtEntry>) -> Void) {
        completion(Timeline(entries: [ThoughtEntry(date: Date())], policy: .never))
    }
}

private let paper = Color(UIColor { traits in
    traits.userInterfaceStyle == .dark
        ? UIColor(red: 0.071, green: 0.071, blue: 0.071, alpha: 1)   // #121212
        : UIColor(red: 0.984, green: 0.980, blue: 0.969, alpha: 1)   // #fbfaf7
})
private let ink = Color(UIColor { traits in
    traits.userInterfaceStyle == .dark
        ? UIColor(red: 0.914, green: 0.906, blue: 0.886, alpha: 1)   // #e9e7e2
        : UIColor(red: 0.114, green: 0.114, blue: 0.106, alpha: 1)   // #1d1d1b
})
private let muted = Color(UIColor { traits in
    traits.userInterfaceStyle == .dark
        ? UIColor(red: 0.490, green: 0.478, blue: 0.455, alpha: 1)
        : UIColor(red: 0.561, green: 0.545, blue: 0.514, alpha: 1)
})

struct ThoughtWidgetView: View {
    @Environment(\.widgetFamily) private var family

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "square.and.pencil").font(.system(size: 20, weight: .medium))
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("2nd Brain").font(.headline)
                Text(L("Neuer Gedanke", "New thought")).font(.caption)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .accessoryInline:
            Label(L("Neuer Gedanke", "New thought"), systemImage: "square.and.pencil")
        default:
            VStack(alignment: .leading, spacing: 0) {
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(ink)
                    .frame(width: 3, height: 26)
                Spacer()
                Text(L("Neuer Gedanke", "New thought"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(ink)
                Text(L("Was geht dir durch den Kopf?", "What’s on your mind?"))
                    .font(.system(size: 12))
                    .foregroundColor(muted)
                    .lineLimit(2)
                    .padding(.top, 2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

private extension View {
    @ViewBuilder
    func paperBackground() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { paper }
        } else {
            padding().background(paper)
        }
    }
}

struct SecondBrainWidget: Widget {
    let kind = "SecondBrainWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ThoughtProvider()) { _ in
            ThoughtWidgetView()
                .paperBackground()
                .widgetURL(URL(string: "secondbrain://new"))
        }
        .configurationDisplayName(L("Neuer Gedanke", "New thought"))
        .description(L("Ein Tipp – und du schreibst.", "One tap – and you’re writing."))
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct SecondBrainWidgets: WidgetBundle {
    var body: some Widget {
        SecondBrainWidget()
    }
}
