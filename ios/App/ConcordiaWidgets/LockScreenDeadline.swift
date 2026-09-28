import SwiftUI
import WidgetKit

/// The Lock Screen sizes of "Next deadline": circular, rectangular, inline.
///
/// Minimal and glanceable (HIG): the system tints these, so they carry no
/// colour of their own beyond `widgetAccentable()` on the one thing worth
/// accenting, and every line is one line. The countdown in the rectangular and
/// inline sizes is `Text(_:style: .relative)`, which the system keeps current
/// between timeline entries.
struct LockScreenDeadlineView: View {
    @Environment(\.widgetFamily) var family
    let entry: DeadlineEntry

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryInline: inline
        default: rectangular
        }
    }

    private var next: WidgetSnapshot.Deadline? { entry.upcoming.first }

    @ViewBuilder
    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let d = next {
                VStack(spacing: 0) {
                    Text(ShortLeft.label(until: d.due, from: entry.date))
                        .font(.system(.title3, design: .rounded).weight(.bold))
                        .minimumScaleFactor(0.6)
                        .widgetAccentable()
                    Text(Self.shortCode(d.course))
                        .font(.caption2)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                }
                .padding(4)
            } else {
                Image(systemName: "checkmark")
                    .font(.title3.weight(.semibold))
            }
        }
        .accessibilityLabel(next.map { "\($0.course) \($0.title), due in \(ShortLeft.label(until: $0.due, from: entry.date))" } ?? "Nothing due")
    }

    @ViewBuilder
    private var rectangular: some View {
        if let d = next {
            VStack(alignment: .leading, spacing: 1) {
                Text(d.course.isEmpty ? "Next due" : d.course)
                    .font(.headline)
                    .widgetAccentable()
                    .lineLimit(1)
                Text(d.title)
                    .font(.subheadline)
                    .lineLimit(1)
                if d.due > entry.date {
                    Text("in \(d.due, style: .relative)")
                        .font(.caption)
                        .lineLimit(1)
                } else {
                    Text("Overdue").font(.caption)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.hasData ? "All caught up" : "ConcordiaTracker").font(.headline).widgetAccentable()
                Text(entry.hasData ? "Nothing due." : "Open the app to see deadlines.").font(.caption)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var inline: some View {
        if let d = next, d.due > entry.date {
            // One line, one image at most: that is all the inline slot shows.
            Label {
                Text("\(Self.shortCode(d.course)) \(d.title) · \(d.due, style: .relative)")
            } icon: {
                Image(systemName: "hourglass")
            }
        } else {
            Label("Nothing due", systemImage: "checkmark")
        }
    }

    /// "COMM 305" stays; "COMM" alone when space is the problem.
    static func shortCode(_ code: String) -> String {
        code.isEmpty ? "Due" : code
    }
}

/// "45m", "3h", "2d": the whole value for the circular slot.
enum ShortLeft {
    static func label(until due: Date, from now: Date) -> String {
        let s = due.timeIntervalSince(now)
        if s <= 0 { return "!" }
        if s < 3600 { return "\(max(1, Int(s / 60)))m" }
        if s < 86_400 { return "\(Int(s / 3600))h" }
        return "\(Int(s / 86_400))d"
    }
}
