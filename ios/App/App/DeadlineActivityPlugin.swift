import Foundation
import Capacitor
import ActivityKit

/// Starts, updates and ends the "next assignment due" Live Activity.
///
/// The web app decides WHICH assignment (src/features/reminders/
/// useNativeDeadlineSync.ts) and calls:
///   DeadlineActivity.show({ assessmentId, title, course, color, dueISO, path })
///   DeadlineActivity.end({ outcome: 'done' | 'overdue' | 'none' })
///   DeadlineActivity.current()          → { assessmentId? }
///   DeadlineActivity.pushToStartToken() → { token? }
///
/// One activity at a time: showing a different assignment ends the old one.
/// The content goes STALE at the deadline, which is what flips the card to
/// "Overdue" by itself if the app is not open when the time passes.
@objc(DeadlineActivityPlugin)
public class DeadlineActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DeadlineActivityPlugin"
    public let jsName = "DeadlineActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "current", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pushToStartToken", returnType: CAPPluginReturnPromise)
    ]

    /// How long a finished card ("Done" / "Overdue") stays before it goes.
    private static let finalLinger: TimeInterval = 15 * 60
    private static var latestPushToStartToken: String?

    override public func load() {
        // Push-to-start (iOS 17.2+): a token the server can use to start the
        // activity with the app closed. It is not the device token and it can
        // rotate, so every new one is forwarded.
        if #available(iOS 17.2, *) {
            Task { [weak self] in
                for await data in Activity<DeadlineActivityAttributes>.pushToStartTokenUpdates {
                    let hex = data.map { String(format: "%02x", $0) }.joined()
                    Self.latestPushToStartToken = hex
                    self?.notifyListeners("pushToStartToken", data: ["token": hex], retainUntilConsumed: true)
                }
            }
        }
    }

    @objc func pushToStartToken(_ call: CAPPluginCall) {
        if let token = Self.latestPushToStartToken {
            call.resolve(["token": token])
        } else {
            call.resolve([:])
        }
    }

    @objc func show(_ call: CAPPluginCall) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["started": false, "reason": "Live Activities are turned off for this app."])
            return
        }
        guard let id = call.getString("assessmentId"),
              let title = call.getString("title"),
              let dueISO = call.getString("dueISO"),
              let due = Self.parseDate(dueISO) else {
            call.reject("assessmentId, title and dueISO are required.")
            return
        }
        guard due > Date() else {
            call.resolve(["started": false, "reason": "That deadline has passed."])
            return
        }
        let attributes = DeadlineActivityAttributes(
            assessmentId: id,
            colorHex: call.getString("color") ?? "#8fb39a",
            path: call.getString("path") ?? "/app"
        )
        let state = DeadlineActivityAttributes.ContentState(
            title: title,
            course: call.getString("course") ?? "",
            dueEpoch: due.timeIntervalSince1970,
            outcome: .pending
        )
        let content = ActivityContent(state: state, staleDate: due, relevanceScore: 80)

        Task {
            let running = Activity<DeadlineActivityAttributes>.activities
            if let same = running.first(where: { $0.attributes.assessmentId == id && $0.activityState == .active }) {
                await same.update(content)
                call.resolve(["started": true])
                return
            }
            for activity in running {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            do {
                _ = try Activity.request(attributes: attributes, content: content, pushType: nil)
                call.resolve(["started": true])
            } catch {
                call.resolve(["started": false, "reason": error.localizedDescription])
            }
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        let outcome = call.getString("outcome") ?? "none"
        Task {
            for activity in Activity<DeadlineActivityAttributes>.activities {
                if outcome == "done" || outcome == "overdue" {
                    var state = activity.content.state
                    state.outcome = outcome == "done" ? .done : .overdue
                    await activity.end(
                        ActivityContent(state: state, staleDate: nil, relevanceScore: 0),
                        dismissalPolicy: .after(Date().addingTimeInterval(Self.finalLinger))
                    )
                } else {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            call.resolve()
        }
    }

    @objc func current(_ call: CAPPluginCall) {
        if let activity = Activity<DeadlineActivityAttributes>.activities.first(where: { $0.activityState == .active }) {
            call.resolve(["assessmentId": activity.attributes.assessmentId])
        } else {
            call.resolve([:])
        }
    }

    private static func parseDate(_ raw: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = withFraction.date(from: raw) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: raw)
    }
}
