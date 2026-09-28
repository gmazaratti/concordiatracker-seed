import WidgetKit
import SwiftUI

/// How busy the libraries are, live.
///
/// Unlike the other two widgets this does not read the app's snapshot: the
/// number is public and changes by the minute, so the widget asks the site's
/// own endpoint (https://concordiatracker.com/api/library) when WidgetKit
/// refreshes it. That endpoint already refuses to invent a number: a sensor
/// with no recent reading comes back as null, and the widget says "No reading"
/// rather than "0 people".
///
/// Concordia counts PEOPLE in the building, not free seats, so that is what
/// this says.
struct LibraryReading: Decodable, Identifiable {
    let id: String
    let name: String
    let people: Int?
    let empty: Bool
    let stale: Bool
}

private struct LibraryResponse: Decodable {
    let libraries: [LibraryReading]
}

struct LibraryEntry: TimelineEntry {
    let date: Date
    let readings: [LibraryReading]
    let failed: Bool
}

struct LibraryProvider: TimelineProvider {
    static let endpoint = URL(string: "https://concordiatracker.com/api/library")!

    func placeholder(in context: Context) -> LibraryEntry {
        LibraryEntry(date: Date(), readings: [
            .init(id: "Webster", name: "Webster (SGW)", people: 312, empty: false, stale: false),
            .init(id: "Vanier", name: "Vanier (Loyola)", people: 84, empty: false, stale: false)
        ], failed: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (LibraryEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        fetch { completion($0) }
    }

    /// Asks again in 15 minutes; iOS decides the real cadence from its budget.
    func getTimeline(in context: Context, completion: @escaping (Timeline<LibraryEntry>) -> Void) {
        fetch { entry in
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }

    private func fetch(_ done: @escaping (LibraryEntry) -> Void) {
        var request = URLRequest(url: Self.endpoint, timeoutInterval: 10)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        URLSession.shared.dataTask(with: request) { data, response, _ in
            let ok = (response as? HTTPURLResponse)?.statusCode == 200
            guard ok, let data = data,
                  let parsed = try? JSONDecoder().decode(LibraryResponse.self, from: data)
            else {
                done(LibraryEntry(date: Date(), readings: [], failed: true))
                return
            }
            // Grey Nuns has never reported; leaving it out beats a row that
            // always says "No reading".
            let useful = parsed.libraries.filter { $0.people != nil || $0.empty || !$0.stale }
            done(LibraryEntry(date: Date(), readings: useful, failed: false))
        }.resume()
    }
}

struct LibraryView: View {
    let entry: LibraryEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(icon: "books.vertical.fill", title: "LIBRARIES", tint: Brand.accent)
            Spacer(minLength: 4)
            if entry.failed {
                Text("Can't reach the library count right now.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(entry.readings.prefix(2)) { r in
                        VStack(alignment: .leading, spacing: 0) {
                            Text(r.name)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            HStack(alignment: .firstTextBaseline, spacing: 4) {
                                Text(figure(r))
                                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.6)
                                if let unit = unit(r) {
                                    Text(unit)
                                        .font(.system(size: 11, weight: .semibold))
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                Spacer(minLength: 4)
                // Concordia counts PEOPLE in the building, not free seats; the
                // footer says how fresh the number is.
                HStack(spacing: 4) {
                    Circle().fill(Color.green).frame(width: 6, height: 6)
                    Text("Updated \(entry.date, style: .time)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetBackground(tint: Brand.accent)
        .widgetURL(URL(string: "https://concordiatracker.com/app"))
    }

    /// The number itself, or the word that replaces it.
    private func figure(_ r: LibraryReading) -> String {
        if r.empty { return "Empty" }
        if let n = r.people, !r.stale { return "\(n)" }
        return "—"
    }

    private func unit(_ r: LibraryReading) -> String? {
        if r.empty { return nil }
        if r.people != nil, !r.stale { return "people" }
        return "no reading"
    }
}

struct LibraryWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LibraryOccupancy", provider: LibraryProvider()) { entry in
            LibraryView(entry: entry)
        }
        .configurationDisplayName("Libraries")
        .description("How many people are in Webster and Vanier right now.")
        .supportedFamilies([.systemSmall])
    }
}
