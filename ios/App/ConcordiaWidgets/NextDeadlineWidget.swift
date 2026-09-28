import WidgetKit
import SwiftUI

/// The next thing due. The medium size also lists the two after it.
struct DeadlineEntry: TimelineEntry {
    let date: Date
    let upcoming: [WidgetSnapshot.Deadline]
    let hasData: Bool
}

struct DeadlineProvider: TimelineProvider {
    func placeholder(in context: Context) -> DeadlineEntry {
        DeadlineEntry(
            date: Date(),
            upcoming: [
                .init(id: "placeholder", title: "Assignment 2", course: "COMP 248", color: "#8fb39a",
                      due: Date().addingTimeInterval(86_400), kind: "assignment")
            ],
            hasData: true
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (DeadlineEntry) -> Void) {
        completion(entry(at: Date()))
    }

    /// One entry per deadline passing, so the widget moves on to the next one
    /// the moment the current one is due, without the app having to run.
    func getTimeline(in context: Context, completion: @escaping (Timeline<DeadlineEntry>) -> Void) {
        let now = Date()
        var entries = [entry(at: now)]
        // Hourly for the next six hours, so the Lock Screen's "3h" / "45m"
        // counts down between deadlines rather than only at them.
        for h in 1...6 {
            entries.append(entry(at: now.addingTimeInterval(Double(h) * 3600)))
        }
        if let snap = SnapshotStore.load() {
            for d in snap.deadlines.sorted(by: { $0.due < $1.due }) where d.due > now {
                entries.append(entry(at: d.due.addingTimeInterval(1)))
                if entries.count >= 18 { break }
            }
        }
        // At least every few hours, so "Tomorrow" becomes "Today" on time.
        entries.sort { $0.date < $1.date }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(3 * 3600))))
    }

    private func entry(at date: Date) -> DeadlineEntry {
        guard let snap = SnapshotStore.load() else {
            return DeadlineEntry(date: date, upcoming: [], hasData: false)
        }
        let next = snap.deadlines.filter { $0.due >= date }.sorted { $0.due < $1.due }
        return DeadlineEntry(date: date, upcoming: Array(next.prefix(3)), hasData: true)
    }
}

struct NextDeadlineView: View {
    @Environment(\.widgetFamily) var family
    let entry: DeadlineEntry

    var body: some View {
        let tint = entry.upcoming.first.map { Brand.course($0.color) } ?? Brand.accent
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .widgetBackground(tint: tint)
            .widgetURL(URL(string: "https://concordiatracker.com/app"))
    }

    @ViewBuilder
    private var content: some View {
        if !entry.hasData {
            VStack(alignment: .leading, spacing: 8) {
                WidgetHeader(icon: "hourglass", title: "NEXT DUE", tint: Brand.accent)
                Spacer(minLength: 0)
                Text("Open ConcordiaTracker to see your deadlines here.")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        } else if let first = entry.upcoming.first {
            if family == .systemMedium {
                HStack(alignment: .top, spacing: 14) {
                    hero(first)
                    Rectangle()
                        .fill(Color.primary.opacity(0.08))
                        .frame(width: 1)
                    later
                }
            } else {
                hero(first)
            }
        } else {
            VStack(alignment: .leading, spacing: 4) {
                WidgetHeader(icon: "checkmark", title: "NEXT DUE", tint: Brand.accent)
                Spacer(minLength: 0)
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(Brand.accent)
                WidgetHero(text: "All caught up")
                Text("Nothing due.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
    }

    /// The next deadline: when (the big figure), what, and which course.
    private func hero(_ d: WidgetSnapshot.Deadline) -> some View {
        let tint = Brand.course(d.color)
        return VStack(alignment: .leading, spacing: 0) {
            WidgetHeader(icon: "hourglass", title: "NEXT DUE", tint: tint)
            Spacer(minLength: 6)
            // Saturated colour only when it is urgent, as in the app.
            WidgetHero(text: Relative.due(d.due, now: entry.date), color: urgent(d) ? .orange : .primary)
            Text(d.title)
                .font(.system(size: 14, weight: .semibold))
                .lineLimit(2)
                .padding(.top, 2)
            Spacer(minLength: 6)
            CourseTag(code: d.course, color: tint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The two after it, as a short list.
    private var later: some View {
        let rest = Array(entry.upcoming.dropFirst().prefix(2))
        return VStack(alignment: .leading, spacing: 10) {
            Text("THEN")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(.secondary)
            if rest.isEmpty {
                Text("Nothing else coming up.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
            }
            ForEach(rest) { d in
                HStack(alignment: .top, spacing: 7) {
                    Circle()
                        .fill(Brand.course(d.color))
                        .frame(width: 7, height: 7)
                        .padding(.top, 5)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(d.title)
                            .font(.system(size: 13, weight: .semibold))
                            .lineLimit(1)
                        HStack(spacing: 4) {
                            // The course code gives way first; the date never
                            // wraps (a small widget once broke "Tomorrow" in two).
                            Text(d.course)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                            Text("·").foregroundStyle(.secondary)
                            Text(Relative.due(d.due, now: entry.date))
                                .fontWeight(.semibold)
                                .foregroundStyle(urgent(d) ? Color.orange : Color.primary)
                                .lineLimit(1)
                                .layoutPriority(1)
                        }
                        .font(.system(size: 11))
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func urgent(_ d: WidgetSnapshot.Deadline) -> Bool {
        d.due < entry.date.addingTimeInterval(86_400)
    }
}

struct NextDeadlineWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "NextDeadline", provider: DeadlineProvider()) { entry in
            NextDeadlineFamilyView(entry: entry)
        }
        .configurationDisplayName("Next deadline")
        .description("What is due next, from your courses.")
        .supportedFamilies([
            .systemSmall, .systemMedium,
            .accessoryCircular, .accessoryRectangular, .accessoryInline
        ])
    }
}

/// Home Screen sizes draw the card; Lock Screen sizes draw the minimal view.
struct NextDeadlineFamilyView: View {
    @Environment(\.widgetFamily) var family
    let entry: DeadlineEntry

    var body: some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            LockScreenDeadlineView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }
                .widgetURL(URL(string: "https://concordiatracker.com/app"))
        default:
            NextDeadlineView(entry: entry)
        }
    }
}
