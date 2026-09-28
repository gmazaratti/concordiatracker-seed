import ActivityKit
import SwiftUI
import WidgetKit

/// The focus timer, in the Dynamic Island and on the Lock Screen. Started by
/// the app (FocusActivityPlugin) when a focus block or a break begins; this
/// file only draws it.
///
/// A running block ticks by itself (`Text(timerInterval:)` and
/// `ProgressView(timerInterval:)`), so no updates are spent keeping it current.
/// A paused one shows the time it stopped at, and does not count.
struct FocusLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FocusActivityAttributes.self) { context in
            FocusLockScreenView(context: context)
                .activitySystemActionForegroundColor(FocusLook(context).tint)
                .widgetURL(URL(string: "https://concordiatracker.com/app"))
        } dynamicIsland: { context in
            let look = FocusLook(context)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(look.title, systemImage: look.symbol)
                        .font(.caption.weight(.bold))
                        .foregroundStyle(look.tint)
                        .lineLimit(1)
                        .padding(.leading, 2)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    FocusTimeText(context: context, look: look)
                        .font(.system(.body, design: .rounded).weight(.bold))
                        .monospacedDigit()
                        .lineLimit(1)
                        .frame(maxWidth: 80, alignment: .trailing)
                        .padding(.trailing, 2)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        FocusProgress(context: context, look: look)
                        Text(look.line)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .padding(.horizontal, 2)
                }
            } compactLeading: {
                Image(systemName: look.symbol)
                    .foregroundStyle(look.tint)
            } compactTrailing: {
                FocusTimeText(context: context, look: look)
                    .font(.caption2.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(look.tint)
                    .frame(maxWidth: 48)
            } minimal: {
                Image(systemName: look.symbol)
                    .foregroundStyle(look.tint)
            }
            .keylineTint(look.tint)
            .contentMargins(.horizontal, 14, for: .expanded)
            .contentMargins(.bottom, 10, for: .expanded)
            .widgetURL(URL(string: "https://concordiatracker.com/app"))
        }
    }
}

/// Everything the views decide about the block, in one place.
struct FocusLook {
    let paused: Bool
    let finished: Bool
    let isBreak: Bool
    let remaining: Double
    let total: Double
    let ends: Date

    init(_ context: ActivityViewContext<FocusActivityAttributes>) {
        let state = context.state
        isBreak = state.isBreak
        paused = state.pausedRemaining != nil
        total = max(1, context.attributes.totalSeconds)
        ends = state.ends
        remaining = state.pausedRemaining ?? max(0, state.ends.timeIntervalSinceNow)
        finished = !paused && (context.isStale || state.ends <= Date())
    }

    var tint: Color { isBreak ? Color.green : Brand.accent }
    var symbol: String {
        if finished { return "checkmark.circle.fill" }
        if paused { return "pause.circle.fill" }
        return isBreak ? "cup.and.saucer.fill" : "timer"
    }
    var title: String { isBreak ? "Break" : "Focus" }
    var line: String {
        if finished { return isBreak ? "Break's over. Back to it." : "Block done. Take five." }
        if paused { return "Paused" }
        return isBreak ? "Step away for a bit." : "Stay with it."
    }
    var start: Date { ends.addingTimeInterval(-total) }
}

/// mm:ss counting down, the frozen time while paused, or "Done".
struct FocusTimeText: View {
    let context: ActivityViewContext<FocusActivityAttributes>
    let look: FocusLook

    var body: some View {
        if look.finished {
            Text("Done")
        } else if look.paused {
            Text(Self.clock(look.remaining))
        } else {
            Text(timerInterval: Date()...max(Date(), look.ends), countsDown: true)
        }
    }

    static func clock(_ seconds: Double) -> String {
        let s = Int(seconds.rounded())
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}

/// How far through the block, filling as it goes.
struct FocusProgress: View {
    let context: ActivityViewContext<FocusActivityAttributes>
    let look: FocusLook

    var body: some View {
        Group {
            if look.finished {
                ProgressView(value: 1)
            } else if look.paused {
                ProgressView(value: min(1, max(0, (look.total - look.remaining) / look.total)))
            } else {
                ProgressView(timerInterval: look.start...look.ends, countsDown: false) {
                    EmptyView()
                } currentValueLabel: {
                    EmptyView()
                }
            }
        }
        .progressViewStyle(.linear)
        .tint(look.tint)
    }
}

struct FocusLockScreenView: View {
    let context: ActivityViewContext<FocusActivityAttributes>

    var body: some View {
        let look = FocusLook(context)
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    Circle().fill(look.tint.opacity(0.18))
                    Image(systemName: look.symbol)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(look.tint)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 1) {
                    Text(look.title.uppercased())
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(look.tint)
                    Text(look.line)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                FocusTimeText(context: context, look: look)
                    .font(.system(.title, design: .rounded).weight(.heavy))
                    .monospacedDigit()
                    .frame(maxWidth: 120, alignment: .trailing)
            }
            FocusProgress(context: context, look: look)
        }
        .padding(16)
    }
}
