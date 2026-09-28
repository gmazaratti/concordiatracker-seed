import ActivityKit
import SwiftUI
import WidgetKit

/// The "next assignment due" Live Activity, drawn on the Lock Screen and in the
/// Dynamic Island. Started and ended by the app (DeadlineActivityPlugin) or by
/// a push-to-start from the server; this file only draws it.
///
/// The countdown is `Text(timerInterval:countsDown:)`, which the system ticks
/// on its own: no update pushes are spent keeping the number current. Past the
/// deadline the content is STALE (staleDate = due), which is what turns the
/// card to "Overdue" even if nothing updates it.
struct DeadlineLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeadlineActivityAttributes.self) { context in
            DeadlineLockScreenView(context: context)
                .activitySystemActionForegroundColor(Brand.course(context.attributes.colorHex))
                .widgetURL(link(context.attributes.path))
        } dynamicIsland: { context in
            let tint = Brand.course(context.attributes.colorHex)
            let phase = Phase(context)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label {
                        Text(context.state.course.isEmpty ? "Due" : context.state.course)
                            .font(.caption.weight(.semibold))
                    } icon: {
                        Image(systemName: phase.symbol)
                    }
                    .foregroundStyle(tint)
                    .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    CountdownText(context: context, phase: phase)
                        .font(.system(.title2, design: .rounded).weight(.heavy))
                        .foregroundStyle(phase.urgent ? Color.orange : Color.primary)
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(phase.headline)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(phase.urgent ? Color.orange : Color.primary)
                        Text("Due \(context.state.due, format: .dateTime.weekday(.abbreviated).hour().minute())")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: phase.symbol)
                    .foregroundStyle(tint)
            } compactTrailing: {
                CountdownText(context: context, phase: phase)
                    .font(.caption2.weight(.semibold).monospacedDigit())
                    .foregroundStyle(phase.urgent ? Color.orange : tint)
                    .frame(maxWidth: 56)
            } minimal: {
                Image(systemName: phase.symbol)
                    .foregroundStyle(tint)
            }
            .keylineTint(tint)
            .widgetURL(link(context.attributes.path))
        }
    }

    private func link(_ path: String) -> URL? {
        URL(string: "https://concordiatracker.com\(path)")
    }
}

/// Where the activity stands, decided in one place so the island, the card and
/// the final state all agree.
struct Phase {
    let done: Bool
    let overdue: Bool
    let urgent: Bool

    init(_ context: ActivityViewContext<DeadlineActivityAttributes>) {
        let state = context.state
        done = state.outcome == .done
        overdue = !done && (state.outcome == .overdue || context.isStale || state.due <= Date())
        urgent = !done && !overdue && state.due.timeIntervalSinceNow < 3600
    }

    var symbol: String {
        done ? "checkmark.circle.fill" : overdue ? "exclamationmark.circle.fill" : "hourglass"
    }

    /// The Duolingo-style line: plain, a little urgent, never mean.
    var headline: String {
        if done { return "Done. Nice work." }
        if overdue { return "The deadline passed." }
        if urgent { return "Under an hour. Get it in." }
        return "Coming up. You've got this."
    }
}

/// The countdown, or the final word once there is nothing left to count.
struct CountdownText: View {
    let context: ActivityViewContext<DeadlineActivityAttributes>
    let phase: Phase

    var body: some View {
        if phase.done {
            Text("Done")
        } else if phase.overdue {
            Text("Overdue")
        } else {
            // Ticks by itself. The lower bound is "now" at render time; the
            // range ends at the deadline, where it stops at 0:00.
            Text(timerInterval: Date()...max(Date(), context.state.due), countsDown: true)
                .monospacedDigit()
        }
    }
}

struct DeadlineLockScreenView: View {
    let context: ActivityViewContext<DeadlineActivityAttributes>

    var body: some View {
        let tint = Brand.course(context.attributes.colorHex)
        let phase = Phase(context)
        HStack(alignment: .center, spacing: 14) {
            ZStack {
                Circle().fill(tint.opacity(0.18))
                Image(systemName: phase.symbol)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(phase.done ? Color.green : phase.overdue ? Color.red : tint)
            }
            .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 2) {
                if !context.state.course.isEmpty {
                    Text(context.state.course.uppercased())
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(tint)
                }
                Text(context.state.title)
                    .font(.headline)
                    .lineLimit(2)
                Text(phase.done || phase.overdue
                    ? phase.headline
                    : "Due \(context.state.due.formatted(.dateTime.weekday(.abbreviated).hour().minute()))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            CountdownText(context: context, phase: phase)
                .font(.system(.title, design: .rounded).weight(.heavy))
                .foregroundStyle(phase.done ? Color.green : phase.overdue ? Color.red : phase.urgent ? Color.orange : Color.primary)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 120, alignment: .trailing)
        }
        .padding(16)
    }
}
