import Foundation
import Capacitor
import ActivityKit

/// Starts, pauses and ends the focus timer's Live Activity.
///
/// The web timer (src/features/today/widgets/StudyTimerWidget.tsx) owns the
/// clock and calls:
///   FocusActivity.start({ mode, totalSeconds, remainingSeconds })
///   FocusActivity.update({ mode, remainingSeconds, paused })
///   FocusActivity.end()
///
/// One activity at a time: starting again replaces whatever is running. The
/// content goes STALE when the block ends, which is what turns the island to
/// "Done" even if the app is not open when time runs out.
@objc(FocusActivityPlugin)
public class FocusActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FocusActivityPlugin"
    public let jsName = "FocusActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise)
    ]

    @objc func start(_ call: CAPPluginCall) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["started": false, "reason": "Live Activities are turned off for this app."])
            return
        }
        let mode = call.getString("mode") == "break" ? "break" : "focus"
        let total = max(1, call.getDouble("totalSeconds") ?? 25 * 60)
        let remaining = max(1, min(total, call.getDouble("remainingSeconds") ?? total))
        let state = Self.running(mode: mode, remaining: remaining)

        Task {
            await Self.endAll()
            do {
                let content = ActivityContent(state: state, staleDate: state.ends)
                _ = try Activity.request(
                    attributes: FocusActivityAttributes(totalSeconds: total),
                    content: content,
                    pushType: nil
                )
                call.resolve(["started": true])
            } catch {
                call.resolve(["started": false, "reason": error.localizedDescription])
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        let mode = call.getString("mode") == "break" ? "break" : "focus"
        let remaining = max(0, call.getDouble("remainingSeconds") ?? 0)
        let paused = call.getBool("paused") ?? false
        let state: FocusActivityAttributes.ContentState = paused
            ? .init(mode: mode, endsEpoch: Date().addingTimeInterval(remaining).timeIntervalSince1970,
                    pausedRemaining: remaining)
            : Self.running(mode: mode, remaining: remaining)
        Task {
            for activity in Activity<FocusActivityAttributes>.activities {
                // A paused block is never stale: it is waiting, not over.
                await activity.update(ActivityContent(state: state, staleDate: paused ? nil : state.ends))
            }
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        Task {
            await Self.endAll()
            call.resolve()
        }
    }

    private static func running(mode: String, remaining: Double) -> FocusActivityAttributes.ContentState {
        .init(mode: mode, endsEpoch: Date().addingTimeInterval(remaining).timeIntervalSince1970, pausedRemaining: nil)
    }

    private static func endAll() async {
        for activity in Activity<FocusActivityAttributes>.activities {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
