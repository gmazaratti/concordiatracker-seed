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
        VStack(alignment: .leading, spacing: 6) {
            Text("NEXT DUE")
                .font(.caption2.weight(.semibold))
                .foregroundColor(.secondary)
            if !entry.hasData {
                Spacer(minLength: 0)
                Text("Open ConcordiaTracker to see your deadlines here.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
            } else if let first = entry.upcoming.first {
                row(first, big: true)
                if family == .systemMedium {
                    ForEach(Array(entry.upcoming.dropFirst().prefix(2))) { d in
                        row(d, big: false)
                    }
                }
                Spacer(minLength: 0)
            } else {
                Spacer(minLength: 0)
                Text("All caught up").font(.headline)
                Text("Nothing due.").font(.footnote).foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetBackground()
        .widgetURL(URL(string: "https://concordiatracker.com/app"))
    }

    @ViewBuilder
    private func row(_ d: WidgetSnapshot.Deadline, big: Bool) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(d.title)
                .font(big ? .headline : .subheadline)
                .lineLimit(big ? 2 : 1)
            HStack(spacing: 4) {
                Circle().fill(Brand.course(d.color)).frame(width: 6, height: 6)
                // The course code gives way first; the date never wraps (a
                // small widget used to break "Tomorrow" across two lines).
                Text(d.course).font(.caption).foregroundColor(.secondary)
                    .lineLimit(1).truncationMode(.tail)
                Text("·").font(.caption).foregroundColor(.secondary)
                Text(Relative.due(d.due, now: entry.date))
                    .font(.caption.weight(.medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
                    .layoutPriority(1)
                    // Saturated colour only when it is urgent, as in the app.
                    .foregroundColor(d.due < entry.date.addingTimeInterval(86_400) ? .orange : .primary)
            }
        }
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
