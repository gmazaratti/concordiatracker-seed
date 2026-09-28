import WidgetKit
import SwiftUI

/// The next class, from the meeting times on your courses. The app works out
/// the upcoming occurrences (it owns the meeting-time parser); the widget only
/// picks the first that has not ended.
struct ClassEntry: TimelineEntry {
    let date: Date
    let next: WidgetSnapshot.ClassSlot?
    let hasData: Bool
}

struct ClassProvider: TimelineProvider {
    func placeholder(in context: Context) -> ClassEntry {
        ClassEntry(
            date: Date(),
            next: .init(code: "COMP 248", title: "Object-Oriented Programming I", color: "#8fb39a",
                        start: Date().addingTimeInterval(3600), end: Date().addingTimeInterval(7200),
                        location: "H 820"),
            hasData: true
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ClassEntry) -> Void) {
        completion(entry(at: Date()))
    }

    /// A new entry as each class ends, so the widget advances on its own.
    func getTimeline(in context: Context, completion: @escaping (Timeline<ClassEntry>) -> Void) {
        let now = Date()
        var entries = [entry(at: now)]
        if let snap = SnapshotStore.load() {
            for c in snap.classes.sorted(by: { $0.end < $1.end }) where c.end > now {
                entries.append(entry(at: c.end.addingTimeInterval(1)))
                if entries.count >= 12 { break }
            }
        }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(6 * 3600))))
    }

    private func entry(at date: Date) -> ClassEntry {
        guard let snap = SnapshotStore.load() else {
            return ClassEntry(date: date, next: nil, hasData: false)
        }
        let next = snap.classes.filter { $0.end > date }.sorted { $0.start < $1.start }.first
        return ClassEntry(date: date, next: next, hasData: true)
    }
}

struct NextClassView: View {
    let entry: ClassEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("NEXT CLASS")
                .font(.caption2.weight(.semibold))
                .foregroundColor(.secondary)
            if let c = entry.next {
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Brand.course(c.color))
                        .frame(width: 4, height: 30)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(c.code).font(.headline)
                        Text(c.title).font(.caption).foregroundColor(.secondary).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
                if c.start <= entry.date {
                    Text("Now, until \(c.end, style: .time)").font(.subheadline.weight(.medium))
                } else {
                    Text(c.start, style: .relative).font(.subheadline.weight(.medium))
                }
                if let room = c.location, !room.isEmpty {
                    Text(room).font(.caption).foregroundColor(.secondary)
                }
            } else {
                Spacer(minLength: 0)
                Text(entry.hasData ? "No classes coming up." : "Open ConcordiaTracker to see your classes here.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetBackground()
        .widgetURL(URL(string: "https://concordiatracker.com/app/calendar"))
    }
}

struct NextClassWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextClass", provider: ClassProvider()) { entry in
            NextClassView(entry: entry)
        }
        .configurationDisplayName("Next class")
        .description("Your next class and where it is.")
        .supportedFamilies([.systemSmall])
    }
}
