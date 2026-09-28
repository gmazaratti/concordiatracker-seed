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
        let tint = entry.next.map { Brand.course($0.color) } ?? Brand.accent
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .widgetBackground(tint: tint)
            .widgetURL(URL(string: "https://concordiatracker.com/app/calendar"))
    }

    @ViewBuilder
    private var content: some View {
        if let c = entry.next {
            let tint = Brand.course(c.color)
            let now = c.start <= entry.date
            VStack(alignment: .leading, spacing: 0) {
                WidgetHeader(icon: "book.closed.fill", title: now ? "IN CLASS" : "NEXT CLASS", tint: tint)
                Spacer(minLength: 6)
                WidgetHero(text: c.code)
                Text(c.title)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer(minLength: 6)
                // When: a solid pill while it is on, a tinted one before.
                HStack(spacing: 4) {
                    Image(systemName: now ? "circle.fill" : "clock")
                        .font(.system(size: now ? 6 : 10, weight: .bold))
                    if now {
                        Text("Now · until \(c.end, style: .time)")
                    } else {
                        Text("in ") + Text(c.start, style: .relative)
                    }
                }
                .font(.system(size: 12, weight: .semibold))
                .lineLimit(1)
                .foregroundStyle(now ? Color.white : tint)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(now ? AnyShapeStyle(tint) : AnyShapeStyle(tint.opacity(0.16)), in: Capsule())
                if let room = c.location, !room.isEmpty {
                    Label(room, systemImage: "mappin.and.ellipse")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .padding(.top, 5)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                WidgetHeader(icon: "book.closed.fill", title: "NEXT CLASS", tint: Brand.accent)
                Spacer(minLength: 0)
                Text(entry.hasData ? "No classes coming up." : "Open ConcordiaTracker to see your classes here.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
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
